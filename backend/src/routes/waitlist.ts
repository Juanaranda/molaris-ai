import type { FastifyInstance } from "fastify";
import prisma from "../config/prisma";
import { verifyToken } from "./auth";

const VALID_STATUS = ["waiting", "notified", "converted", "expired", "cancelled"] as const;

export async function waitlistRoutes(app: FastifyInstance) {

  function guard(req: { headers: { authorization?: string }; params: { id: string } }):
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

  // GET /api/clinics/:id/waitlist?status=&limit=
  app.get<{
    Params: { id: string };
    Querystring: { status?: string; limit?: string };
  }>("/clinics/:id/waitlist", async (req, reply) => {
    const g = guard(req);
    if (!g.ok) return reply.status(g.status).send({ error: g.error });

    const entries = await prisma.waitlistEntry.findMany({
      where: {
        clinicId: req.params.id,
        ...(req.query.status ? { status: req.query.status } : {}),
      },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      take: Math.min(Math.max(Number(req.query.limit ?? 100), 1), 500),
    });
    return reply.send({ entries });
  });

  // POST /api/clinics/:id/waitlist — agregar paciente
  app.post<{
    Params: { id: string };
    Body: {
      patientName:      string;
      patientPhone:     string;
      patientRut?:      string;
      preferredDoctor?: string;
      preferredService?: string;
      dateFrom?:        string;
      dateTo?:          string;
      notes?:           string;
    };
  }>("/clinics/:id/waitlist", async (req, reply) => {
    const g = guard(req);
    if (!g.ok) return reply.status(g.status).send({ error: g.error });

    const { patientName, patientPhone, patientRut, preferredDoctor, preferredService, dateFrom, dateTo, notes } = req.body ?? {};
    if (!patientName?.trim() || !patientPhone?.trim()) {
      return reply.status(400).send({ error: "Nombre y teléfono son requeridos" });
    }

    const entry = await prisma.waitlistEntry.create({
      data: {
        clinicId:         req.params.id,
        patientName:      patientName.trim(),
        patientPhone:     patientPhone.replace(/\D/g, ""),
        patientRut:       patientRut?.trim() || null,
        preferredDoctor:  preferredDoctor?.trim() || null,
        preferredService: preferredService?.trim() || null,
        dateFrom:         dateFrom ? new Date(dateFrom) : null,
        dateTo:           dateTo   ? new Date(dateTo)   : null,
        notes:            notes?.trim() || null,
      },
    });
    return reply.status(201).send({ entry });
  });

  // PATCH /api/clinics/:id/waitlist/:entryId — cambiar status o convertir
  app.patch<{
    Params: { id: string; entryId: string };
    Body: { status?: typeof VALID_STATUS[number]; convertedBookingId?: string };
  }>("/clinics/:id/waitlist/:entryId", async (req, reply) => {
    const g = guard(req);
    if (!g.ok) return reply.status(g.status).send({ error: g.error });

    const { status, convertedBookingId } = req.body ?? {};
    if (status && !VALID_STATUS.includes(status)) {
      return reply.status(400).send({ error: "Status inválido" });
    }

    const entry = await prisma.waitlistEntry.findUnique({ where: { id: req.params.entryId } });
    if (!entry || entry.clinicId !== req.params.id) {
      return reply.status(404).send({ error: "Entrada no encontrada" });
    }

    const updated = await prisma.waitlistEntry.update({
      where: { id: req.params.entryId },
      data: {
        ...(status              !== undefined && { status }),
        ...(convertedBookingId  !== undefined && { convertedBookingId }),
      },
    });
    return reply.send({ entry: updated });
  });

  // DELETE /api/clinics/:id/waitlist/:entryId
  app.delete<{ Params: { id: string; entryId: string } }>(
    "/clinics/:id/waitlist/:entryId",
    async (req, reply) => {
      const g = guard(req);
      if (!g.ok) return reply.status(g.status).send({ error: g.error });

      const entry = await prisma.waitlistEntry.findUnique({ where: { id: req.params.entryId } });
      if (!entry || entry.clinicId !== req.params.id) {
        return reply.status(404).send({ error: "Entrada no encontrada" });
      }
      await prisma.waitlistEntry.delete({ where: { id: req.params.entryId } });
      return reply.send({ ok: true });
    }
  );
}
