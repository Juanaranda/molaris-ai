import type { FastifyInstance } from "fastify";
import prisma from "../config/prisma";
import { verifyToken } from "./auth";

/* ── CSV helpers ─────────────────────────────────────────────────────── */
function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') { inQuotes = !inQuotes; }
    else if (char === delimiter && !inQuotes) { result.push(current); current = ""; }
    else { current += char; }
  }
  result.push(current);
  return result.map((v) => v.trim().replace(/^["']|["']$/g, ""));
}

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const delimiter = (lines[0].split(";").length > lines[0].split(",").length) ? ";" : ",";
  const headers = parseCSVLine(lines[0], delimiter).map((h) => h.toLowerCase().trim());
  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line, delimiter);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ""; });
    return row;
  }).filter((row) => Object.values(row).some((v) => v !== ""));
}

const COL_ALIASES: Record<string, string[]> = {
  patientName:  ["nombre", "paciente", "nombre paciente", "name", "patient"],
  patientRut:   ["rut", "run", "dni", "id"],
  patientPhone: ["telefono", "teléfono", "phone", "celular", "fono", "movil", "móvil"],
  patientEmail: ["email", "correo", "mail", "e-mail"],
  date:         ["fecha", "date", "fecha cita", "fecha consulta", "día"],
  time:         ["hora", "time", "horario", "hora cita"],
  doctor:       ["doctor", "profesional", "dentista", "medico", "médico", "dr", "dra"],
  service:      ["servicio", "tratamiento", "prestacion", "prestación", "service", "procedimiento"],
  status:       ["estado", "status"],
};

function detectColumns(headers: string[]): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  for (const [field, aliases] of Object.entries(COL_ALIASES)) {
    result[field] = headers.find((h) => aliases.some((a) => h.includes(a))) ?? null;
  }
  return result;
}

function parseDate(str: string): Date | null {
  if (!str) return null;
  const dm = /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/.exec(str);
  if (dm) return new Date(`${dm[3]}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}T12:00:00`);
  const ym = /^(\d{4})[\/\-](\d{2})[\/\-](\d{2})$/.exec(str);
  if (ym) return new Date(`${str}T12:00:00`);
  return null;
}

function parseTime(str: string): string | null {
  if (!str) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(str);
  if (!m) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

interface ImportBody { csv: string; }

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
        paymentStatus: true, amountTotal: true, amountPaid: true,
      },
      orderBy: { date: "desc" },
    });

    // Collapse into unique patients by RUT (or name if no RUT)
    const map = new Map<string, {
      key: string; name: string; rut: string | null; phone: string | null; email: string | null;
      visits: number; lastVisit: string; lastDoctor: string; services: string[];
      totalCharged: number; totalPaid: number; pendingCount: number;
    }>();

    for (const b of bookings) {
      if (b.status === "cancelled" || !b.patientName) continue;
      const key = b.patientRut ?? b.patientName.toLowerCase().trim();
      if (!map.has(key)) {
        map.set(key, {
          key, name: b.patientName, rut: b.patientRut, phone: b.patientPhone, email: b.patientEmail,
          visits: 0, lastVisit: b.date.toISOString(), lastDoctor: b.doctor, services: [],
          totalCharged: 0, totalPaid: 0, pendingCount: 0,
        });
      }
      const p = map.get(key)!;
      p.visits++;
      if (b.date > new Date(p.lastVisit)) { p.lastVisit = b.date.toISOString(); p.lastDoctor = b.doctor; }
      if (b.service && !p.services.includes(b.service)) p.services.push(b.service);
      if (!p.phone && b.patientPhone) p.phone = b.patientPhone;
      if (!p.email && b.patientEmail) p.email = b.patientEmail;
      // Payment aggregation
      if (b.amountTotal) p.totalCharged += b.amountTotal;
      if (b.amountPaid)  p.totalPaid    += b.amountPaid;
      if (!b.paymentStatus || b.paymentStatus === "pending") p.pendingCount++;
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
        paymentStatus: true, amountTotal: true, amountPaid: true, paymentMethod: true, paidAt: true,
      },
      orderBy: { date: "desc" },
    });

    return reply.send(bookings);
  });

  // POST /api/patients/import — importa pacientes desde CSV
  app.post<{ Body: ImportBody }>("/patients/import", async (req, reply) => {
    let payload;
    try { payload = verifyToken(req.headers.authorization); }
    catch { return reply.status(401).send({ error: "No autorizado" }); }
    if (!payload.clinicId) return reply.status(403).send({ error: "Sin clínica asignada" });

    const { csv } = req.body ?? {};
    if (!csv || typeof csv !== "string") return reply.status(400).send({ error: "csv requerido" });

    const rows = parseCSV(csv);
    if (rows.length === 0) return reply.status(400).send({ error: "CSV vacío o sin filas válidas" });

    const headers = Object.keys(rows[0]);
    const cols = detectColumns(headers);

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const lineNum = i + 2;

      const patientName = cols.patientName ? row[cols.patientName] : null;
      if (!patientName) { skipped++; continue; }

      const patientRut   = cols.patientRut   ? row[cols.patientRut]   || null : null;
      const patientPhone = cols.patientPhone ? row[cols.patientPhone] || null : null;
      const patientEmail = cols.patientEmail ? row[cols.patientEmail] || null : null;
      const service      = cols.service      ? row[cols.service]      || null : null;
      const doctorRaw    = cols.doctor       ? row[cols.doctor]       || null : null;
      const doctor       = doctorRaw ?? "Sin asignar";
      const statusRaw    = cols.status       ? row[cols.status]?.toLowerCase() : null;
      const status       = ["confirmed","confirmada","confirmado"].some((s) => statusRaw?.includes(s))
        ? "confirmed" : ["cancel","cancelad"].some((s) => statusRaw?.includes(s) ?? false)
        ? "cancelled" : "confirmed";

      const dateStr = cols.date ? row[cols.date] : null;
      const date = dateStr ? parseDate(dateStr) : null;
      if (!date) { errors.push(`Fila ${lineNum}: fecha inválida "${dateStr ?? ""}"`); skipped++; continue; }

      const timeStr = cols.time ? row[cols.time] : null;
      const time = timeStr ? parseTime(timeStr) : "10:00";
      if (!time) { errors.push(`Fila ${lineNum}: hora inválida "${timeStr ?? ""}"`); skipped++; continue; }

      // Skip duplicates: same clinic + rut/name + date + doctor
      const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
      const dayEnd   = new Date(date); dayEnd.setHours(23, 59, 59, 999);
      const existing = await prisma.booking.findFirst({
        where: {
          clinicId: payload.clinicId, doctor, time,
          date: { gte: dayStart, lte: dayEnd },
          ...(patientRut ? { patientRut } : { patientName }),
        },
      });
      if (existing) { skipped++; continue; }

      try {
        await prisma.booking.create({
          data: {
            clinicId: payload.clinicId, patientName, patientRut, patientPhone, patientEmail,
            service, doctor, date, time, status,
          },
        });
        created++;
      } catch (e) {
        errors.push(`Fila ${lineNum}: error al insertar`);
        skipped++;
      }
    }

    return reply.send({ created, skipped, total: rows.length, errors: errors.slice(0, 20) });
  });
}
