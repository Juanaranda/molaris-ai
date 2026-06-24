import type { FastifyInstance } from "fastify";
import prisma from "../config/prisma";
import { verifyToken } from "./auth";

const VALID_STATUS = ["pending", "in_transit", "received", "installed", "rejected"] as const;
const VALID_TYPES  = ["corona", "protesis", "placa", "puente", "implante_corona", "blanqueamiento", "otro"] as const;

export async function labOrderRoutes(app: FastifyInstance) {

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

  // ── Listar órdenes (filtros opcionales por status, patient, overdue) ────
  app.get<{
    Params: { id: string };
    Querystring: { status?: string; patientId?: string; overdue?: string; limit?: string };
  }>("/clinics/:id/lab-orders", async (req, reply) => {
    const g = guardClinic(req);
    if (!g.ok) return reply.status(g.status).send({ error: g.error });

    const limit = Math.min(Math.max(Number(req.query.limit ?? 200), 1), 1000);
    const now = new Date();

    const orders = await prisma.labOrder.findMany({
      where: {
        clinicId: req.params.id,
        ...(req.query.status ? { status: req.query.status } : {}),
        ...(req.query.patientId ? { patientId: req.query.patientId } : {}),
        ...(req.query.overdue === "true" ? {
          status: { in: ["pending", "in_transit"] },
          expectedReturnAt: { lt: now },
        } : {}),
      },
      orderBy: [{ status: "asc" }, { sentAt: "desc" }],
      take: limit,
      include: {
        patient:   { select: { id: true, name: true, identity: { select: { firstName: true, lastName: true, rut: true } } } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    return reply.send({ orders });
  });

  // ── Crear orden ──────────────────────────────────────────────────────────
  app.post<{
    Params: { id: string };
    Body: {
      patientId?:       string;
      toothFDI?:        string;
      labName:          string;
      orderType:        typeof VALID_TYPES[number];
      description?:     string;
      sentAt?:          string;       // default now
      expectedReturnAt?: string;
      cost?:            number;
      notes?:           string;
    };
  }>("/clinics/:id/lab-orders", async (req, reply) => {
    const g = guardClinic(req);
    if (!g.ok) return reply.status(g.status).send({ error: g.error });

    const { patientId, toothFDI, labName, orderType, description, sentAt, expectedReturnAt, cost, notes } = req.body ?? {};
    if (!labName?.trim()) return reply.status(400).send({ error: "labName requerido" });
    if (!orderType || !VALID_TYPES.includes(orderType)) {
      return reply.status(400).send({ error: `orderType inválido (${VALID_TYPES.join("|")})` });
    }
    if (cost !== undefined && (typeof cost !== "number" || cost < 0)) {
      return reply.status(400).send({ error: "cost debe ser >= 0" });
    }

    // Validar que el patientId pertenece a esta clínica
    if (patientId) {
      const p = await prisma.patient.findUnique({ where: { id: patientId }, select: { clinicId: true } });
      if (!p || p.clinicId !== req.params.id) {
        return reply.status(400).send({ error: "Paciente no pertenece a esta clínica" });
      }
    }

    const order = await prisma.labOrder.create({
      data: {
        clinicId:         req.params.id,
        patientId:        patientId ?? null,
        toothFDI:         toothFDI ?? null,
        labName:          labName.trim(),
        orderType,
        description:      description?.trim() || null,
        sentAt:           sentAt ? new Date(sentAt) : new Date(),
        expectedReturnAt: expectedReturnAt ? new Date(expectedReturnAt) : null,
        cost:             cost ?? null,
        notes:            notes?.trim() || null,
        createdById:      g.payload.userId,
      },
      include: {
        patient:   { select: { id: true, name: true, identity: { select: { firstName: true, lastName: true, rut: true } } } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    return reply.status(201).send({ order });
  });

  // ── Actualizar orden (status, fechas, notas) ─────────────────────────────
  app.patch<{
    Params: { id: string; orderId: string };
    Body: {
      status?:           typeof VALID_STATUS[number];
      receivedAt?:       string | null;
      installedAt?:      string | null;
      expectedReturnAt?: string | null;
      cost?:             number | null;
      notes?:            string | null;
    };
  }>("/clinics/:id/lab-orders/:orderId", async (req, reply) => {
    const g = guardClinic(req);
    if (!g.ok) return reply.status(g.status).send({ error: g.error });

    const existing = await prisma.labOrder.findUnique({ where: { id: req.params.orderId } });
    if (!existing || existing.clinicId !== req.params.id) {
      return reply.status(404).send({ error: "Orden no encontrada" });
    }

    const { status, receivedAt, installedAt, expectedReturnAt, cost, notes } = req.body ?? {};
    if (status && !VALID_STATUS.includes(status)) {
      return reply.status(400).send({ error: "Status inválido" });
    }

    // Auto-fill fechas según transiciones de estado
    const data: Record<string, unknown> = {};
    if (status !== undefined) {
      data.status = status;
      if (status === "received"  && !existing.receivedAt  && receivedAt  === undefined) data.receivedAt  = new Date();
      if (status === "installed" && !existing.installedAt && installedAt === undefined) data.installedAt = new Date();
    }
    if (receivedAt       !== undefined) data.receivedAt       = receivedAt       ? new Date(receivedAt)       : null;
    if (installedAt      !== undefined) data.installedAt      = installedAt      ? new Date(installedAt)      : null;
    if (expectedReturnAt !== undefined) data.expectedReturnAt = expectedReturnAt ? new Date(expectedReturnAt) : null;
    if (cost             !== undefined) data.cost             = cost;
    if (notes            !== undefined) data.notes            = notes?.trim() || null;

    const updated = await prisma.labOrder.update({
      where: { id: req.params.orderId },
      data,
      include: {
        patient:   { select: { id: true, name: true, identity: { select: { firstName: true, lastName: true, rut: true } } } },
        createdBy: { select: { id: true, name: true } },
      },
    });
    return reply.send({ order: updated });
  });

  // ── Eliminar orden ───────────────────────────────────────────────────────
  app.delete<{ Params: { id: string; orderId: string } }>(
    "/clinics/:id/lab-orders/:orderId",
    async (req, reply) => {
      const g = guardClinic(req);
      if (!g.ok) return reply.status(g.status).send({ error: g.error });

      const existing = await prisma.labOrder.findUnique({ where: { id: req.params.orderId } });
      if (!existing || existing.clinicId !== req.params.id) {
        return reply.status(404).send({ error: "Orden no encontrada" });
      }
      await prisma.labOrder.delete({ where: { id: req.params.orderId } });
      return reply.send({ ok: true });
    }
  );
}
