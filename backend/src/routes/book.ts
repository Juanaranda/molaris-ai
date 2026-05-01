import { FastifyInstance } from "fastify";
import prisma from "../config/prisma";
import { verifyPatientToken } from "./patient-auth";
import { sendBookingNotification } from "../services/notifications/whatsappService";

interface DoctorConfig {
  name: string;
  specialty: string;
  schedule: string;
}

interface ClinicConfig {
  doctors?: DoctorConfig[];
  services?: { name: string; pricingType?: string; price?: string; priceNote?: string }[];
  schedule?: { weekdays?: string; saturday?: string; sunday?: string };
  boxes?: number;
  assistantName?: string;
}

// Mapeo de abreviaciones españolas a día JS (0=Dom, 1=Lun, ..., 6=Sáb)
const DAY_MAP: Record<string, number> = {
  Dom: 0, Lun: 1, Mar: 2, "Mié": 3, Jue: 4, Vie: 5, "Sáb": 6,
};

function parseDoctorDays(schedule: string): number[] {
  if (schedule.includes("-")) {
    const [start, end] = schedule.split("-").map((s) => s.trim());
    const s = DAY_MAP[start];
    const e = DAY_MAP[end];
    if (s == null || e == null) return [];
    return Array.from({ length: e - s + 1 }, (_, i) => s + i);
  }
  return schedule.split("/").map((d) => DAY_MAP[d.trim()]).filter((d) => d != null);
}

function generateTimeSlots(isSaturday: boolean): string[] {
  const slots: string[] = [];
  const endHour = isSaturday ? 14 : 18;
  for (let h = 10; h < endHour; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
    slots.push(`${String(h).padStart(2, "0")}:30`);
  }
  return slots;
}

export async function bookRoutes(app: FastifyInstance) {

  // GET /api/book/:slug/prefill?s=SESSION_ID — datos conocidos del chat para pre-rellenar el formulario
  app.get<{ Params: { slug: string }; Querystring: { s?: string } }>(
    "/book/:slug/prefill",
    async (req, reply) => {
      const { s: sessionId } = req.query;
      if (!sessionId) return reply.send({ prefill: null });

      const clinic = await prisma.clinic.findUnique({ where: { slug: req.params.slug } });
      if (!clinic) return reply.send({ prefill: null });

      const ctx = await prisma.patientContext.findUnique({
        where: { sessionId },
        include: { session: { select: { clinicId: true } } },
      });

      // Solo devolvemos datos si el session pertenece a esta clínica
      if (!ctx || ctx.session.clinicId !== clinic.id) {
        return reply.send({ prefill: null });
      }

      // Partir patientName en firstName + lastName (primer token = nombre)
      let firstName = "";
      let lastName  = "";
      if (ctx.patientName) {
        const parts = ctx.patientName.trim().split(/\s+/);
        firstName = parts[0] ?? "";
        lastName  = parts.slice(1).join(" ");
      }

      return reply.send({
        prefill: {
          firstName:  firstName  || undefined,
          lastName:   lastName   || undefined,
          rut:        ctx.rut    || undefined,
          email:      ctx.email  || undefined,
        },
      });
    }
  );

  // GET /api/book/:slug — info pública de la clínica para la página de booking
  app.get<{ Params: { slug: string } }>("/book/:slug", async (req, reply) => {
    const clinic = await prisma.clinic.findUnique({
      where: { slug: req.params.slug },
      select: { id: true, slug: true, name: true, location: true, config: true, active: true },
    });

    if (!clinic || !clinic.active) {
      return reply.status(404).send({ error: "Clínica no encontrada" });
    }

    const cfg = clinic.config as ClinicConfig;
    return reply.send({
      clinic: {
        id: clinic.id,
        slug: clinic.slug,
        name: clinic.name,
        location: clinic.location,
        assistantName: cfg.assistantName ?? null,
        doctors: cfg.doctors ?? [],
        services: cfg.services ?? [],
        schedule: cfg.schedule ?? {},
      },
    });
  });


  // GET /api/book/:slug/slots?date=YYYY-MM-DD&doctor=NombreDoctor
  // Devuelve slots disponibles para ese día y doctor (excluye los ya reservados)
  app.get<{
    Params: { slug: string };
    Querystring: { date: string; doctor?: string };
  }>("/book/:slug/slots", async (req, reply) => {
    const { slug } = req.params;
    const { date, doctor: doctorName } = req.query;

    if (!date) return reply.status(400).send({ error: "Parámetro date requerido (YYYY-MM-DD)" });

    const clinic = await prisma.clinic.findUnique({ where: { slug } });
    if (!clinic || !clinic.active) return reply.status(404).send({ error: "Clínica no encontrada" });

    const requestedDate = new Date(`${date}T12:00:00.000Z`);
    const jsDay = new Date(`${date}T00:00:00`).getDay();
    const isSaturday = jsDay === 6;
    const isSunday   = jsDay === 0;

    if (isSunday) return reply.send({ slots: [] });

    const cfg = clinic.config as ClinicConfig;
    const doctors = cfg.doctors ?? [];

    // Filtrar doctors que trabajan ese día
    const availableDoctors = doctorName
      ? doctors.filter((d) => d.name === doctorName && parseDoctorDays(d.schedule).includes(jsDay))
      : doctors.filter((d) => parseDoctorDays(d.schedule).includes(jsDay));

    if (availableDoctors.length === 0) return reply.send({ slots: [] });

    const allSlots = generateTimeSlots(isSaturday);

    // Citas ya existentes ese día
    const startOfDay = new Date(`${date}T00:00:00`);
    const endOfDay   = new Date(`${date}T23:59:59`);

    const existingBookings = await prisma.booking.findMany({
      where: {
        clinicId: clinic.id,
        date: { gte: startOfDay, lte: endOfDay },
        status: { not: "cancelled" },
        ...(doctorName ? { doctor: doctorName } : {}),
      },
      select: { time: true, doctor: true },
    });

    const bookedByDoctor: Record<string, Set<string>> = {};
    for (const b of existingBookings) {
      if (!bookedByDoctor[b.doctor]) bookedByDoctor[b.doctor] = new Set();
      bookedByDoctor[b.doctor].add(b.time);
    }

    const result = availableDoctors.map((doc) => ({
      doctor: doc.name,
      specialty: doc.specialty,
      availableSlots: allSlots.filter((t) => !bookedByDoctor[doc.name]?.has(t)),
    }));

    return reply.send({ date, slots: result });
  });


  // POST /api/book/:slug/appointments — requiere auth de paciente
  app.post<{
    Params: { slug: string };
    Body: {
      doctor: string; date: string; time: string; service?: string;
      patientData?: { firstName: string; lastName: string; rut?: string };
    };
  }>("/book/:slug/appointments", async (req, reply) => {
    let payload;
    try {
      payload = verifyPatientToken(req.headers.authorization);
    } catch {
      return reply.status(401).send({ error: "Debes iniciar sesión para agendar" });
    }

    const { slug } = req.params;
    const { doctor, date, time, service, patientData } = req.body ?? {};

    if (!doctor || !date || !time) {
      return reply.status(400).send({ error: "Faltan campos: doctor, date, time" });
    }

    const clinic = await prisma.clinic.findUnique({
      where: { slug },
      select: { id: true, slug: true, name: true, phone: true, whatsapp: true, config: true, active: true },
    });
    if (!clinic || !clinic.active) return reply.status(404).send({ error: "Clínica no encontrada" });
    if (clinic.id !== payload.clinicId) {
      return reply.status(403).send({ error: "No autorizado para esta clínica" });
    }

    const patientUser = await prisma.patientUser.findUnique({
      where: { id: payload.patientUserId },
      include: { identity: true },
    });
    if (!patientUser) return reply.status(401).send({ error: "Paciente no encontrado" });

    // Verificar que el slot sigue disponible
    const requestedDate = new Date(`${date}T12:00:00.000Z`);
    const startOfDay    = new Date(`${date}T00:00:00`);
    const endOfDay      = new Date(`${date}T23:59:59`);

    const conflict = await prisma.booking.findFirst({
      where: {
        clinicId: clinic.id,
        date: { gte: startOfDay, lte: endOfDay },
        doctor,
        time,
        status: { not: "cancelled" },
      },
    });

    if (conflict) {
      return reply.status(409).send({ error: "Ese horario ya fue reservado. Por favor elige otro." });
    }

    // Si viene patientData, la cita es para otra persona (ej: padre agendando para hijo)
    const bookingPatientName = patientData?.firstName
      ? `${patientData.firstName} ${patientData.lastName}`
      : `${patientUser.identity.firstName} ${patientUser.identity.lastName}`;

    const booking = await prisma.booking.create({
      data: {
        clinicId:      clinic.id,
        patientUserId: patientUser.id,
        patientName:   bookingPatientName,
        doctor,
        date:          requestedDate,
        time,
        service:       service ?? null,
        status:        "confirmed",
      },
    });

    // Notificación WhatsApp (no bloquea la respuesta)
    if (clinic.whatsapp) {
      const DAY_NAMES_ES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
      const dayName = DAY_NAMES_ES[new Date(`${date}T12:00:00`).getDay()];
      sendBookingNotification({
        clinicName:     clinic.name,
        clinicWhatsapp: clinic.whatsapp,
        patientName:    `${patientUser.identity.firstName} ${patientUser.identity.lastName}`,
        service:        service ?? "A confirmar",
        date,
        dayName,
        time,
        doctor,
        box:            null,
        sessionId:      booking.id,
      }).catch(() => {});
    }

    return reply.status(201).send({
      booking: {
        id:          booking.id,
        doctor:      booking.doctor,
        date:        booking.date,
        time:        booking.time,
        service:     booking.service,
        status:      booking.status,
        patientName: booking.patientName,
        clinicName:  clinic.name,
      },
    });
  });
}
