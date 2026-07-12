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
}
