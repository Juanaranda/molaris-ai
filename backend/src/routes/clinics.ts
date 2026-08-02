import { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import prisma from "../config/prisma";
import { verifyToken } from "./auth";
import { sendWhatsAppMessage } from "../services/notifications/whatsappService";
import { notifyWaitlistForCanceledBooking } from "../services/waitlist/waitlistService";
import { triggerAlert } from "../services/alerts/alertService";
import { audit } from "../services/audit/auditService";
import { isValidRut, formatRut } from "../lib/rut";
import { sendMolariEmail } from "../services/email/molariEmails";

// Claves válidas dentro de Clinic.config. Evita inyectar JSON arbitrario, pero
// debe cubrir TODO lo que escribe el frontend: si falta una, el PATCH completo
// falla con 400 y no se guarda nada (pasó con "onboardingDone" y rompió el
// cierre del onboarding). Al agregar una clave nueva en el front, sumarla acá.
export const ALLOWED_CONFIG_KEYS = new Set([
  "tone", "schedule", "doctors", "services", "boxes", "reminders", "onboardingDone",
  // Sedes donde atiende el doctor independiente (#69 Fase 4)
  "sedes",
  // Nombre del asistente IA (lo siembra el seed y lo edita ClinicProfileTab) y
  // logo de la clínica (base64). Faltaban: como el front reenvía la config
  // completa al guardar, cualquier edición de doctores/servicios/horario moría
  // con 400 en clínicas que tenían assistantName.
  "assistantName", "logoUrl",
  // Horario estructurado por día (la agenda y la disponibilidad lo usan para
  // decidir qué horas ofrecer). "schedule" queda como el texto derivado que
  // lee el asistente.
  "openingHours",
]);

// Tope de profesionales en cuentas "solo" (#69). Protege el pricing: evita que
// una clínica chica se registre en el plan barato y cargue a todo su equipo.
export const MAX_SOLO_DOCTORS = 1;

// Versión vigente del DPA Molaris ↔ Clínica (Issue #38, Ley 21.719).
// BORRADOR — pendiente validación legal. Subir la versión cuando cambie el texto.
export const DPA_VERSION = "2026-06-draft";

export async function clinicRoutes(app: FastifyInstance) {

  // GET /api/clinics/:id/analytics
  app.get<{ Params: { id: string }; Querystring: { days?: string } }>(
    "/clinics/:id/analytics",
    async (req, reply) => {
      let payload;
      try { payload = verifyToken(req.headers.authorization); } catch {
        return reply.status(401).send({ error: "No autorizado" });
      }
      if (payload.role !== "SUPERADMIN" && payload.clinicId !== req.params.id) {
        return reply.status(403).send({ error: "Acceso denegado" });
      }

      const clinicId = req.params.id;
      const days = Number(req.query.days ?? 30);
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

      // BUG FIX #9: include slotBooked in the main Promise.all to avoid a
      // sequential await that unnecessarily extends response time.
      const [
        totalSessions,
        totalLeads,
        intentCounts,
        urgencyCounts,
        topServices,
        avgScoreAgg,
        totalBookings,
        recentLeads,
        sessionsByDay,
        paymentThisMonth,
        paymentLastMonth,
        paymentByStatus,
        incomeByMonth,
        doctorBookings,
        doctorCancellations,
        doctorIncome,
        cancelledTotal,
        bookingsByDow,
        uniquePatients,
        newPatientsThisMonth,
        returningPatients,
        incomeByService,
        avgTicket,
        bookingsByHour,
        slotBooked,
        channelBreakdown,
      ] = await Promise.all([
        // Total conversaciones (excluye sandbox y demo interna)
        prisma.session.count({ where: { clinicId, isSandbox: false, channel: { not: "demo" } } }),

        // Leads (sesiones con contexto capturado, excluye sandbox)
        prisma.patientContext.count({ where: { session: { clinicId, isSandbox: false } } }),

        // Desglose por intent
        prisma.patientContext.groupBy({
          by: ["intent"],
          where: { session: { clinicId, isSandbox: false }, intent: { not: null } },
          _count: true,
        }),

        // Desglose por urgencia
        prisma.patientContext.groupBy({
          by: ["urgency"],
          where: { session: { clinicId, isSandbox: false }, urgency: { not: null } },
          _count: true,
        }),

        // Top servicios
        prisma.patientContext.groupBy({
          by: ["serviceInterest"],
          where: { session: { clinicId, isSandbox: false }, serviceInterest: { not: null } },
          _count: { serviceInterest: true },
          orderBy: { _count: { serviceInterest: "desc" } },
          take: 6,
        }),

        // Score promedio
        prisma.patientContext.aggregate({
          where: { session: { clinicId, isSandbox: false }, score: { not: null } },
          _avg: { score: true },
        }),

        // Citas agendadas (booking page)
        prisma.booking.count({ where: { clinicId } }),

        // Leads recientes con detalle (excluye sandbox)
        prisma.patientContext.findMany({
          where: { session: { clinicId, isSandbox: false } },
          include: { session: { select: { createdAt: true, channel: true } } },
          orderBy: { session: { createdAt: "desc" } },
          take: 25,
        }),

        // Sesiones por día (últimos N días, excluye sandbox)
        prisma.$queryRaw<Array<{ day: string; count: bigint }>>`
          SELECT DATE(s."createdAt") as day, COUNT(*)::int as count
          FROM sessions s
          WHERE s."clinicId" = ${clinicId}
            AND s."createdAt" >= ${since}
            AND s."isSandbox" = false
          GROUP BY DATE(s."createdAt")
          ORDER BY day ASC
        `,

        // Ingresos este mes
        prisma.booking.aggregate({
          where: { clinicId, paymentStatus: { in: ["paid", "partial"] }, paidAt: { gte: monthStart } },
          _sum: { amountPaid: true },
          _count: true,
        }),

        // Ingresos mes anterior
        prisma.booking.aggregate({
          where: { clinicId, paymentStatus: { in: ["paid", "partial"] }, paidAt: { gte: prevMonthStart, lt: monthStart } },
          _sum: { amountPaid: true },
          _count: true,
        }),

        // Desglose por paymentStatus
        prisma.booking.groupBy({
          by: ["paymentStatus"],
          where: { clinicId, status: { not: "cancelled" }, paymentStatus: { not: null } },
          _count: true,
          _sum: { amountTotal: true, amountPaid: true },
        }),

        // Ingresos por mes (últimos 6 meses)
        prisma.$queryRaw<Array<{ month: string; income: number; count: bigint }>>`
          SELECT
            TO_CHAR("paidAt", 'YYYY-MM') as month,
            COALESCE(SUM("amountPaid"), 0)::float as income,
            COUNT(*)::int as count
          FROM bookings
          WHERE "clinicId" = ${clinicId}
            AND "paymentStatus" IN ('paid', 'partial')
            AND "paidAt" >= ${new Date(now.getFullYear(), now.getMonth() - 5, 1)}
          GROUP BY TO_CHAR("paidAt", 'YYYY-MM')
          ORDER BY month ASC
        `,

        // Citas activas por doctor
        prisma.booking.groupBy({
          by: ["doctor"],
          where: { clinicId, status: { not: "cancelled" } },
          _count: true,
        }),

        // Cancelaciones por doctor
        prisma.booking.groupBy({
          by: ["doctor"],
          where: { clinicId, status: "cancelled" },
          _count: true,
        }),

        // Ingresos por doctor
        prisma.booking.groupBy({
          by: ["doctor"],
          where: { clinicId, paymentStatus: { in: ["paid", "partial"] } },
          _sum: { amountPaid: true },
          _count: true,
        }),

        // Total citas canceladas (para tasa global)
        prisma.booking.count({ where: { clinicId, status: "cancelled" } }),

        // Citas por día de semana (0=Dom … 6=Sáb)
        prisma.$queryRaw<Array<{ dow: number; count: bigint }>>`
          SELECT EXTRACT(DOW FROM date)::int as dow, COUNT(*)::int as count
          FROM bookings
          WHERE "clinicId" = ${clinicId} AND status != 'cancelled'
          GROUP BY EXTRACT(DOW FROM date)
          ORDER BY dow
        `,

        // Pacientes únicos histórico
        prisma.$queryRaw<Array<{ total: bigint }>>`
          SELECT COUNT(DISTINCT COALESCE("patientRut", LOWER(TRIM("patientName")))) as total
          FROM bookings
          WHERE "clinicId" = ${clinicId} AND status != 'cancelled' AND "patientName" IS NOT NULL
        `,

        // Pacientes cuya primera cita fue este mes
        prisma.$queryRaw<Array<{ total: bigint }>>`
          SELECT COUNT(*) as total FROM (
            SELECT COALESCE("patientRut", LOWER(TRIM("patientName"))) as pid,
                   MIN(date) as first_date
            FROM bookings
            WHERE "clinicId" = ${clinicId} AND status != 'cancelled' AND "patientName" IS NOT NULL
            GROUP BY pid
            HAVING MIN(date) >= ${monthStart}
          ) sub
        `,

        // Pacientes que han vuelto (>1 cita)
        prisma.$queryRaw<Array<{ total: bigint }>>`
          SELECT COUNT(*) as total FROM (
            SELECT COALESCE("patientRut", LOWER(TRIM("patientName"))) as pid
            FROM bookings
            WHERE "clinicId" = ${clinicId} AND status != 'cancelled' AND "patientName" IS NOT NULL
            GROUP BY pid
            HAVING COUNT(*) > 1
          ) sub
        `,

        // Ingresos y citas por servicio
        prisma.booking.groupBy({
          by: ["service"],
          where: { clinicId, service: { not: null }, status: { not: "cancelled" } },
          _count: true,
          _sum: { amountPaid: true },
          orderBy: { _count: { service: "desc" } },
          take: 10,
        }),

        // Ticket promedio (citas con pago registrado)
        prisma.booking.aggregate({
          where: { clinicId, paymentStatus: { in: ["paid", "partial"] }, amountPaid: { gt: 0 } },
          _avg: { amountPaid: true },
          _count: true,
        }),

        // Citas por hora del día
        prisma.$queryRaw<Array<{ hour: number; count: bigint }>>`
          SELECT CAST(SPLIT_PART(time, ':', 1) AS INT) as hour, COUNT(*)::int as count
          FROM bookings
          WHERE "clinicId" = ${clinicId} AND status != 'cancelled'
          GROUP BY SPLIT_PART(time, ':', 1)
          ORDER BY hour
        `,

        // Slots reservados vía chat (parte del Bug Fix #9 — movido al Promise.all)
        prisma.patientContext.count({ where: { session: { clinicId }, slotBooked: true } }),

        // Conversaciones agrupadas por canal (web / whatsapp / instagram)
        prisma.$queryRaw<Array<{ channel: string; sessions: bigint; leads: bigint; booked: bigint }>>`
          SELECT
            s.channel,
            COUNT(*)::int                                                       as sessions,
            COUNT(pc.id)::int                                                   as leads,
            COUNT(pc.id) FILTER (WHERE pc."slotBooked" = true)::int             as booked
          FROM sessions s
          LEFT JOIN patient_contexts pc ON pc."sessionId" = s.id
          WHERE s."clinicId" = ${clinicId}
            AND s."isSandbox" = false
            AND s.channel <> 'demo'
          GROUP BY s.channel
          ORDER BY sessions DESC
        `,
      ]);

      const readyToBook = intentCounts.find((i) => i.intent === "ready_to_book")?._count ?? 0;

      return reply.send({
        totals: {
          sessions: totalSessions,
          leads: totalLeads,
          readyToBook,
          slotBooked,
          bookings: totalBookings,
          avgScore: Math.round(avgScoreAgg._avg.score ?? 0),
        },
        conversionRate: totalLeads > 0 ? Math.round((readyToBook / totalLeads) * 100) : 0,
        bookingRate: totalLeads > 0 ? Math.round(((slotBooked + totalBookings) / totalLeads) * 100) : 0,
        intentBreakdown: intentCounts.map((i) => ({ intent: i.intent, count: i._count })),
        urgencyBreakdown: urgencyCounts.map((u) => ({ urgency: u.urgency, count: u._count })),
        topServices: topServices.map((s) => ({ name: s.serviceInterest!, count: s._count.serviceInterest })),
        recentLeads: recentLeads.map((l) => ({
          id: l.id,
          patientName: l.patientName,
          serviceInterest: l.serviceInterest,
          intent: l.intent,
          urgency: l.urgency,
          score: l.score,
          slotBooked: l.slotBooked,
          channel: l.session.channel,
          createdAt: l.session.createdAt,
        })),
        sessionsByDay: sessionsByDay.map((r) => ({ day: r.day, count: Number(r.count) })),
        doctors: doctorBookings.map((d) => {
          const cancelled = doctorCancellations.find((c) => c.doctor === d.doctor)?._count ?? 0;
          const income    = doctorIncome.find((i) => i.doctor === d.doctor)?._sum?.amountPaid ?? 0;
          const total     = d._count + cancelled;
          return {
            doctor: d.doctor,
            bookings: d._count,
            cancelled,
            cancellationRate: total > 0 ? Math.round((cancelled / total) * 100) : 0,
            income: income ?? 0,
          };
        }).sort((a, b) => b.bookings - a.bookings),
        patients: {
          total: Number((uniquePatients[0] as { total: bigint } | undefined)?.total ?? 0),
          newThisMonth: Number((newPatientsThisMonth[0] as { total: bigint } | undefined)?.total ?? 0),
          returning: Number((returningPatients[0] as { total: bigint } | undefined)?.total ?? 0),
          retentionRate: (() => {
            const total = Number((uniquePatients[0] as { total: bigint } | undefined)?.total ?? 0);
            const ret   = Number((returningPatients[0] as { total: bigint } | undefined)?.total ?? 0);
            return total > 0 ? Math.round((ret / total) * 100) : 0;
          })(),
        },
        operations: {
          cancellationRate: totalBookings + cancelledTotal > 0
            ? Math.round((cancelledTotal / (totalBookings + cancelledTotal)) * 100) : 0,
          bookingsByDow: bookingsByDow.map((r) => ({ dow: Number(r.dow), count: Number(r.count) })),
          bookingsByHour: bookingsByHour.map((r) => ({ hour: Number(r.hour), count: Number(r.count) })),
          avgTicket: Math.round(avgTicket._avg.amountPaid ?? 0),
          paidBookings: avgTicket._count,
        },
        services: (incomeByService as { service: string | null; _count: number; _sum: { amountPaid: number | null } }[])
          .filter((s) => s.service)
          .map((s) => ({
            service: s.service!,
            count: s._count,
            income: s._sum.amountPaid ?? 0,
          })),
        channels: channelBreakdown.map((c) => ({
          channel: c.channel,
          sessions: Number(c.sessions),
          leads:    Number(c.leads),
          booked:   Number(c.booked),
          conversionRate: Number(c.sessions) > 0
            ? Math.round((Number(c.booked) / Number(c.sessions)) * 100)
            : 0,
        })),
        payments: {
          thisMonth: {
            income: paymentThisMonth._sum.amountPaid ?? 0,
            count: paymentThisMonth._count,
          },
          lastMonth: {
            income: paymentLastMonth._sum.amountPaid ?? 0,
            count: paymentLastMonth._count,
          },
          byStatus: paymentByStatus.map((p) => ({
            status: p.paymentStatus,
            count: p._count,
            totalCharged: p._sum.amountTotal ?? 0,
            totalPaid: p._sum.amountPaid ?? 0,
          })),
          incomeByMonth: incomeByMonth.map((r) => ({
            month: r.month,
            income: Number(r.income),
            count: Number(r.count),
          })),
        },
      });
    }
  );

  // GET /api/clinics/:id
  app.get<{ Params: { id: string } }>("/clinics/:id", async (req, reply) => {
    let payload;
    try {
      payload = verifyToken(req.headers.authorization);
    } catch {
      return reply.status(401).send({ error: "No autorizado" });
    }

    // SUPERADMIN puede ver cualquier clínica; el resto solo la suya
    if (payload.role !== "SUPERADMIN" && payload.clinicId !== req.params.id) {
      return reply.status(403).send({ error: "Acceso denegado" });
    }

    const clinic = await prisma.clinic.findUnique({ where: { id: req.params.id } });
    if (!clinic) return reply.status(404).send({ error: "Clínica no encontrada" });

    return reply.send(clinic);
  });

  // PATCH /api/clinics/:id  — solo ADMIN o SUPERADMIN
  app.patch<{
    Params: { id: string };
    Body: {
      name?: string;
      phone?: string;
      whatsapp?: string;
      instagram?: string;
      location?: string;
      config?: Record<string, unknown>;
    };
  }>("/clinics/:id", async (req, reply) => {
    let payload;
    try {
      payload = verifyToken(req.headers.authorization);
    } catch {
      return reply.status(401).send({ error: "No autorizado" });
    }

    if (payload.role === "USER") {
      return reply.status(403).send({ error: "Sin permisos para editar" });
    }

    if (payload.role === "ADMIN" && payload.clinicId !== req.params.id) {
      return reply.status(403).send({ error: "Acceso denegado" });
    }

    const { name, phone, whatsapp, instagram, location, config } = req.body ?? {};

    // BUG FIX #5: validate that config only contains known keys to prevent
    // arbitrary JSON injection into the clinic config object.
    if (config !== undefined) {
      const unknownKeys = Object.keys(config).filter((k) => !ALLOWED_CONFIG_KEYS.has(k));
      if (unknownKeys.length > 0) {
        return reply.status(400).send({ error: `Claves de config no permitidas: ${unknownKeys.join(", ")}` });
      }

      // Cap de 1 profesional en cuentas "solo" (#69). Es el límite que protege
      // el pricing: sin esto una clínica de 3 dentistas se registra en el plan
      // barato y carga a todo el equipo. Se valida en el backend porque
      // esconder el botón en el front no impide un PATCH directo.
      if (Array.isArray((config as { doctors?: unknown[] }).doctors)) {
        const clinic = await prisma.clinic.findUnique({
          where: { id: req.params.id },
          select: { accountType: true },
        });
        const doctors = (config as { doctors: unknown[] }).doctors;
        if (clinic?.accountType === "solo" && doctors.length > MAX_SOLO_DOCTORS) {
          return reply.status(400).send({
            error: `El plan Solo permite ${MAX_SOLO_DOCTORS} profesional. Para trabajar con un equipo, cambia al plan Clínica.`,
          });
        }
      }
    }

    const updated = await prisma.clinic.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
        ...(whatsapp !== undefined && { whatsapp }),
        ...(instagram !== undefined && { instagram }),
        ...(location !== undefined && { location }),
        ...(config !== undefined && { config: config as Prisma.InputJsonValue }),
      },
    });

    return reply.send(updated);
  });

  // GET /api/clinics/:id/bookings
  app.get<{ Params: { id: string }; Querystring: { status?: string; from?: string; to?: string; doctor?: string } }>(
    "/clinics/:id/bookings",
    async (req, reply) => {
      let payload;
      try { payload = verifyToken(req.headers.authorization); } catch {
        return reply.status(401).send({ error: "No autorizado" });
      }
      if (payload.role !== "SUPERADMIN" && payload.clinicId !== req.params.id) {
        return reply.status(403).send({ error: "Acceso denegado" });
      }

      const { status, from, to, doctor } = req.query;

      const bookings = await prisma.booking.findMany({
        where: {
          clinicId: req.params.id,
          ...(status && status !== "all" ? { status } : {}),
          ...(doctor ? { doctor: { contains: doctor, mode: "insensitive" } } : {}),
          ...(from || to ? {
            date: {
              ...(from ? { gte: new Date(from + "T00:00:00") } : {}),
              ...(to   ? { lte: new Date(to   + "T23:59:59") } : {}),
            },
          } : {}),
        },
        orderBy: { date: "desc" },
        take: 100,
        include: {
          patientUser: {
            include: { identity: { select: { firstName: true, lastName: true, phone: true, email: true } } },
          },
        },
      });

      return reply.send({ bookings });
    }
  );

  // PATCH /api/clinics/:id/bookings/:bookingId/status
  app.patch<{ Params: { id: string; bookingId: string }; Body: { status: string } }>(
    "/clinics/:id/bookings/:bookingId/status",
    async (req, reply) => {
      let payload;
      try { payload = verifyToken(req.headers.authorization); } catch {
        return reply.status(401).send({ error: "No autorizado" });
      }
      if (payload.role === "USER") return reply.status(403).send({ error: "Sin permisos" });
      if (payload.role !== "SUPERADMIN" && payload.clinicId !== req.params.id) {
        return reply.status(403).send({ error: "Acceso denegado" });
      }

      const { status } = req.body ?? {};
      if (!["pending", "confirmed", "cancelled"].includes(status)) {
        return reply.status(400).send({ error: "Estado inválido" });
      }

      const booking = await prisma.booking.findFirst({
        where: { id: req.params.bookingId, clinicId: req.params.id },
      });
      if (!booking) return reply.status(404).send({ error: "Cita no encontrada" });

      const updated = await prisma.booking.update({
        where: { id: booking.id },
        data: { status },
      });

      // Hook: si se canceló, intentar notificar al primero de la lista de espera (async)
      if (booking.status !== "cancelled" && status === "cancelled") {
        notifyWaitlistForCanceledBooking(booking.id)
          .catch((e) => console.error("[Waitlist] notify failed:", e));
      }

      return reply.send(updated);
    }
  );

  // ════════════════════════════════════════════════════════════════════════════
  // KILL SWITCH DEL AGENTE IA (Issue #49)
  // ════════════════════════════════════════════════════════════════════════════

  // GET /api/clinics/:id/agent — estado del agente
  app.get<{ Params: { id: string } }>("/clinics/:id/agent", async (req, reply) => {
    let payload;
    try { payload = verifyToken(req.headers.authorization); }
    catch { return reply.status(401).send({ error: "No autorizado" }); }
    if (payload.role !== "SUPERADMIN" && payload.clinicId !== req.params.id) {
      return reply.status(403).send({ error: "Acceso denegado" });
    }
    const c = await prisma.clinic.findUnique({
      where: { id: req.params.id },
      select: { agentEnabled: true, agentDisabledAt: true, agentDisabledReason: true },
    });
    if (!c) return reply.status(404).send({ error: "Clínica no encontrada" });
    return reply.send(c);
  });

  // PATCH /api/clinics/:id/agent — encender/apagar el agente IA
  app.patch<{
    Params: { id: string };
    Body: { enabled: boolean; reason?: string };
  }>("/clinics/:id/agent", async (req, reply) => {
    let payload;
    try { payload = verifyToken(req.headers.authorization); }
    catch { return reply.status(401).send({ error: "No autorizado" }); }
    if (payload.role === "USER") return reply.status(403).send({ error: "Sin permisos" });
    if (payload.role !== "SUPERADMIN" && payload.clinicId !== req.params.id) {
      return reply.status(403).send({ error: "Acceso denegado" });
    }

    const { enabled, reason } = req.body ?? {};
    if (typeof enabled !== "boolean") {
      return reply.status(400).send({ error: "El campo 'enabled' es obligatorio (true/false)" });
    }

    const clinic = await prisma.clinic.findUnique({ where: { id: req.params.id }, select: { name: true } });
    if (!clinic) return reply.status(404).send({ error: "Clínica no encontrada" });

    const updated = await prisma.clinic.update({
      where: { id: req.params.id },
      data: enabled
        ? { agentEnabled: true, agentDisabledAt: null, agentDisabledReason: null, agentDisabledBy: null }
        // "manual" bloquea la auto-recuperación (#58): si alguien apagó el
        // agente a propósito, el sistema no puede volver a encenderlo solo.
        : { agentEnabled: false, agentDisabledAt: new Date(), agentDisabledReason: reason?.trim() || null, agentDisabledBy: "manual" },
      select: { agentEnabled: true, agentDisabledAt: true, agentDisabledReason: true, agentDisabledBy: true },
    });

    // Auditoría
    audit({
      req, actorId: payload.userId, clinicId: req.params.id,
      action: "update", resourceType: "ClinicalRecord", resourceId: req.params.id,
      snapshotAfter: { agentEnabled: enabled, reason: reason ?? null },
    });

    // Alerta al proveedor (panel de monitoreo + WhatsApp)
    triggerAlert({
      kind: enabled ? "agent_enabled" : "agent_disabled",
      severity: enabled ? "info" : "warn",
      message: `Agente ${enabled ? "ENCENDIDO" : "APAGADO"} en ${clinic.name}`,
      detail: { clinicId: req.params.id, reason: reason ?? null },
      cooldownMs: 0,
    }).catch(() => {});

    return reply.send(updated);
  });

  // POST /api/clinics — registro público de nueva clínica + admin
  app.post<{
    Body: {
      clinic: { name: string; phone?: string; location?: string; instagram?: string; whatsapp?: string; professionalRut?: string; professionalRegNumber?: string; accountType?: string; specialty?: string };
      admin: { name: string; email: string; password: string };
      acceptedTerms?: boolean;
    };
  }>("/clinics", async (req, reply) => {
    const { clinic: clinicData, admin, acceptedTerms } = req.body ?? {};
    if (!clinicData?.name || !admin?.email || !admin?.password || !admin?.name) {
      return reply.status(400).send({ error: "Nombre de clínica, nombre, email y contraseña son requeridos" });
    }
    // KYC (#66): RUT del profesional responsable — opcional al registrar, pero si viene se valida.
    let professionalRut: string | null = null;
    if (clinicData.professionalRut && clinicData.professionalRut.trim()) {
      if (!isValidRut(clinicData.professionalRut)) {
        return reply.status(400).send({ error: "RUT inválido — revisa el dígito verificador" });
      }
      professionalRut = formatRut(clinicData.professionalRut);
    }
    if (!acceptedTerms) {
      return reply.status(400).send({ error: "Debes aceptar los Términos y Condiciones para continuar" });
    }
    if (admin.password.length < 8) {
      return reply.status(400).send({ error: "La contraseña debe tener al menos 8 caracteres" });
    }

    const existing = await prisma.partnerUser.findUnique({ where: { email: admin.email.toLowerCase().trim() } });
    if (existing) {
      return reply.status(409).send({ error: "Ya existe una cuenta con ese email" });
    }

    // Generar slug desde el nombre
    const baseSlug = clinicData.name
      .toLowerCase()
      .normalize("NFD").replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);

    // BUG FIX #4: resolve slug uniqueness in a single DB round trip instead
    // of N sequential findUnique calls inside a while loop.
    const existingSlugs = await prisma.clinic.findMany({
      where: { slug: { startsWith: baseSlug } },
      select: { slug: true },
    });
    const slugSet = new Set(existingSlugs.map((c) => c.slug));
    let slug = baseSlug;
    let counter = 1;
    while (slugSet.has(slug)) {
      slug = `${baseSlug}-${counter++}`;
    }

    const passwordHash = await bcrypt.hash(admin.password, 12);

    // Tipo de cuenta (#69): "solo" = doctor independiente. Se auto-registra como el
    // único profesional del tenant, con su especialidad. "clinic" = flujo normal.
    const accountType = clinicData.accountType === "solo" ? "solo" : "clinic";
    const soloSpecialty = clinicData.specialty?.trim() || "Odontología General";
    const soloDoctors = accountType === "solo"
      ? [{
          name: admin.name,
          specialty: soloSpecialty,
          days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
        }]
      : [];
    const soloServices = accountType === "solo" ? [soloSpecialty] : [];

    const newClinic = await prisma.clinic.create({
      data: {
        slug,
        name: clinicData.name,
        phone: clinicData.phone ?? null,
        location: clinicData.location ?? null,
        instagram: clinicData.instagram ?? null,
        whatsapp: clinicData.whatsapp ?? null,
        plan: "starter",
        accountType,
        // DPA aceptado al crear cuenta (Issue #38, Ley 21.719)
        dpaAcceptedVersion: DPA_VERSION,
        dpaAcceptedAt: new Date(),
        // KYC (#66): queda PENDING hasta aprobación manual del SUPERADMIN
        professionalRut,
        professionalRegNumber: clinicData.professionalRegNumber?.trim() || null,
        config: {
          tone: "profesional pero cercano",
          schedule: { weekdays: "Lunes a Viernes: 09:00 - 18:00", saturday: "Sábado: cerrado", sunday: "Domingo: cerrado" },
          doctors: soloDoctors,
          services: soloServices,
          boxes: 1,
        },
        partnerUsers: {
          create: {
            name: admin.name,
            email: admin.email.toLowerCase().trim(),
            passwordHash,
            role: "ADMIN",
            acceptedTermsAt: new Date(),
          },
        },
      },
    });

    // Email de bienvenida de molari (empresa → nuevo cliente). No bloqueante:
    // si el envío falla, el registro igual se completa.
    sendMolariEmail({
      to: admin.email.toLowerCase().trim(),
      toName: admin.name,
      message: { type: "welcome", accountType, clinicName: clinicData.name },
    }).catch((err) => console.error("[welcome-email] fallo el envío:", err instanceof Error ? err.message : err));

    return reply.status(201).send({ clinicId: newClinic.id, slug: newClinic.slug, message: "Clínica registrada correctamente" });
  });

  // DELETE /api/clinics/:id — baja de cuenta / derecho de supresión (Ley 21.719)
  // SUPERADMIN puede eliminar cualquier clínica. El ADMIN dueño puede eliminar la
  // suya confirmando su contraseña (acción irreversible). Borra en cascada TODOS
  // los datos de la clínica dentro de una transacción: si algo falla, no borra nada.
  app.delete<{ Params: { id: string }; Body: { password?: string } }>(
    "/clinics/:id",
    async (req, reply) => {
      let payload;
      try { payload = verifyToken(req.headers.authorization); }
      catch { return reply.status(401).send({ error: "No autorizado" }); }

      if (payload.role === "USER") {
        return reply.status(403).send({ error: "Sin permisos para eliminar la clínica" });
      }
      const clinicId = req.params.id;

      // ADMIN: solo su propia clínica y con confirmación de contraseña
      if (payload.role === "ADMIN") {
        if (payload.clinicId !== clinicId) {
          return reply.status(403).send({ error: "Acceso denegado" });
        }
        const password = req.body?.password;
        if (!password) {
          return reply.status(400).send({ error: "Confirma tu contraseña para eliminar la clínica" });
        }
        const me = await prisma.partnerUser.findUnique({ where: { id: payload.userId } });
        if (!me || !(await bcrypt.compare(password, me.passwordHash))) {
          return reply.status(403).send({ error: "Contraseña incorrecta" });
        }
      }

      const clinic = await prisma.clinic.findUnique({
        where: { id: clinicId },
        select: { id: true, name: true, slug: true },
      });
      if (!clinic) return reply.status(404).send({ error: "Clínica no encontrada" });

      // Orden de borrado por dependencias de FK (hijos → padres). Las tablas con
      // onDelete: Cascade (DentalEventSurface, DentalQuoteItem) caen con su padre.
      // Identity NO se borra: es compartida entre clínicas (RUT del paciente).
      await prisma.$transaction([
        prisma.message.deleteMany({ where: { session: { clinicId } } }),
        prisma.patientContext.deleteMany({ where: { session: { clinicId } } }),
        prisma.patientConsent.deleteMany({ where: { patientUser: { clinicId } } }),
        prisma.recallEvent.deleteMany({ where: { clinicId } }),
        prisma.inventoryMovement.deleteMany({ where: { clinicId } }),
        prisma.consentSignature.deleteMany({ where: { clinicId } }),
        prisma.payment.deleteMany({ where: { clinicId } }),
        prisma.boleta.deleteMany({ where: { clinicId } }),
        prisma.accountEntry.deleteMany({ where: { clinicId } }),
        prisma.usageEvent.deleteMany({ where: { clinicId } }),
        prisma.clinicalNote.deleteMany({ where: { clinicId } }),
        prisma.dentalEvent.deleteMany({ where: { clinicId } }),
        prisma.toothImage.deleteMany({ where: { clinicId } }),
        prisma.anamnesisResponse.deleteMany({ where: { clinicId } }),
        prisma.labOrder.deleteMany({ where: { clinicId } }),
        prisma.booking.deleteMany({ where: { clinicId } }),
        prisma.treatmentPlan.deleteMany({ where: { clinicId } }),
        prisma.dentalQuote.deleteMany({ where: { clinicId } }),
        prisma.inventoryItem.deleteMany({ where: { clinicId } }),
        prisma.recallRule.deleteMany({ where: { clinicId } }),
        prisma.consentTemplate.deleteMany({ where: { clinicId } }),
        prisma.anamnesisTemplate.deleteMany({ where: { clinicId } }),
        prisma.waitlistEntry.deleteMany({ where: { clinicId } }),
        prisma.auditLog.deleteMany({ where: { clinicId } }),
        prisma.session.deleteMany({ where: { clinicId } }),
        prisma.patient.deleteMany({ where: { clinicId } }),
        prisma.patientUser.deleteMany({ where: { clinicId } }),
        prisma.partnerUser.deleteMany({ where: { clinicId } }),
        prisma.clinic.delete({ where: { id: clinicId } }),
      ]);

      console.warn(`[clinic-delete] Clínica ${clinic.slug} (${clinicId}) eliminada por ${payload.role} ${payload.userId}`);
      return reply.send({ ok: true, deleted: { id: clinic.id, slug: clinic.slug, name: clinic.name } });
    }
  );

  // POST /api/clinics/:id/recall/run — dispara campaña de recall manual
  app.post<{
    Params: { id: string };
    Body: { daysInactive?: number; message?: string };
  }>("/clinics/:id/recall/run", async (req, reply) => {
    let payload;
    try { payload = verifyToken(req.headers.authorization); } catch {
      return reply.status(401).send({ error: "No autorizado" });
    }
    if (payload.role === "USER") return reply.status(403).send({ error: "Sin permisos" });
    if (payload.role !== "SUPERADMIN" && payload.clinicId !== req.params.id) {
      return reply.status(403).send({ error: "Acceso denegado" });
    }

    const daysInactive = req.body?.daysInactive ?? 90;
    const message = req.body?.message ?? "Hola {nombre}, te echamos de menos en {clinica}. ¿Qué tal si agendamos tu próximo control?";
    const cutoff = new Date(Date.now() - daysInactive * 24 * 60 * 60 * 1000);

    const clinic = await prisma.clinic.findUnique({
      where: { id: req.params.id },
      select: { name: true, slug: true, waVerified: true, waPhoneId: true, waToken: true },
    });
    if (!clinic) return reply.status(404).send({ error: "Clínica no encontrada" });

    const clinicMeta = (clinic.waVerified && clinic.waPhoneId && clinic.waToken)
      ? { phoneId: clinic.waPhoneId, token: clinic.waToken }
      : undefined;

    // Última cita por teléfono (solo pacientes con teléfono)
    const lastBookings = await prisma.booking.findMany({
      where: { clinicId: req.params.id, patientPhone: { not: null }, status: { not: "cancelled" } },
      orderBy: { date: "desc" },
      select: { patientPhone: true, patientName: true, date: true },
    });

    // Agrupar por teléfono — solo la más reciente
    const byPhone = new Map<string, { name: string | null; lastDate: Date }>();
    for (const b of lastBookings) {
      if (!b.patientPhone) continue;
      const phone = b.patientPhone.replace(/\D/g, "");
      if (!byPhone.has(phone)) byPhone.set(phone, { name: b.patientName, lastDate: b.date });
    }

    // Filtrar inactivos
    const targets: { phone: string; name: string | null }[] = [];
    for (const [phone, { name, lastDate }] of byPhone) {
      if (lastDate < cutoff) targets.push({ phone, name });
    }

    // Envío en paralelo (usa Meta si la clínica está verificada, fallback a Twilio)
    const results = await Promise.allSettled(
      targets.map((t) => {
        const body = message
          .replace("{nombre}", t.name?.split(" ")[0] ?? "")
          .replace("{clinica}", clinic.name);
        return sendWhatsAppMessage(t.phone, body, clinicMeta);
      })
    );
    const sent = results.filter((r) => r.status === "fulfilled").length;

    return reply.send({ sent, total: targets.length, daysInactive });
  });

  // POST /api/clinics/:id/survey/send — envía encuesta post-cita a un paciente
  app.post<{
    Params: { id: string };
    Body: { phone: string; patientName?: string; clinicName?: string };
  }>("/clinics/:id/survey/send", async (req, reply) => {
    let payload;
    try { payload = verifyToken(req.headers.authorization); } catch {
      return reply.status(401).send({ error: "No autorizado" });
    }
    if (payload.role === "USER") return reply.status(403).send({ error: "Sin permisos" });
    if (payload.role !== "SUPERADMIN" && payload.clinicId !== req.params.id) {
      return reply.status(403).send({ error: "Acceso denegado" });
    }

    const { phone, patientName, clinicName } = req.body ?? {};
    if (!phone) return reply.status(400).send({ error: "Teléfono requerido" });

    const clinic = await prisma.clinic.findUnique({
      where: { id: req.params.id },
      select: { waVerified: true, waPhoneId: true, waToken: true },
    });
    const clinicMeta = (clinic?.waVerified && clinic.waPhoneId && clinic.waToken)
      ? { phoneId: clinic.waPhoneId, token: clinic.waToken }
      : undefined;

    const name = patientName?.split(" ")[0] ?? "";
    const body = `Hola ${name}! 😊 Gracias por visitar ${clinicName ?? "nuestra clínica"}. ¿Cómo fue tu experiencia? ¿Nos dejarías una reseña en Google? Tu opinión nos ayuda mucho 🙏`;
    await sendWhatsAppMessage(phone, body, clinicMeta);

    return reply.send({ ok: true });
  });

  // ════════════════════════════════════════════════════════════════════════
  // GESTIÓN DE EQUIPO — usuarios de la clínica
  // Permisos: ADMIN/SUPERADMIN. ADMIN solo de su propia clínica.
  // ════════════════════════════════════════════════════════════════════════

  function guardTeamAccess(req: { headers: { authorization?: string }; params: { id: string } }):
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

  // GET /api/clinics/:id/users — lista usuarios de la clínica
  app.get<{ Params: { id: string } }>("/clinics/:id/users", async (req, reply) => {
    const guard = guardTeamAccess(req);
    if (!guard.ok) return reply.status(guard.status).send({ error: guard.error });

    const users = await prisma.partnerUser.findMany({
      where: { clinicId: req.params.id },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      select: {
        id: true, name: true, email: true, role: true, clinicalRole: true, active: true,
        photoUrl: true, occupation: true, phone: true, bio: true,
        createdAt: true,
      },
    });
    return reply.send({ users });
  });

  // POST /api/clinics/:id/users — invitar nuevo usuario (genera password temporal)
  app.post<{
    Params: { id: string };
    Body:   { name: string; email: string; role?: "USER" | "ADMIN"; occupation?: string };
  }>("/clinics/:id/users", async (req, reply) => {
    const guard = guardTeamAccess(req);
    if (!guard.ok) return reply.status(guard.status).send({ error: guard.error });

    const { name, email, role, occupation } = req.body ?? {};
    if (!name?.trim() || !email?.trim()) {
      return reply.status(400).send({ error: "Nombre y email son requeridos" });
    }
    const normalizedEmail = email.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return reply.status(400).send({ error: "Email inválido" });
    }
    const finalRole = role === "ADMIN" ? "ADMIN" : "USER";
    // Solo SUPERADMIN puede crear otros SUPERADMIN (no permitimos crear esa jerarquía acá)
    if (role && !["USER", "ADMIN"].includes(role)) {
      return reply.status(400).send({ error: "Rol inválido" });
    }

    const existing = await prisma.partnerUser.findUnique({ where: { email: normalizedEmail } });
    if (existing) return reply.status(409).send({ error: "Ya existe una cuenta con ese email" });

    // Password temporal random (12 chars alfanuméricos)
    const tempPassword = Array.from(crypto.getRandomValues(new Uint8Array(9)))
      .map((b) => "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"[b % 56])
      .join("");
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const created = await prisma.partnerUser.create({
      data: {
        clinicId: req.params.id,
        name:     name.trim(),
        email:    normalizedEmail,
        passwordHash,
        mustChangePassword: true,
        role:     finalRole,
        occupation: occupation?.trim() || null,
        active:   true,
      },
      select: {
        id: true, name: true, email: true, role: true, active: true,
        photoUrl: true, occupation: true, phone: true, bio: true, createdAt: true,
      },
    });

    return reply.status(201).send({ user: created, tempPassword });
  });

  // PATCH /api/clinics/:id/users/:userId — cambiar role o active
  app.patch<{
    Params: { id: string; userId: string };
    Body:   { role?: "USER" | "ADMIN"; clinicalRole?: "HYGIENIST" | "GENERAL_DENTIST" | "SPECIALIST" | "RECEPTION" | "CLINIC_ADMIN" | null; active?: boolean };
  }>("/clinics/:id/users/:userId", async (req, reply) => {
    const guard = guardTeamAccess(req);
    if (!guard.ok) return reply.status(guard.status).send({ error: guard.error });

    const { role, clinicalRole, active } = req.body ?? {};
    if (role === undefined && clinicalRole === undefined && active === undefined) {
      return reply.status(400).send({ error: "Nada que actualizar" });
    }
    if (role !== undefined && !["USER", "ADMIN"].includes(role)) {
      return reply.status(400).send({ error: "Rol inválido (no se permite asignar SUPERADMIN)" });
    }
    if (clinicalRole !== undefined && clinicalRole !== null
        && !["HYGIENIST", "GENERAL_DENTIST", "SPECIALIST", "RECEPTION", "CLINIC_ADMIN"].includes(clinicalRole)) {
      return reply.status(400).send({ error: "ClinicalRole inválido" });
    }

    const target = await prisma.partnerUser.findUnique({ where: { id: req.params.userId } });
    if (!target || target.clinicId !== req.params.id) {
      return reply.status(404).send({ error: "Usuario no encontrado" });
    }

    // Nadie puede modificar a un SUPERADMIN excepto otro SUPERADMIN
    if (target.role === "SUPERADMIN" && guard.payload.role !== "SUPERADMIN") {
      return reply.status(403).send({ error: "No puedes modificar a un superadmin" });
    }
    // El propio usuario no puede degradarse ni desactivarse
    if (target.id === guard.payload.userId) {
      if (role !== undefined && role !== target.role) {
        return reply.status(400).send({ error: "No puedes cambiarte tu propio rol" });
      }
      if (active === false) {
        return reply.status(400).send({ error: "No puedes desactivarte a ti mismo" });
      }
    }

    const updated = await prisma.partnerUser.update({
      where: { id: req.params.userId },
      data: {
        ...(role         !== undefined && { role }),
        ...(clinicalRole !== undefined && { clinicalRole }),
        ...(active       !== undefined && { active }),
      },
      select: {
        id: true, name: true, email: true, role: true, clinicalRole: true, active: true,
        photoUrl: true, occupation: true, phone: true, bio: true, createdAt: true,
      },
    });
    return reply.send({ user: updated });
  });
}
