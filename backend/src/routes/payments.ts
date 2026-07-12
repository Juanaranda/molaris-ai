import type { FastifyInstance } from "fastify";
import crypto from "crypto";
import prisma from "../config/prisma";
import { verifyToken } from "./auth";
import { config } from "../config/env";
import {
  createPreference, getPayment, mapMpStatusToInternal,
} from "../services/payments/mercadoPagoService";
import { autoEmitBoletaForPayment } from "../services/sii/autoBoletaService";

export async function paymentRoutes(app: FastifyInstance) {
  function guardClinic(req: { headers: { authorization?: string }; params: { id: string } }):
    | { ok: true;  payload: ReturnType<typeof verifyToken> }
    | { ok: false; status: number; error: string }
  {
    let payload;
    try { payload = verifyToken(req.headers.authorization); }
    catch { return { ok: false, status: 401, error: "No autorizado" }; }
    if (payload.role === "USER") return { ok: false, status: 403, error: "Sin permisos" };
    if (payload.role !== "SUPERADMIN" && payload.clinicId !== req.params.id) {
      return { ok: false, status: 403, error: "Acceso denegado" };
    }
    return { ok: true, payload };
  }

  // ── Crear link de pago para una cita ────────────────────────────────────────
  // POST /api/bookings/:bookingId/payment-link
  app.post<{
    Params: { bookingId: string };
    Body:   { amount?: number; description?: string };
  }>("/bookings/:bookingId/payment-link", async (req, reply) => {
    let payload;
    try { payload = verifyToken(req.headers.authorization); }
    catch { return reply.status(401).send({ error: "No autorizado" }); }
    // Cobros solo para ADMIN/SUPERADMIN — consistente con GET /clinics/:id/payments (#63)
    if (payload.role === "USER") {
      return reply.status(403).send({ error: "Sin permisos para generar links de cobro" });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: req.params.bookingId },
      include: { clinic: { select: { id: true, name: true, mpAccessToken: true, mpVerified: true } } },
    });
    if (!booking) return reply.status(404).send({ error: "Cita no encontrada" });
    if (payload.role !== "SUPERADMIN" && payload.clinicId !== booking.clinicId) {
      return reply.status(403).send({ error: "Acceso denegado" });
    }
    if (!booking.clinic.mpVerified || !booking.clinic.mpAccessToken) {
      return reply.status(400).send({ error: "La clínica no tiene Mercado Pago configurado" });
    }

    const amount = req.body?.amount ?? booking.amountTotal ?? 0;
    if (!Number.isFinite(amount) || amount <= 0) {
      return reply.status(400).send({ error: "Monto inválido — define amount o booking.amountTotal" });
    }
    const description = req.body?.description ?? `${booking.service ?? "Atención dental"} — ${booking.clinic.name}`;

    // Crear Payment primero para tener el externalRef (Payment.id)
    const payment = await prisma.payment.create({
      data: {
        clinicId:    booking.clinicId,
        bookingId:   booking.id,
        provider:    "mercadopago",
        externalRef: "", // se actualiza con el id auto-generado
        amount,
        currency:    "CLP",
        status:      "pending",
        description,
      },
    });
    // Set externalRef = el propio id (cuid)
    await prisma.payment.update({ where: { id: payment.id }, data: { externalRef: payment.id } });

    const notificationUrl = `${config.frontendUrl.replace(/\/$/, "")}/api/webhooks/mercadopago`;
    // OJO: notification_url debe apuntar al BACKEND público. Usar env var dedicada si frontendUrl no aplica.
    // Para v1 dejamos esto y el admin lo puede sobreescribir vía MP_NOTIFICATION_URL si difiere.
    const baseNotificationUrl = process.env.MP_NOTIFICATION_URL ?? notificationUrl;
    // ?ref=Payment.id permite al webhook resolver el pago directo, sin loop de tokens (#61)
    const finalNotificationUrl =
      `${baseNotificationUrl}${baseNotificationUrl.includes("?") ? "&" : "?"}ref=${payment.id}`;

    let result;
    try {
      result = await createPreference({
        accessToken:     booking.clinic.mpAccessToken,
        items: [{
          title:      description.slice(0, 250),
          quantity:   1,
          unit_price: Math.round(amount),
        }],
        externalRef:     payment.id,
        notificationUrl: finalNotificationUrl,
        payer: booking.patientEmail ? { email: booking.patientEmail, name: booking.patientName ?? undefined } : undefined,
      });
    } catch (err) {
      await prisma.payment.update({
        where: { id: payment.id },
        data:  { status: "rejected", raw: { error: err instanceof Error ? err.message : String(err) } },
      });
      return reply.status(502).send({ error: "Error creando preferencia en Mercado Pago" });
    }

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data:  { initPoint: result.initPoint, raw: { preferenceId: result.id } },
    });

    return reply.send({
      paymentId: updated.id,
      initPoint: updated.initPoint,
      amount:    updated.amount,
    });
  });

  // ── Listar pagos de la clínica ──────────────────────────────────────────────
  // GET /api/clinics/:id/payments?status=&limit=
  app.get<{
    Params: { id: string };
    Querystring: { status?: string; limit?: string };
  }>("/clinics/:id/payments", async (req, reply) => {
    const g = guardClinic(req);
    if (!g.ok) return reply.status(g.status).send({ error: g.error });

    const limit = Math.min(Math.max(Number(req.query.limit ?? 50), 1), 500);
    const payments = await prisma.payment.findMany({
      where: {
        clinicId: req.params.id,
        ...(req.query.status ? { status: req.query.status } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { booking: { select: { id: true, patientName: true, date: true, time: true, service: true } } },
    });
    return reply.send({ payments });
  });

  // ── Webhook Mercado Pago ────────────────────────────────────────────────────
  // POST /api/webhooks/mercadopago?ref=<Payment.id>
  // Defensas (#61):
  //   1. Firma x-signature (HMAC-SHA256 con el secret del webhook de MP) si
  //      MP_WEBHOOK_SECRET está configurado — 403 si no calza.
  //   2. Re-consulta a MP con el accessToken de la clínica dueña del Payment:
  //      el estado siempre sale de la API de MP, nunca del payload recibido.
  // El Payment se resuelve por providerPaymentId o por ?ref= (sin probar
  // tokens de todas las clínicas en loop).
  function isValidMpSignature(
    headers: Record<string, string | string[] | undefined>,
    dataId: string | number,
  ): boolean {
    const secret = config.mercadoPago.webhookSecret;
    if (!secret) return true; // sin secret configurado no podemos validar
    const sigHeader = headers["x-signature"];
    if (typeof sigHeader !== "string") return false;
    const parts: Record<string, string> = {};
    for (const p of sigHeader.split(",")) {
      const [k, ...v] = p.trim().split("=");
      parts[k] = v.join("=");
    }
    const ts = parts["ts"];
    const v1 = parts["v1"];
    if (!ts || !v1) return false;
    const requestId = typeof headers["x-request-id"] === "string" ? headers["x-request-id"] : "";
    // Manifest oficial de MP: "id:{data.id};request-id:{x-request-id};ts:{ts};"
    const manifest = `id:${String(dataId).toLowerCase()};request-id:${requestId};ts:${ts};`;
    const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
    } catch {
      return false; // largos distintos
    }
  }

  app.post<{
    Querystring: { ref?: string; "data.id"?: string; type?: string };
  }>("/webhooks/mercadopago", async (req, reply) => {
    const body = req.body as { type?: string; action?: string; data?: { id?: string | number } } | undefined;
    const topic = body?.type ?? body?.action ?? req.query.type;
    const mpPaymentId = body?.data?.id ?? req.query["data.id"];

    if (!topic || !mpPaymentId) {
      console.warn("[MP webhook] Payload sin type/data.id, ignorado:", JSON.stringify(body));
      return reply.status(200).send({ ok: true });
    }
    if (!isValidMpSignature(req.headers, mpPaymentId)) {
      console.warn(`[MP webhook] Firma x-signature inválida para mpId=${mpPaymentId}`);
      return reply.status(403).send({ error: "Firma inválida" });
    }
    // Responder 200 ya validada la firma y procesar async
    reply.status(200).send({ ok: true });

    if (!String(topic).includes("payment")) {
      // Ignorar notificaciones que no son de payment (merchant_order, etc.)
      return;
    }

    try {
      // 1. Payment ya registrado con este providerPaymentId
      let payment = await prisma.payment.findFirst({
        where: { providerPaymentId: String(mpPaymentId) },
        include: { clinic: { select: { mpAccessToken: true } } },
      });

      // 2. Primera notificación: resolver por ?ref= (= Payment.id, viaja en
      //    la notification_url que registramos al crear la preferencia)
      if (!payment && req.query.ref) {
        payment = await prisma.payment.findUnique({
          where: { id: req.query.ref },
          include: { clinic: { select: { mpAccessToken: true } } },
        });
      }

      if (!payment || !payment.clinic.mpAccessToken) {
        console.warn(`[MP webhook] No se pudo resolver Payment para mpId=${mpPaymentId} ref=${req.query.ref ?? "-"}`);
        return;
      }

      const mp = await getPayment(payment.clinic.mpAccessToken, mpPaymentId);
      // El pago de MP debe referenciar a ESTE Payment local (anti-spoofing de ?ref=)
      if (mp.external_reference && mp.external_reference !== payment.id) {
        console.warn(`[MP webhook] external_reference no coincide: mp=${mp.external_reference} local=${payment.id}`);
        return;
      }
      const internalStatus = mapMpStatusToInternal(mp.status);
      const paid = internalStatus === "approved";

      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          providerPaymentId: String(mp.id),
          status:            internalStatus,
          payerEmail:        mp.payer?.email,
          paidAt:            paid && mp.date_approved ? new Date(mp.date_approved) : null,
          raw:               mp.raw as object,
        },
      });

      // Sincronizar Booking si está vinculado
      if (paid && payment.bookingId) {
        const totalPaid = await prisma.payment.aggregate({
          where: { bookingId: payment.bookingId, status: "approved" },
          _sum:  { amount: true },
        });
        const sum = totalPaid._sum.amount ?? 0;
        const booking = await prisma.booking.findUnique({ where: { id: payment.bookingId } });
        if (booking) {
          const total = booking.amountTotal ?? sum;
          const newStatus = sum >= total ? "paid" : "partial";
          await prisma.booking.update({
            where: { id: booking.id },
            data: {
              paymentStatus: newStatus,
              amountPaid:    sum,
              amountTotal:   booking.amountTotal ?? total,
              paymentMethod: "card",
              paidAt:        new Date(),
            },
          });
        }
      }

      // Hook: auto-emitir boleta SII si la clínica está configurada (Issue #30)
      // No bloquea — si falla, queda log. La emisión manual sigue disponible.
      if (paid) {
        autoEmitBoletaForPayment(payment.id)
          .catch((e) => console.error("[AutoBoleta] failed:", e));
      }
    } catch (err) {
      console.error("[MP webhook] Error procesando:", err);
    }
  });
}
