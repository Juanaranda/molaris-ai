import type { FastifyInstance } from "fastify";
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
    const finalNotificationUrl = process.env.MP_NOTIFICATION_URL ?? notificationUrl;

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
  // POST /api/webhooks/mercadopago
  // Responder 200 inmediatamente y procesar async.
  // Defensa: en lugar de validar firma, re-consultamos MP con el payment ID
  // usando el accessToken de la clínica — si el ID no existe o no pertenece
  // a la clínica, ignoramos.
  app.post("/webhooks/mercadopago", async (req, reply) => {
    reply.status(200).send({ ok: true });

    const body = req.body as { type?: string; action?: string; data?: { id?: string | number } } | undefined;
    const topic = body?.type ?? body?.action;
    const mpPaymentId = body?.data?.id;
    if (!topic || !mpPaymentId) {
      console.warn("[MP webhook] Payload sin type/data.id, ignorado:", JSON.stringify(body));
      return;
    }
    if (!String(topic).includes("payment")) {
      // Ignorar notificaciones que no son de payment (merchant_order, etc.)
      return;
    }

    try {
      // Buscar primero el Payment local por providerPaymentId; si no existe,
      // necesitamos el accessToken de la clínica vía external_reference. Para
      // eso consultamos MP con cualquier accessToken válido — pero como cada
      // clínica tiene el suyo, lo resolvemos en dos pasos:
      // 1. Buscar Payment por providerPaymentId si ya lo registramos
      // 2. Si no, intentar resolver vía external_reference (que es Payment.id)

      let payment = await prisma.payment.findFirst({
        where: { providerPaymentId: String(mpPaymentId) },
        include: { clinic: { select: { mpAccessToken: true } } },
      });

      // Si no encontramos por providerPaymentId, MP nos pasa solo el id.
      // Necesitamos consultar MP — pero no sabemos qué token usar.
      // Workaround: probar con todas las clínicas con MP configurado hasta
      // que una devuelva el payment exitosamente.
      if (!payment) {
        const clinics = await prisma.clinic.findMany({
          where: { mpVerified: true, mpAccessToken: { not: null } },
          select: { id: true, mpAccessToken: true },
        });
        for (const c of clinics) {
          if (!c.mpAccessToken) continue;
          try {
            const mpData = await getPayment(c.mpAccessToken, mpPaymentId);
            if (mpData.external_reference) {
              const local = await prisma.payment.findUnique({
                where: { id: mpData.external_reference },
                include: { clinic: { select: { mpAccessToken: true } } },
              });
              if (local && local.clinicId === c.id) {
                payment = local;
                break;
              }
            }
          } catch {
            // probar siguiente clínica
          }
        }
      }

      if (!payment || !payment.clinic.mpAccessToken) {
        console.warn(`[MP webhook] No se pudo resolver Payment para mpId=${mpPaymentId}`);
        return;
      }

      const mp = await getPayment(payment.clinic.mpAccessToken, mpPaymentId);
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
