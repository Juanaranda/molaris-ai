import type { FastifyInstance } from "fastify";
import prisma from "../config/prisma";
import { verifyToken } from "./auth";

interface CreatePlanBody {
  patientRut?: string;
  patientName: string;
  doctor?: string;
  title: string;
  description?: string;
  totalAmount?: number;
  sessions?: number;
  notes?: string;
}

interface UpdatePlanBody {
  status?: "active" | "completed" | "cancelled" | "paused";
  amountPaid?: number;
  sessionsCompleted?: number;
  notes?: string;
  endDate?: string;
}

function planSelect() {
  return {
    id: true,
    patientRut: true,
    patientName: true,
    doctor: true,
    title: true,
    description: true,
    totalAmount: true,
    amountPaid: true,
    sessions: true,
    sessionsCompleted: true,
    status: true,
    startDate: true,
    endDate: true,
    notes: true,
    createdAt: true,
    updatedAt: true,
  } as const;
}

export async function treatmentPlansRoutes(app: FastifyInstance) {
  // GET /api/treatment-plans?patientRut=...
  app.get<{ Querystring: { patientRut?: string } }>("/treatment-plans", async (req, reply) => {
    let payload;
    try { payload = verifyToken(req.headers.authorization); }
    catch { return reply.status(401).send({ error: "No autorizado" }); }
    if (!payload.clinicId) return reply.status(403).send({ error: "Sin clínica asignada" });

    const { patientRut } = req.query;
    const plans = await prisma.treatmentPlan.findMany({
      where: {
        clinicId: payload.clinicId,
        ...(patientRut ? { patientRut } : {}),
      },
      select: planSelect(),
      orderBy: { createdAt: "desc" },
    });
    return reply.send(plans);
  });

  // POST /api/treatment-plans
  app.post<{ Body: CreatePlanBody }>("/treatment-plans", async (req, reply) => {
    let payload;
    try { payload = verifyToken(req.headers.authorization); }
    catch { return reply.status(401).send({ error: "No autorizado" }); }
    if (!payload.clinicId) return reply.status(403).send({ error: "Sin clínica asignada" });

    const { patientRut, patientName, doctor, title, description, totalAmount, sessions, notes } = req.body ?? {};
    if (!patientName || !title) {
      return reply.status(400).send({ error: "Campos requeridos: patientName, title" });
    }

    const plan = await prisma.treatmentPlan.create({
      data: {
        clinicId: payload.clinicId,
        patientRut: patientRut ?? null,
        patientName,
        doctor: doctor ?? null,
        title,
        description: description ?? null,
        totalAmount: totalAmount ?? null,
        sessions: sessions ?? 1,
        notes: notes ?? null,
      },
      select: planSelect(),
    });
    return reply.status(201).send(plan);
  });

  // PATCH /api/treatment-plans/:id
  app.patch<{ Params: { id: string }; Body: UpdatePlanBody }>("/treatment-plans/:id", async (req, reply) => {
    let payload;
    try { payload = verifyToken(req.headers.authorization); }
    catch { return reply.status(401).send({ error: "No autorizado" }); }
    if (!payload.clinicId) return reply.status(403).send({ error: "Sin clínica asignada" });

    const { id } = req.params;
    const existing = await prisma.treatmentPlan.findUnique({ where: { id } });
    if (!existing || existing.clinicId !== payload.clinicId) {
      return reply.status(404).send({ error: "Plan no encontrado" });
    }

    const { status, amountPaid, sessionsCompleted, notes, endDate } = req.body ?? {};
    const validStatuses = ["active", "completed", "cancelled", "paused"];
    if (status && !validStatuses.includes(status)) {
      return reply.status(400).send({ error: "Status inválido" });
    }

    const updated = await prisma.treatmentPlan.update({
      where: { id },
      data: {
        ...(status !== undefined ? { status } : {}),
        ...(amountPaid !== undefined ? { amountPaid } : {}),
        ...(sessionsCompleted !== undefined ? { sessionsCompleted } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(endDate !== undefined ? { endDate: new Date(endDate) } : {}),
      },
      select: planSelect(),
    });
    return reply.send(updated);
  });

  // DELETE /api/treatment-plans/:id  → sets status = "cancelled"
  app.delete<{ Params: { id: string } }>("/treatment-plans/:id", async (req, reply) => {
    let payload;
    try { payload = verifyToken(req.headers.authorization); }
    catch { return reply.status(401).send({ error: "No autorizado" }); }
    if (!payload.clinicId) return reply.status(403).send({ error: "Sin clínica asignada" });

    const { id } = req.params;
    const existing = await prisma.treatmentPlan.findUnique({ where: { id } });
    if (!existing || existing.clinicId !== payload.clinicId) {
      return reply.status(404).send({ error: "Plan no encontrado" });
    }

    const updated = await prisma.treatmentPlan.update({
      where: { id },
      data: { status: "cancelled" },
      select: planSelect(),
    });
    return reply.send(updated);
  });
}
