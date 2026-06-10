import { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import prisma from "../config/prisma";
import { verifyToken } from "./auth";
import { sendWhatsAppMessage } from "../services/notifications/whatsappService";

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
      ]);

      const readyToBook = intentCounts.find((i) => i.intent === "ready_to_book")?._count ?? 0;
      const slotBooked = await prisma.patientContext.count({
        where: { session: { clinicId }, slotBooked: true },
      });

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

      return reply.send(updated);
    }
  );

  // POST /api/clinics — registro público de nueva clínica + admin
  app.post<{
    Body: {
      clinic: { name: string; phone?: string; location?: string; instagram?: string; whatsapp?: string };
      admin: { name: string; email: string; password: string };
      acceptedTerms?: boolean;
    };
  }>("/clinics", async (req, reply) => {
    const { clinic: clinicData, admin, acceptedTerms } = req.body ?? {};
    if (!clinicData?.name || !admin?.email || !admin?.password || !admin?.name) {
      return reply.status(400).send({ error: "Nombre de clínica, nombre, email y contraseña son requeridos" });
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

    // Asegurar unicidad del slug
    let slug = baseSlug;
    let counter = 1;
    while (await prisma.clinic.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter++}`;
    }

    const passwordHash = await bcrypt.hash(admin.password, 12);

    const newClinic = await prisma.clinic.create({
      data: {
        slug,
        name: clinicData.name,
        phone: clinicData.phone ?? null,
        location: clinicData.location ?? null,
        instagram: clinicData.instagram ?? null,
        whatsapp: clinicData.whatsapp ?? null,
        plan: "starter",
        config: {
          tone: "profesional pero cercano",
          schedule: { weekdays: "Lunes a Viernes: 09:00 - 18:00", saturday: "Sábado: cerrado", sunday: "Domingo: cerrado" },
          doctors: [],
          services: [],
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

    return reply.status(201).send({ clinicId: newClinic.id, slug: newClinic.slug, message: "Clínica registrada correctamente" });
  });

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
      select: { name: true, slug: true },
    });
    if (!clinic) return reply.status(404).send({ error: "Clínica no encontrada" });

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

    // Enviar mensajes (fire-and-forget)
    let sent = 0;
    for (const t of targets) {
      const body = message
        .replace("{nombre}", t.name?.split(" ")[0] ?? "")
        .replace("{clinica}", clinic.name);
      await sendWhatsAppMessage(t.phone, body);
      sent++;
    }

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

    const name = patientName?.split(" ")[0] ?? "";
    const body = `Hola ${name}! 😊 Gracias por visitar ${clinicName ?? "nuestra clínica"}. ¿Cómo fue tu experiencia? ¿Nos dejarías una reseña en Google? Tu opinión nos ayuda mucho 🙏`;
    await sendWhatsAppMessage(phone, body);

    return reply.send({ ok: true });
  });
}
