import { FastifyInstance } from "fastify";
import prisma from "../config/prisma";
import { verifyToken } from "./auth";

export async function sessionRoutes(app: FastifyInstance) {
  /**
   * GET /api/sessions
   * Query params:
   *   sortBy=leadScore  → ordena por leadScore desc
   *   limit=N           → máximo de resultados (default 50, max 200)
   *
   * Requiere JWT de partner (ADMIN o SUPERADMIN).
   * SUPERADMIN puede ver todas las sesiones; el resto solo las de su clínica.
   */
  app.get<{
    Querystring: { sortBy?: string; limit?: string };
  }>("/sessions", async (req, reply) => {
    let payload;
    try {
      payload = verifyToken(req.headers.authorization);
    } catch {
      return reply.status(401).send({ error: "No autorizado" });
    }

    const { sortBy, limit: limitRaw } = req.query;
    const limit = Math.min(Number(limitRaw ?? 50), 200);

    const clinicFilter =
      payload.role === "SUPERADMIN" ? {} : { clinicId: payload.clinicId ?? "" };

    const orderBy =
      sortBy === "leadScore"
        ? { leadScore: "desc" as const }
        : { createdAt: "desc" as const };

    const sessions = await prisma.session.findMany({
      where: {
        ...clinicFilter,
        isSandbox: false,
        channel: { not: "demo" },
      },
      orderBy,
      take: limit,
      select: {
        id: true,
        clinicId: true,
        channel: true,
        status: true,
        leadScore: true,
        createdAt: true,
        updatedAt: true,
        clinic: { select: { name: true, slug: true } },
        context: {
          select: {
            patientName: true,
            email: true,
            serviceInterest: true,
            intent: true,
            urgency: true,
            score: true,
            slotBooked: true,
          },
        },
        _count: { select: { messages: true } },
      },
    });

    return reply.send({ sessions, total: sessions.length });
  });

  /**
   * GET /api/sessions/:id
   * Devuelve una conversación completa con todos sus mensajes (orden cronológico)
   * y el contexto del paciente. Para que el dueño/equipo vea cómo respondió el agente.
   * Solo la clínica dueña (o SUPERADMIN) puede verla.
   */
  app.get<{ Params: { id: string } }>("/sessions/:id", async (req, reply) => {
    let payload;
    try {
      payload = verifyToken(req.headers.authorization);
    } catch {
      return reply.status(401).send({ error: "No autorizado" });
    }

    const session = await prisma.session.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        clinicId: true,
        channel: true,
        status: true,
        leadScore: true,
        createdAt: true,
        updatedAt: true,
        context: {
          select: {
            patientName: true, rut: true, email: true,
            serviceInterest: true, intent: true, urgency: true,
            score: true, slotBooked: true, notes: true,
          },
        },
        messages: {
          orderBy: { createdAt: "asc" },
          select: { id: true, role: true, content: true, createdAt: true },
        },
      },
    });

    if (!session) return reply.status(404).send({ error: "Conversación no encontrada" });
    if (payload.role !== "SUPERADMIN" && session.clinicId !== payload.clinicId) {
      return reply.status(403).send({ error: "Acceso denegado" });
    }

    return reply.send({ session });
  });
}
