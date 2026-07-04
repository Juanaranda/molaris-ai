import type { FastifyInstance } from "fastify";
import prisma from "../config/prisma";
import { verifyToken } from "./auth";
import { sendBookingNotification } from "../services/notifications/whatsappService";

interface AgendaQueryDay {
  date?: string;
}

interface AgendaQueryWeek {
  start?: string;
}

interface CreateBookingBody {
  doctor: string;
  date: string;
  time: string;
  box?: string;
  patientName: string;
  patientRut?: string;
  patientPhone?: string;
  patientEmail?: string;
  service?: string;
  notes?: string;
}

interface UpdateBookingBody {
  status?: "confirmed" | "cancelled" | "pending";
  notes?: string;
  paymentStatus?: "pending" | "paid" | "partial" | "waived";
  amountTotal?: number;
  amountPaid?: number;
  paymentMethod?: "cash" | "transfer" | "card" | "other";
}

function bookingSelect() {
  return {
    id: true,
    doctor: true,
    time: true,
    date: true,
    box: true,
    patientName: true,
    patientRut: true,
    patientPhone: true,
    patientEmail: true,
    service: true,
    status: true,
    notes: true,
    paymentStatus: true,
    amountTotal: true,
    amountPaid: true,
    paymentMethod: true,
    paidAt: true,
    createdAt: true,
  } as const;
}

export async function agendaRoutes(app: FastifyInstance) {
  // GET /api/agenda?date=YYYY-MM-DD
  app.get<{ Querystring: AgendaQueryDay }>("/agenda", async (req, reply) => {
    let payload;
    try {
      payload = verifyToken(req.headers.authorization);
    } catch {
      return reply.status(401).send({ error: "No autorizado" });
    }

    const { date } = req.query;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return reply.status(400).send({ error: "Param date requerido (YYYY-MM-DD)" });
    }
    if (!payload.clinicId) {
      return reply.status(403).send({ error: "Sin clínica asignada" });
    }

    const start = new Date(`${date}T00:00:00`);
    const end = new Date(`${date}T23:59:59`);

    const bookings = await prisma.booking.findMany({
      where: {
        clinicId: payload.clinicId,
        date: { gte: start, lte: end },
      },
      select: bookingSelect(),
      orderBy: { time: "asc" },
    });

    return reply.send(bookings);
  });

  // GET /api/agenda/week?start=YYYY-MM-DD
  app.get<{ Querystring: AgendaQueryWeek }>("/agenda/week", async (req, reply) => {
    let payload;
    try {
      payload = verifyToken(req.headers.authorization);
    } catch {
      return reply.status(401).send({ error: "No autorizado" });
    }

    const { start } = req.query;
    if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start)) {
      return reply.status(400).send({ error: "Param start requerido (YYYY-MM-DD)" });
    }
    if (!payload.clinicId) {
      return reply.status(403).send({ error: "Sin clínica asignada" });
    }

    const startDate = new Date(`${start}T00:00:00`);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 5); // 6 days: start + 5
    endDate.setHours(23, 59, 59);

    const bookings = await prisma.booking.findMany({
      where: {
        clinicId: payload.clinicId,
        date: { gte: startDate, lte: endDate },
      },
      select: bookingSelect(),
      orderBy: { time: "asc" },
    });

    // Build 6-day structure
    const days: { date: string; bookings: typeof bookings }[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      days.push({
        date: dateStr,
        bookings: bookings.filter((b) => {
          return new Date(b.date).toISOString().slice(0, 10) === dateStr;
        }),
      });
    }

    return reply.send({ days });
  });

  // POST /api/agenda/bookings
  app.post<{ Body: CreateBookingBody }>("/agenda/bookings", async (req, reply) => {
    let payload;
    try {
      payload = verifyToken(req.headers.authorization);
    } catch {
      return reply.status(401).send({ error: "No autorizado" });
    }

    if (!payload.clinicId) {
      return reply.status(403).send({ error: "Sin clínica asignada" });
    }

    const { doctor, date, time, box, patientName, patientRut, patientPhone, patientEmail, service, notes } = req.body ?? {};

    if (!doctor || !date || !time || !patientName) {
      return reply.status(400).send({ error: "Campos requeridos: doctor, date, time, patientName" });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return reply.status(400).send({ error: "date debe ser YYYY-MM-DD" });
    }

    // Check slot conflict
    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd = new Date(`${date}T23:59:59`);
    const conflict = await prisma.booking.findFirst({
      where: {
        clinicId: payload.clinicId,
        doctor,
        time,
        date: { gte: dayStart, lte: dayEnd },
        status: { not: "cancelled" },
      },
    });
    if (conflict) {
      return reply.status(409).send({ error: "El doctor ya tiene una cita en ese horario" });
    }

    const booking = await prisma.booking.create({
      data: {
        clinicId: payload.clinicId,
        doctor,
        date: new Date(`${date}T12:00:00`),
        time,
        box: box ?? null,
        patientName,
        patientRut: patientRut ?? null,
        patientPhone: patientPhone ?? null,
        patientEmail: patientEmail ?? null,
        service: service ?? null,
        notes: notes ?? null,
        status: "confirmed",
      },
      select: bookingSelect(),
    });

    const clinic = await prisma.clinic.findUnique({
      where: { id: payload.clinicId },
      select: { name: true, whatsapp: true, waVerified: true, waPhoneId: true, waToken: true },
    });
    if (clinic?.whatsapp) {
      const DAY_NAMES_ES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
      const dayName = DAY_NAMES_ES[new Date(`${date}T12:00:00`).getDay()];
      const clinicMeta = (clinic.waVerified && clinic.waPhoneId && clinic.waToken)
        ? { phoneId: clinic.waPhoneId, token: clinic.waToken }
        : undefined;
      sendBookingNotification({
        clinicName: clinic.name,
        clinicWhatsapp: clinic.whatsapp,
        clinicMeta,
        patientName,
        service: service ?? "A confirmar",
        date,
        dayName,
        time,
        doctor,
        box: box ?? null,
        sessionId: booking.id,
      }).catch(() => {});
    }

    return reply.status(201).send(booking);
  });

  // PATCH /api/agenda/bookings/:id
  app.patch<{ Params: { id: string }; Body: UpdateBookingBody }>("/agenda/bookings/:id", async (req, reply) => {
    let payload;
    try {
      payload = verifyToken(req.headers.authorization);
    } catch {
      return reply.status(401).send({ error: "No autorizado" });
    }

    if (!payload.clinicId) {
      return reply.status(403).send({ error: "Sin clínica asignada" });
    }

    const { id } = req.params;
    const { status, notes, paymentStatus, amountTotal, amountPaid, paymentMethod } = req.body ?? {};

    if (amountTotal !== undefined && (typeof amountTotal !== "number" || !isFinite(amountTotal) || amountTotal < 0)) {
      return reply.status(400).send({ error: "amountTotal debe ser un número no negativo" });
    }
    if (amountPaid !== undefined && (typeof amountPaid !== "number" || !isFinite(amountPaid) || amountPaid < 0)) {
      return reply.status(400).send({ error: "amountPaid debe ser un número no negativo" });
    }

    const existing = await prisma.booking.findUnique({ where: { id } });
    if (!existing || existing.clinicId !== payload.clinicId) {
      return reply.status(404).send({ error: "Cita no encontrada" });
    }

    const validStatuses = ["confirmed", "cancelled", "pending"];
    if (status && !validStatuses.includes(status)) {
      return reply.status(400).send({ error: "Status inválido" });
    }

    const validPayStatuses = ["pending", "paid", "partial", "waived"];
    if (paymentStatus && !validPayStatuses.includes(paymentStatus)) {
      return reply.status(400).send({ error: "paymentStatus inválido" });
    }

    const isPaid = paymentStatus === "paid" || paymentStatus === "partial";

    const updated = await prisma.booking.update({
      where: { id },
      data: {
        ...(status !== undefined ? { status } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(paymentStatus !== undefined ? { paymentStatus } : {}),
        ...(amountTotal !== undefined ? { amountTotal } : {}),
        ...(amountPaid !== undefined ? { amountPaid } : {}),
        ...(paymentMethod !== undefined ? { paymentMethod } : {}),
        ...(isPaid && !existing.paidAt ? { paidAt: new Date() } : {}),
      },
      select: bookingSelect(),
    });

    return reply.send(updated);
  });

  // DELETE /api/agenda/bookings/:id
  app.delete<{ Params: { id: string } }>("/agenda/bookings/:id", async (req, reply) => {
    let payload;
    try {
      payload = verifyToken(req.headers.authorization);
    } catch {
      return reply.status(401).send({ error: "No autorizado" });
    }

    if (!payload.clinicId) {
      return reply.status(403).send({ error: "Sin clínica asignada" });
    }

    const { id } = req.params;

    const existing = await prisma.booking.findUnique({ where: { id } });
    if (!existing || existing.clinicId !== payload.clinicId) {
      return reply.status(404).send({ error: "Cita no encontrada" });
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: { status: "cancelled" },
      select: bookingSelect(),
    });

    return reply.send(updated);
  });
}
