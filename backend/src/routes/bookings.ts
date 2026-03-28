import type { FastifyInstance } from "fastify";
import prisma from "../config/prisma";
import { sendBookingNotification } from "../services/notifications/whatsappService";

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
    const { clinicSlug, sessionId, patientName, service, date, dayName, time, doctor, box } = req.body;

    if (!clinicSlug || !date || !time || !doctor) {
      return reply.code(400).send({ error: "Faltan campos obligatorios: clinicSlug, date, time, doctor" });
    }

    // Obtener clínica
    const clinic = await prisma.clinic.findUnique({ where: { slug: clinicSlug } });
    if (!clinic) return reply.code(404).send({ error: "Clínica no encontrada" });

    // Guardar booking en DB
    const booking = await prisma.booking.create({
      data: {
        clinicId:    clinic.id,
        sessionId:   sessionId || null,
        patientName: patientName || null,
        service:     service || null,
        date:        new Date(date + "T12:00:00"),
        time,
        doctor,
        box:         box || null,
        status:      "pending",
      },
    });

    // Notificar a la clínica por WhatsApp (no bloquea la respuesta)
    sendBookingNotification({
      clinicName:      clinic.name,
      clinicWhatsapp:  clinic.whatsapp ?? "",
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
