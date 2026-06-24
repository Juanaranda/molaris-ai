import type { FastifyInstance } from "fastify";
import prisma from "../config/prisma";
import { verifyToken } from "./auth";
import { emitBoleta } from "../services/sii/openFacturaService";
import { audit } from "../services/audit/auditService";

export async function boletaRoutes(app: FastifyInstance) {
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

  // ── Emitir boleta para un booking ──────────────────────────────────────────
  // POST /api/bookings/:bookingId/boleta
  app.post<{
    Params: { bookingId: string };
    Body:   { amount?: number; rutReceptor?: string; description?: string };
  }>("/bookings/:bookingId/boleta", async (req, reply) => {
    let payload;
    try { payload = verifyToken(req.headers.authorization); }
    catch { return reply.status(401).send({ error: "No autorizado" }); }
    if (payload.role === "USER") return reply.status(403).send({ error: "Sin permisos" });

    const booking = await prisma.booking.findUnique({
      where: { id: req.params.bookingId },
      include: { clinic: true },
    });
    if (!booking) return reply.status(404).send({ error: "Cita no encontrada" });
    if (payload.role !== "SUPERADMIN" && payload.clinicId !== booking.clinicId) {
      return reply.status(403).send({ error: "Acceso denegado" });
    }

    const c = booking.clinic;
    if (!c.siiVerified || !c.siiApiKey || !c.siiRutEmisor || !c.siiRazonSocial || !c.siiGiro) {
      return reply.status(400).send({ error: "La clínica no tiene SII configurado (siiApiKey, RUT emisor, razón social, giro)" });
    }

    const amount = req.body?.amount ?? booking.amountTotal ?? 0;
    if (!Number.isFinite(amount) || amount <= 0) {
      return reply.status(400).send({ error: "Monto inválido — define amount o booking.amountTotal" });
    }
    const description = req.body?.description ?? `${booking.service ?? "Atención dental"} — ${booking.doctor}`;
    const rutReceptor = req.body?.rutReceptor ?? booking.patientRut ?? undefined;

    // Crear registro local con status='draft' antes de llamar al provider
    const boleta = await prisma.boleta.create({
      data: {
        clinicId:     booking.clinicId,
        bookingId:    booking.id,
        documentType: c.siiDocumentType ?? 39,
        rutReceptor:  rutReceptor ?? null,
        patientName:  booking.patientName,
        description,
        netAmount:    Math.round(amount),
        iva:          0,             // se actualiza tras emisión
        totalAmount:  Math.round(amount),
        status:       "draft",
        provider:     c.siiProvider ?? "openfactura",
      },
    });

    const result = await emitBoleta({
      apiKey:       c.siiApiKey,
      documentType: c.siiDocumentType ?? 39,
      rutEmisor:    c.siiRutEmisor,
      razonSocial:  c.siiRazonSocial,
      giro:         c.siiGiro,
      rutReceptor,
      receptorName: booking.patientName ?? undefined,
      items:        [{ description, quantity: 1, unitPrice: Math.round(amount) }],
      exenta:       c.siiExenta,
    });

    const updated = await prisma.boleta.update({
      where: { id: boleta.id },
      data: {
        folio:        result.folio,
        status:       result.status,
        providerRef:  result.providerRef,
        pdfUrl:       result.pdfUrl,
        xmlContent:   result.xml,
        timbreUrl:    result.timbreUrl,
        netAmount:    result.netAmount,
        iva:          result.iva,
        totalAmount:  result.totalAmount,
        emittedAt:    result.status === "issued" ? new Date() : null,
        errorMessage: result.errorMessage,
      },
    });

    audit({
      req, actorId: payload.userId, clinicId: booking.clinicId,
      action: "create", resourceType: "Boleta", resourceId: updated.id,
      snapshotAfter: { folio: updated.folio, status: updated.status, totalAmount: updated.totalAmount, bookingId: booking.id },
    });

    if (result.status === "error") {
      return reply.status(502).send({
        error: "Error emitiendo boleta",
        detail: result.errorMessage,
        boletaId: updated.id,
      });
    }

    return reply.send({
      boleta: {
        id:          updated.id,
        folio:       updated.folio,
        pdfUrl:      updated.pdfUrl,
        totalAmount: updated.totalAmount,
        status:      updated.status,
      },
    });
  });

  // ── Listar boletas de la clínica ───────────────────────────────────────────
  // GET /api/clinics/:id/boletas?status=&limit=
  app.get<{
    Params: { id: string };
    Querystring: { status?: string; limit?: string };
  }>("/clinics/:id/boletas", async (req, reply) => {
    const g = guardClinic(req);
    if (!g.ok) return reply.status(g.status).send({ error: g.error });

    const limit = Math.min(Math.max(Number(req.query.limit ?? 50), 1), 500);
    const boletas = await prisma.boleta.findMany({
      where: {
        clinicId: req.params.id,
        ...(req.query.status ? { status: req.query.status } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true, folio: true, status: true, totalAmount: true, netAmount: true, iva: true,
        rutReceptor: true, patientName: true, description: true, pdfUrl: true,
        emittedAt: true, createdAt: true, errorMessage: true,
        bookingId: true,
      },
    });
    return reply.send({ boletas });
  });
}
