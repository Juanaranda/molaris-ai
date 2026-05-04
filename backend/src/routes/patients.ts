import type { FastifyInstance } from "fastify";
import prisma from "../config/prisma";
import { verifyToken } from "./auth";

export async function patientsRoutes(app: FastifyInstance) {
  // GET /api/patients — lista de pacientes únicos derivada de bookings
  app.get("/patients", async (req, reply) => {
    let payload;
    try { payload = verifyToken(req.headers.authorization); }
    catch { return reply.status(401).send({ error: "No autorizado" }); }
    if (!payload.clinicId) return reply.status(403).send({ error: "Sin clínica asignada" });

    const bookings = await prisma.booking.findMany({
      where: { clinicId: payload.clinicId },
      select: {
        id: true, patientName: true, patientRut: true, patientPhone: true, patientEmail: true,
        service: true, doctor: true, date: true, time: true, status: true, createdAt: true,
      },
      orderBy: { date: "desc" },
    });

    // Collapse into unique patients by RUT (or name if no RUT)
    const map = new Map<string, {
      key: string; name: string; rut: string | null; phone: string | null; email: string | null;
      visits: number; lastVisit: string; lastDoctor: string; services: string[];
    }>();

    for (const b of bookings) {
      if (b.status === "cancelled" || !b.patientName) continue;
      const key = b.patientRut ?? b.patientName.toLowerCase().trim();
      if (!map.has(key)) {
        map.set(key, {
          key, name: b.patientName, rut: b.patientRut, phone: b.patientPhone, email: b.patientEmail,
          visits: 0, lastVisit: b.date.toISOString(), lastDoctor: b.doctor, services: [],
        });
      }
      const p = map.get(key)!;
      p.visits++;
      if (b.date > new Date(p.lastVisit)) { p.lastVisit = b.date.toISOString(); p.lastDoctor = b.doctor; }
      if (b.service && !p.services.includes(b.service)) p.services.push(b.service);
      // Update contact info if missing
      if (!p.phone && b.patientPhone) p.phone = b.patientPhone;
      if (!p.email && b.patientEmail) p.email = b.patientEmail;
    }

    const patients = Array.from(map.values()).sort((a, b) =>
      new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime()
    );

    return reply.send(patients);
  });

  // GET /api/patients/:rut/history — historial de citas de un paciente
  app.get<{ Params: { rut: string } }>("/patients/:rut/history", async (req, reply) => {
    let payload;
    try { payload = verifyToken(req.headers.authorization); }
    catch { return reply.status(401).send({ error: "No autorizado" }); }
    if (!payload.clinicId) return reply.status(403).send({ error: "Sin clínica asignada" });

    const { rut } = req.params;

    const bookings = await prisma.booking.findMany({
      where: { clinicId: payload.clinicId, patientRut: rut },
      select: {
        id: true, doctor: true, date: true, time: true, service: true,
        status: true, notes: true, createdAt: true,
      },
      orderBy: { date: "desc" },
    });

    return reply.send(bookings);
  });
}
