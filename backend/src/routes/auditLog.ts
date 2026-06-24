import type { FastifyInstance } from "fastify";
import prisma from "../config/prisma";
import { verifyToken } from "./auth";

export async function auditLogRoutes(app: FastifyInstance) {

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

  // GET /api/clinics/:id/audit-log?actor=&resource=&from=&to=&limit=
  app.get<{
    Params: { id: string };
    Querystring: { actor?: string; resource?: string; from?: string; to?: string; limit?: string };
  }>("/clinics/:id/audit-log", async (req, reply) => {
    const g = guard(req);
    if (!g.ok) return reply.status(g.status).send({ error: g.error });

    const limit = Math.min(Math.max(Number(req.query.limit ?? 100), 1), 500);
    const logs = await prisma.auditLog.findMany({
      where: {
        clinicId: req.params.id,
        ...(req.query.actor    ? { actorId:      req.query.actor }    : {}),
        ...(req.query.resource ? { resourceType: req.query.resource } : {}),
        ...(req.query.from || req.query.to ? {
          createdAt: {
            ...(req.query.from ? { gte: new Date(req.query.from) } : {}),
            ...(req.query.to   ? { lte: new Date(req.query.to)   } : {}),
          },
        } : {}),
      },
      orderBy: { createdAt: "desc" },
      take:    limit,
      include: { actor: { select: { id: true, name: true, email: true } } },
    });
    return reply.send({ logs });
  });
}
