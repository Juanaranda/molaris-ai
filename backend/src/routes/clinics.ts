import { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import prisma from "../config/prisma";
import { verifyToken } from "./auth";

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
      ] = await Promise.all([
        // Total conversaciones
        prisma.session.count({ where: { clinicId } }),

        // Leads (sesiones con contexto capturado)
        prisma.patientContext.count({ where: { session: { clinicId } } }),

        // Desglose por intent
        prisma.patientContext.groupBy({
          by: ["intent"],
          where: { session: { clinicId }, intent: { not: null } },
          _count: true,
        }),

        // Desglose por urgencia
        prisma.patientContext.groupBy({
          by: ["urgency"],
          where: { session: { clinicId }, urgency: { not: null } },
          _count: true,
        }),

        // Top servicios
        prisma.patientContext.groupBy({
          by: ["serviceInterest"],
          where: { session: { clinicId }, serviceInterest: { not: null } },
          _count: { serviceInterest: true },
          orderBy: { _count: { serviceInterest: "desc" } },
          take: 6,
        }),

        // Score promedio
        prisma.patientContext.aggregate({
          where: { session: { clinicId }, score: { not: null } },
          _avg: { score: true },
        }),

        // Citas agendadas (booking page)
        prisma.booking.count({ where: { clinicId } }),

        // Leads recientes con detalle
        prisma.patientContext.findMany({
          where: { session: { clinicId } },
          include: { session: { select: { createdAt: true, channel: true } } },
          orderBy: { session: { createdAt: "desc" } },
          take: 25,
        }),

        // Sesiones por día (últimos N días)
        prisma.$queryRaw<Array<{ day: string; count: bigint }>>`
          SELECT DATE(s."createdAt") as day, COUNT(*)::int as count
          FROM sessions s
          WHERE s."clinicId" = ${clinicId}
            AND s."createdAt" >= ${since}
          GROUP BY DATE(s."createdAt")
          ORDER BY day ASC
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

      const updated = await prisma.booking.update({
        where: { id: req.params.bookingId },
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
}
