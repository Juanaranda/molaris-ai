import type { FastifyInstance } from "fastify";
import prisma from "../config/prisma";
import { sendBookingNotification } from "../services/notifications/whatsappService";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

interface BookingBody {
  clinicSlug: string;
  sessionId: string;
  patientName?: string;
  service?: string;
  date: string;
  dayName: string;
  time: string;
  doctor: string;
  box?: string | null;
}

export async function bookingRoutes(app: FastifyInstance) {
  app.post<{ Body: BookingBody }>("/bookings", async (req, reply) => {
    const { clinicSlug, sessionId, patientName, service, date, dayName, time, doctor, box } = req.body ?? {};

    if (!clinicSlug || !date || !time || !doctor) {
      return reply.code(400).send({ error: "Faltan campos obligatorios: clinicSlug, date, time, doctor" });
    }
    // BUG FIX #2: validate date/time format to prevent Invalid Date stored in DB
    if (!DATE_RE.test(date)) {
      return reply.code(400).send({ error: "date debe tener formato YYYY-MM-DD" });
    }
    if (!TIME_RE.test(time)) {
      return reply.code(400).send({ error: "time debe tener formato HH:MM" });
    }

    // Obtener clínica
    const clinic = await prisma.clinic.findUnique({ where: { slug: clinicSlug } });
    if (!clinic) return reply.code(404).send({ error: "Clínica no encontrada" });

    // BUG FIX #10: validate sessionId belongs to the same clinic before accepting it
    let resolvedSessionId: string | null = sessionId || null;
    if (resolvedSessionId) {
      const session = await prisma.session.findUnique({ where: { id: resolvedSessionId }, select: { clinicId: true } });
      if (!session || session.clinicId !== clinic.id) {
        resolvedSessionId = null;
      }
    }

    // BUG FIX #1: use a transaction to eliminate the race condition between
    // conflict check and booking creation on the public booking endpoint.
    const booking = await prisma.$transaction(async (tx) => {
      const startOfDay = new Date(`${date}T00:00:00`);
      const endOfDay   = new Date(`${date}T23:59:59`);
      const conflict = await tx.booking.findFirst({
        where: {
          clinicId: clinic.id,
          doctor,
          time,
          date: { gte: startOfDay, lte: endOfDay },
          status: { not: "cancelled" },
        },
      });
      if (conflict) {
        throw Object.assign(new Error("SLOT_TAKEN"), { code: "SLOT_TAKEN" });
      }

      return tx.booking.create({
        data: {
          clinicId:    clinic.id,
          sessionId:   resolvedSessionId,
          patientName: patientName || null,
          service:     service || null,
          date:        new Date(date + "T12:00:00"),
          time,
          doctor,
          box:         box || null,
          status:      "pending",
        },
      });
    }).catch((err: unknown) => {
      if (err instanceof Error && (err as NodeJS.ErrnoException).code === "SLOT_TAKEN") {
        return null;
      }
      throw err;
    });

    if (!booking) {
      return reply.code(409).send({ error: "Ese horario ya fue reservado. Por favor elige otro." });
    }

    // Notificar a la clínica por WhatsApp (no bloquea la respuesta)
    const clinicMeta = (clinic.waVerified && clinic.waPhoneId && clinic.waToken)
      ? { phoneId: clinic.waPhoneId, token: clinic.waToken }
      : undefined;
    sendBookingNotification({
      clinicName:      clinic.name,
      clinicWhatsapp:  clinic.whatsapp ?? "",
      clinicMeta,
      patientName:     patientName ?? "",
      service:         service ?? "",
      date,
      dayName,
      time,
      doctor,
      box:             box ?? null,
      sessionId:       sessionId ?? booking.id,
    }).catch(() => {}); // silenciar errores asíncronos

    return reply.code(201).send({
      ok: true,
      bookingId: booking.id,
      message: `Cita confirmada para el ${dayName} ${date.slice(8)} a las ${time} con ${doctor}.`,
    });
  });
}
