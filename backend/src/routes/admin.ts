import { FastifyInstance } from "fastify";
import prisma from "../config/prisma";
import { verifyToken } from "./auth";
import { runReminderCheck } from "../services/notifications/reminderService";

export async function adminRoutes(app: FastifyInstance) {

  // Middleware: solo SUPERADMIN
  function requireSuperAdmin(req: any, reply: any) {
    let payload;
    try { payload = verifyToken(req.headers.authorization); } catch {
      return reply.status(401).send({ error: "No autorizado" });
    }
    if (payload.role !== "SUPERADMIN") {
      return reply.status(403).send({ error: "Solo SUPERADMIN" });
    }
    return payload;
  }

  // GET /api/admin/overview — resumen de todas las clínicas
  app.get("/admin/overview", async (req, reply) => {
    if (!requireSuperAdmin(req, reply)) return;

    const [clinics, totalSessions, totalLeads, totalBookings, usageTotals, usageByClinic, usageByModel, dailyCost] =
      await Promise.all([
        prisma.clinic.findMany({
          select: {
            id: true, slug: true, name: true, plan: true, active: true, createdAt: true,
            _count: { select: { sessions: true, bookings: true, partnerUsers: true } },
          },
          orderBy: { createdAt: "desc" },
        }),

        prisma.session.count(),
        prisma.patientContext.count(),
        prisma.booking.count(),

        // Costo y tokens totales
        prisma.usageEvent.aggregate({
          _sum: { tokensIn: true, tokensOut: true, costUsd: true },
          _count: true,
          _avg: { latencyMs: true },
        }),

        // Costo por clínica (últimos 30 días)
        prisma.usageEvent.groupBy({
          by: ["clinicId"],
          where: { createdAt: { gte: new Date(Date.now() - 30 * 86400000) } },
          _sum: { tokensIn: true, tokensOut: true, costUsd: true },
          _count: true,
        }),

        // Uso por modelo (total)
        prisma.usageEvent.groupBy({
          by: ["model", "tier"],
          _sum: { tokensIn: true, tokensOut: true, costUsd: true },
          _count: true,
          orderBy: { _sum: { costUsd: "desc" } },
        }),

        // Costo diario (últimos 14 días)
        prisma.$queryRaw<Array<{ day: string; cost: number; calls: bigint }>>`
          SELECT DATE("createdAt") as day,
                 ROUND(SUM("costUsd")::numeric, 6) as cost,
                 COUNT(*)::int as calls
          FROM usage_events
          WHERE "createdAt" >= NOW() - INTERVAL '14 days'
          GROUP BY DATE("createdAt")
          ORDER BY day ASC
        `,
      ]);

    // Enriquecer clínicas con sus métricas de uso (30d)
    const usageMap = new Map(usageByClinic.map((u) => [u.clinicId, u]));

    const enrichedClinics = clinics.map((c) => {
      const u = usageMap.get(c.id);
      return {
        ...c,
        usage30d: {
          calls:      u?._count ?? 0,
          tokensIn:   u?._sum.tokensIn  ?? 0,
          tokensOut:  u?._sum.tokensOut ?? 0,
          costUsd:    Number((u?._sum.costUsd ?? 0).toFixed(4)),
        },
      };
    });

    return reply.send({
      totals: {
        clinics:   clinics.length,
        sessions:  totalSessions,
        leads:     totalLeads,
        bookings:  totalBookings,
        calls:     usageTotals._count,
        tokensIn:  usageTotals._sum.tokensIn  ?? 0,
        tokensOut: usageTotals._sum.tokensOut ?? 0,
        costUsd:   Number((usageTotals._sum.costUsd ?? 0).toFixed(4)),
        avgLatencyMs: Math.round(usageTotals._avg.latencyMs ?? 0),
      },
      clinics: enrichedClinics,
      modelBreakdown: usageByModel.map((m) => ({
        model:    m.model,
        tier:     m.tier,
        calls:    m._count,
        tokensIn: m._sum.tokensIn  ?? 0,
        tokensOut: m._sum.tokensOut ?? 0,
        costUsd:  Number((m._sum.costUsd ?? 0).toFixed(4)),
      })),
      dailyCost: dailyCost.map((d) => ({
        day:   d.day,
        cost:  Number(d.cost),
        calls: Number(d.calls),
      })),
    });
  });

  // GET /api/admin/errors — log de fallos de AI (todas las clínicas)
  app.get<{ Querystring: { days?: string; limit?: string } }>("/admin/errors", async (req, reply) => {
    if (!requireSuperAdmin(req, reply)) return;
    const days  = Number(req.query.days  ?? 7);
    const limit = Math.min(Number(req.query.limit ?? 100), 500);
    const since = new Date(Date.now() - days * 86400000);

    const [errors, byType, byModel, errorRate] = await Promise.all([
      // Log reciente de fallos
      prisma.usageEvent.findMany({
        where: { success: false, createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true, model: true, tier: true, errorType: true, errorMessage: true,
          latencyMs: true, channel: true, isSandbox: true, createdAt: true,
          clinic: { select: { name: true, slug: true } },
        },
      }),

      // Fallos agrupados por tipo
      prisma.usageEvent.groupBy({
        by: ["errorType"],
        where: { success: false, createdAt: { gte: since } },
        _count: true,
        orderBy: { _count: { errorType: "desc" } },
      }),

      // Fallos por modelo
      prisma.usageEvent.groupBy({
        by: ["model", "tier"],
        where: { success: false, createdAt: { gte: since } },
        _count: true,
        orderBy: { _count: { model: "desc" } },
      }),

      // Tasa de éxito global (últimos N días)
      prisma.$queryRaw<Array<{ day: string; total: bigint; failures: bigint }>>`
        SELECT DATE("createdAt") as day,
               COUNT(*)::int as total,
               COUNT(*) FILTER (WHERE "success" = false)::int as failures
        FROM usage_events
        WHERE "createdAt" >= ${since}
          AND "isSandbox" = false
        GROUP BY DATE("createdAt")
        ORDER BY day ASC
      `,
    ]);

    return reply.send({
      errors,
      byType: byType.map((e) => ({ type: e.errorType ?? "unknown", count: e._count })),
      byModel: byModel.map((e) => ({ model: e.model, tier: e.tier, count: e._count })),
      errorRate: errorRate.map((r) => ({
        day: r.day,
        total: Number(r.total),
        failures: Number(r.failures),
        rate: Number(r.total) > 0 ? Number((Number(r.failures) / Number(r.total) * 100).toFixed(2)) : 0,
      })),
    });
  });

  // GET /api/admin/models — analytics de modelos (latencia, costo, éxito por modelo)
  app.get<{ Querystring: { days?: string } }>("/admin/models", async (req, reply) => {
    if (!requireSuperAdmin(req, reply)) return;
    const days  = Number(req.query.days ?? 30);
    const since = new Date(Date.now() - days * 86400000);

    const [byModel, latencyP95, dailyByTier] = await Promise.all([
      prisma.usageEvent.groupBy({
        by: ["model", "tier"],
        where: { createdAt: { gte: since }, isSandbox: false },
        _count: true,
        _sum:  { tokensIn: true, tokensOut: true, costUsd: true },
        _avg:  { latencyMs: true },
        orderBy: { _sum: { costUsd: "desc" } },
      }),

      // P95 latencia por modelo
      prisma.$queryRaw<Array<{ model: string; p50: number; p95: number; p99: number }>>`
        SELECT model,
               PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY "latencyMs") as p50,
               PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "latencyMs") as p95,
               PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY "latencyMs") as p99
        FROM usage_events
        WHERE "createdAt" >= ${since}
          AND "latencyMs" IS NOT NULL
          AND "isSandbox" = false
        GROUP BY model
      `,

      // Llamados por día desglosado por tier
      prisma.$queryRaw<Array<{ day: string; tier: string; calls: bigint; cost: number }>>`
        SELECT DATE("createdAt") as day, tier,
               COUNT(*)::int as calls,
               ROUND(SUM("costUsd")::numeric, 6) as cost
        FROM usage_events
        WHERE "createdAt" >= ${since}
          AND "isSandbox" = false
        GROUP BY DATE("createdAt"), tier
        ORDER BY day ASC
      `,
    ]);

    const latencyMap = new Map(latencyP95.map((l) => [l.model, l]));

    return reply.send({
      byModel: byModel.map((m) => {
        const lat = latencyMap.get(m.model);
        const total = m._count;
        return {
          model:    m.model,
          tier:     m.tier,
          calls:    total,
          tokensIn: m._sum.tokensIn  ?? 0,
          tokensOut: m._sum.tokensOut ?? 0,
          costUsd:  Number((m._sum.costUsd ?? 0).toFixed(4)),
          avgLatencyMs: Math.round(m._avg.latencyMs ?? 0),
          p50Ms:  Math.round(lat?.p50 ?? 0),
          p95Ms:  Math.round(lat?.p95 ?? 0),
          p99Ms:  Math.round(lat?.p99 ?? 0),
        };
      }),
      dailyByTier: dailyByTier.map((d) => ({
        day:   d.day,
        tier:  d.tier,
        calls: Number(d.calls),
        cost:  Number(d.cost),
      })),
    });
  });

  // GET /api/admin/clinics/:id/usage — detalle de uso de una clínica
  app.get<{ Params: { id: string }; Querystring: { days?: string } }>(
    "/admin/clinics/:id/usage",
    async (req, reply) => {
      if (!requireSuperAdmin(req, reply)) return;

      const { id } = req.params;
      const days = Number(req.query.days ?? 30);
      const since = new Date(Date.now() - days * 86400000);

      const [byDay, byModel, recent] = await Promise.all([
        prisma.$queryRaw<Array<{ day: string; cost: number; calls: bigint; tokens_in: bigint; tokens_out: bigint }>>`
          SELECT DATE("createdAt") as day,
                 ROUND(SUM("costUsd")::numeric, 6) as cost,
                 COUNT(*)::int as calls,
                 SUM("tokensIn")::int as tokens_in,
                 SUM("tokensOut")::int as tokens_out
          FROM usage_events
          WHERE "clinicId" = ${id}
            AND "createdAt" >= ${since}
          GROUP BY DATE("createdAt")
          ORDER BY day ASC
        `,
        prisma.usageEvent.groupBy({
          by: ["model", "tier"],
          where: { clinicId: id, createdAt: { gte: since } },
          _sum: { tokensIn: true, tokensOut: true, costUsd: true },
          _count: true,
        }),
        prisma.usageEvent.findMany({
          where: { clinicId: id },
          orderBy: { createdAt: "desc" },
          take: 50,
          select: { id: true, model: true, tier: true, tokensIn: true, tokensOut: true, costUsd: true, latencyMs: true, createdAt: true },
        }),
      ]);

      return reply.send({
        byDay: byDay.map((d) => ({
          day: d.day, cost: Number(d.cost), calls: Number(d.calls),
          tokensIn: Number(d.tokens_in), tokensOut: Number(d.tokens_out),
        })),
        byModel: byModel.map((m) => ({
          model: m.model, tier: m.tier, calls: m._count,
          tokensIn: m._sum.tokensIn ?? 0, tokensOut: m._sum.tokensOut ?? 0,
          costUsd: Number((m._sum.costUsd ?? 0).toFixed(4)),
        })),
        recent,
      });
    }
  );

  // POST /api/admin/reminders/run — trigger manual para pruebas
  app.post("/admin/reminders/run", async (req, reply) => {
    if (!requireSuperAdmin(req, reply)) return;
    try {
      await runReminderCheck();
      return reply.send({ ok: true, message: "Reminder check ejecutado" });
    } catch (err: any) {
      return reply.status(500).send({ error: err?.message ?? "Error desconocido" });
    }
  });
}
