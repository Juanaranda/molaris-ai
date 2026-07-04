import type { FastifyInstance } from "fastify";
import prisma from "../config/prisma";
import { verifyToken } from "./auth";
import { ensureDefaultRecallRules, runRecallCheck } from "../services/notifications/recallService";

export async function recallRoutes(app: FastifyInstance) {
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

  // GET /api/clinics/:id/recall/rules — lista reglas (crea defaults si no hay)
  app.get<{ Params: { id: string } }>("/clinics/:id/recall/rules", async (req, reply) => {
    const g = guard(req);
    if (!g.ok) return reply.status(g.status).send({ error: g.error });

    await ensureDefaultRecallRules(req.params.id);
    const rules = await prisma.recallRule.findMany({
      where: { clinicId: req.params.id },
      orderBy: { createdAt: "asc" },
    });
    return reply.send({ rules });
  });

  // POST /api/clinics/:id/recall/rules — crear regla
  app.post<{
    Params: { id: string };
    Body:   { triggerService: string; intervalDays: number; messageTemplate: string };
  }>("/clinics/:id/recall/rules", async (req, reply) => {
    const g = guard(req);
    if (!g.ok) return reply.status(g.status).send({ error: g.error });

    const { triggerService, intervalDays, messageTemplate } = req.body ?? {};
    if (!triggerService?.trim() || !messageTemplate?.trim()) {
      return reply.status(400).send({ error: "Servicio y mensaje son requeridos" });
    }
    if (!Number.isInteger(intervalDays) || intervalDays < 1 || intervalDays > 730) {
      return reply.status(400).send({ error: "intervalDays debe ser un entero entre 1 y 730" });
    }
    if (messageTemplate.length > 1000) {
      return reply.status(400).send({ error: "Mensaje supera los 1000 caracteres" });
    }

    const created = await prisma.recallRule.create({
      data: {
        clinicId:        req.params.id,
        triggerService:  triggerService.trim(),
        intervalDays,
        messageTemplate: messageTemplate.trim(),
      },
    });
    return reply.status(201).send({ rule: created });
  });

  // PATCH /api/clinics/:id/recall/rules/:ruleId
  app.patch<{
    Params: { id: string; ruleId: string };
    Body:   { triggerService?: string; intervalDays?: number; messageTemplate?: string; active?: boolean };
  }>("/clinics/:id/recall/rules/:ruleId", async (req, reply) => {
    const g = guard(req);
    if (!g.ok) return reply.status(g.status).send({ error: g.error });

    const rule = await prisma.recallRule.findUnique({ where: { id: req.params.ruleId } });
    if (!rule || rule.clinicId !== req.params.id) {
      return reply.status(404).send({ error: "Regla no encontrada" });
    }

    const { triggerService, intervalDays, messageTemplate, active } = req.body ?? {};
    if (intervalDays !== undefined && (!Number.isInteger(intervalDays) || intervalDays < 1 || intervalDays > 730)) {
      return reply.status(400).send({ error: "intervalDays debe ser un entero entre 1 y 730" });
    }
    if (messageTemplate !== undefined && messageTemplate.length > 1000) {
      return reply.status(400).send({ error: "Mensaje supera los 1000 caracteres" });
    }

    const updated = await prisma.recallRule.update({
      where: { id: req.params.ruleId },
      data: {
        ...(triggerService  !== undefined && { triggerService: triggerService.trim() }),
        ...(intervalDays    !== undefined && { intervalDays }),
        ...(messageTemplate !== undefined && { messageTemplate: messageTemplate.trim() }),
        ...(active          !== undefined && { active }),
      },
    });
    return reply.send({ rule: updated });
  });

  // DELETE /api/clinics/:id/recall/rules/:ruleId
  app.delete<{ Params: { id: string; ruleId: string } }>(
    "/clinics/:id/recall/rules/:ruleId",
    async (req, reply) => {
      const g = guard(req);
      if (!g.ok) return reply.status(g.status).send({ error: g.error });

      const rule = await prisma.recallRule.findUnique({ where: { id: req.params.ruleId } });
      if (!rule || rule.clinicId !== req.params.id) {
        return reply.status(404).send({ error: "Regla no encontrada" });
      }
      await prisma.recallRule.delete({ where: { id: req.params.ruleId } });
      return reply.send({ ok: true });
    }
  );

  // GET /api/clinics/:id/recall/events — audit log (últimos 100)
  app.get<{ Params: { id: string }; Querystring: { limit?: string } }>(
    "/clinics/:id/recall/events",
    async (req, reply) => {
      const g = guard(req);
      if (!g.ok) return reply.status(g.status).send({ error: g.error });

      const limit = Math.min(Math.max(Number(req.query.limit ?? 100), 1), 500);
      const events = await prisma.recallEvent.findMany({
        where: { clinicId: req.params.id },
        orderBy: { sentAt: "desc" },
        take: limit,
        include: { rule: { select: { triggerService: true, intervalDays: true } } },
      });
      return reply.send({ events });
    }
  );

  // POST /api/clinics/:id/recall/trigger — gatillo manual del scheduler (admin)
  app.post<{ Params: { id: string } }>(
    "/clinics/:id/recall/trigger",
    async (req, reply) => {
      const g = guard(req);
      if (!g.ok) return reply.status(g.status).send({ error: g.error });
      // Run async — devolvemos 202 sin esperar
      runRecallCheck().catch((e) => console.error("[Recall] Manual trigger error:", e));
      return reply.status(202).send({ ok: true, message: "Recall check disparado en background" });
    }
  );
}
