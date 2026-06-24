import type { FastifyInstance } from "fastify";
import Papa from "papaparse";
import prisma from "../config/prisma";
import { verifyToken } from "./auth";

/* ── CSV parser (papaparse) ──────────────────────────────────────────── */
// Devuelve filas como Record<headerLowercased, valor>, descartando filas vacías.
// Detección automática del delimitador (",", ";", "\t") gracias a Papa.
function parseCSV(content: string): Record<string, string>[] {
  const trimmed = content.trim();
  if (!trimmed) return [];

  const result = Papa.parse<Record<string, string>>(trimmed, {
    header:           true,
    skipEmptyLines:   "greedy",
    delimitersToGuess: [",", ";", "\t", "|"],
    transformHeader:  (h) => h.trim().toLowerCase().replace(/^["']|["']$/g, ""),
    transform:        (v) => (typeof v === "string" ? v.trim().replace(/^["']|["']$/g, "") : v),
  });

  return result.data.filter((row) =>
    row && Object.values(row).some((v) => v !== "" && v != null)
  );
}

// Headers que jamás deben usarse como fecha de cita, sin importar el alias que coincida
const DATE_EXCLUSIONS = [
  "nacimiento", "nac.", "nacim", "birth", "born",
  "ingreso", "alta", "creation", "creación",
  "actualizacion", "actualización", "modificacion", "modificación",
];

const COL_ALIASES: Record<string, string[]> = {
  // Nombre completo (CSVs genéricos)
  patientName:      ["nombre paciente", "paciente", "nombre completo", "name", "patient"],
  // Columnas separadas (DentaLink / Reservo / otros)
  firstName:        ["nombre"],
  lastNamePaternal: ["apellido paterno", "primer apellido", "apellido1", "paterno"],
  lastNameMaternal: ["apellido materno", "segundo apellido", "apellido2", "materno"],
  patientRut:       ["rut", "run", "dni", "id paciente", "ficha"],
  // Teléfono: móvil primero
  patientPhone:     ["teléfono móvil", "telefono movil", "celular", "movil", "móvil", "telefono", "teléfono", "phone", "fono"],
  patientEmail:     ["correo electrónico", "correo electronico", "email", "correo", "mail", "e-mail"],
  // Fecha de cita (Reservo: "fecha de la reserva" / "inicio" / "fecha de la cita")
  // Se detecta con h.includes(alias) para cubrir variantes con artículos ("de la", etc.)
  // DATE_EXCLUSIONS impide que fechas de nacimiento sean capturadas
  date: [
    "fecha cita", "fecha de la cita", "fecha consulta", "fecha agenda",
    "fecha atencion", "fecha atención", "fecha de atencion", "fecha de atención",
    "fecha reserva", "fecha de la reserva", "fecha de reserva",
    "fecha inicio", "inicio de la cita", "inicio",
    "cita", "reserva", "date", "appointment",
  ],
  time:    ["hora inicio", "hora de inicio", "hora cita", "hora de la cita", "hora", "time", "horario"],
  doctor:  ["doctor", "profesional", "dentista", "medico", "médico", "dr.", "dra."],
  service: ["servicio", "tratamiento", "prestacion", "prestación", "service", "procedimiento"],
  status:  ["estado", "status", "estado de la reserva", "estado de la cita"],
  registrationDate: ["fecha registro", "fecha de registro", "fecha ingreso", "fecha alta", "registro", "ingreso"],
};

function isExcludedDateColumn(h: string): boolean {
  return DATE_EXCLUSIONS.some((ex) => h.includes(ex));
}

// Normaliza texto para comparar sin acentos
function normalize(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function detectColumns(headers: string[]): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  for (const [field, aliases] of Object.entries(COL_ALIASES)) {
    if (field === "date") {
      result[field] = headers.find((h) => {
        if (isExcludedDateColumn(normalize(h))) return false;
        const hn = normalize(h);
        return aliases.some((a) => hn === normalize(a) || hn.includes(normalize(a)));
      }) ?? null;
    } else {
      // Prioriza aliases en orden: el primer alias que matchea un header gana.
      // Evita que columnas secundarias (ej. "Ficha") capturen un campo antes que la columna real (ej. "RUT").
      let found: string | null = null;
      for (const a of aliases) {
        const match = headers.find((h) => {
          const hn = normalize(h);
          return hn === normalize(a) || hn.includes(normalize(a));
        });
        if (match) { found = match; break; }
      }
      result[field] = found;
    }
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

    // Sumar abonos manuales (cuenta corriente, #43) al total pagado por paciente
    const manualPayments = await prisma.accountEntry.groupBy({
      by: ["patientRut"],
      where: { clinicId: payload.clinicId, kind: "payment" },
      _sum: { amount: true },
    });
    for (const mp of manualPayments) {
      const p = map.get(mp.patientRut);
      if (p) p.totalPaid += mp._sum.amount ?? 0;
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

  // PATCH /api/patients/:key — actualiza teléfono/email/nombre en todos los bookings del paciente
  app.patch<{
    Params: { key: string };
    Body: { name?: string; phone?: string; email?: string };
  }>("/patients/:key", async (req, reply) => {
    let payload;
    try { payload = verifyToken(req.headers.authorization); }
    catch { return reply.status(401).send({ error: "No autorizado" }); }
    if (!payload.clinicId) return reply.status(403).send({ error: "Sin clínica asignada" });

    const key = decodeURIComponent(req.params.key);
    const { name, phone, email } = req.body ?? {};
    const updateData: Record<string, string | null> = {};
    if (name  !== undefined) updateData.patientName  = name  || null;
    if (phone !== undefined) updateData.patientPhone = phone || null;
    if (email !== undefined) updateData.patientEmail = email || null;
    if (Object.keys(updateData).length === 0)
      return reply.status(400).send({ error: "Nada que actualizar" });

    const byRut = await prisma.booking.count({
      where: { clinicId: payload.clinicId, patientRut: key },
    });

    if (byRut > 0) {
      await prisma.booking.updateMany({
        where: { clinicId: payload.clinicId, patientRut: key },
        data: updateData,
      });
    } else {
      const all = await prisma.booking.findMany({
        where: { clinicId: payload.clinicId },
        select: { id: true, patientName: true, patientRut: true },
      });
      const ids = all
        .filter((b) => !b.patientRut && (b.patientName ?? "").toLowerCase().trim() === key)
        .map((b) => b.id);
      if (ids.length > 0)
        await prisma.booking.updateMany({ where: { id: { in: ids } }, data: updateData });
    }

    return reply.send({ ok: true });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // CUENTA CORRIENTE DEL PACIENTE (Issue #43)
  // ════════════════════════════════════════════════════════════════════════════

  // GET /api/patients/:rut/account — estado de cuenta consolidado
  app.get<{ Params: { rut: string } }>("/patients/:rut/account", async (req, reply) => {
    let payload;
    try { payload = verifyToken(req.headers.authorization); }
    catch { return reply.status(401).send({ error: "No autorizado" }); }
    if (!payload.clinicId) return reply.status(403).send({ error: "Sin clínica asignada" });

    const rut = decodeURIComponent(req.params.rut);

    const [bookings, manual] = await Promise.all([
      prisma.booking.findMany({
        where: { clinicId: payload.clinicId, patientRut: rut, status: { not: "cancelled" } },
        select: { id: true, date: true, service: true, amountTotal: true, amountPaid: true, paidAt: true },
        orderBy: { date: "asc" },
      }),
      prisma.accountEntry.findMany({
        where: { clinicId: payload.clinicId, patientRut: rut },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    type Entry = {
      id: string; date: string; kind: "charge" | "payment" | "adjustment";
      amount: number; description: string; source: "booking" | "manual"; method?: string | null;
    };
    const entries: Entry[] = [];

    for (const b of bookings) {
      if (b.amountTotal && b.amountTotal > 0) {
        entries.push({
          id: `b-c-${b.id}`, date: b.date.toISOString(), kind: "charge", amount: b.amountTotal,
          description: b.service ? `Cargo · ${b.service}` : "Cargo por atención", source: "booking",
        });
      }
      if (b.amountPaid && b.amountPaid > 0) {
        entries.push({
          id: `b-p-${b.id}`, date: (b.paidAt ?? b.date).toISOString(), kind: "payment", amount: b.amountPaid,
          description: "Pago en cita", source: "booking",
        });
      }
    }
    for (const m of manual) {
      entries.push({
        id: m.id, date: m.createdAt.toISOString(), kind: m.kind as Entry["kind"], amount: m.amount,
        description: m.description ?? (m.kind === "payment" ? "Abono" : "Movimiento"),
        source: "manual", method: m.method,
      });
    }

    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let totalCharged = 0, totalPaid = 0;
    for (const e of entries) {
      if (e.kind === "charge" || e.kind === "adjustment") totalCharged += e.amount;
      else if (e.kind === "payment") totalPaid += e.amount;
    }

    return reply.send({ rut, saldo: totalCharged - totalPaid, totalCharged, totalPaid, entries });
  });

  // POST /api/patients/:rut/account/payment — registra un abono manual
  app.post<{
    Params: { rut: string };
    Body: { amount: number; method?: string; description?: string; bookingId?: string };
  }>("/patients/:rut/account/payment", async (req, reply) => {
    let payload;
    try { payload = verifyToken(req.headers.authorization); }
    catch { return reply.status(401).send({ error: "No autorizado" }); }
    if (!payload.clinicId) return reply.status(403).send({ error: "Sin clínica asignada" });

    const rut = decodeURIComponent(req.params.rut);
    const { amount, method, description, bookingId } = req.body ?? {};
    if (typeof amount !== "number" || !(amount > 0)) {
      return reply.status(400).send({ error: "El monto debe ser mayor a 0" });
    }

    const entry = await prisma.accountEntry.create({
      data: {
        clinicId: payload.clinicId, patientRut: rut, kind: "payment",
        amount, method: method ?? null, description: description ?? null,
        bookingId: bookingId ?? null, createdBy: payload.userId,
      },
    });
    return reply.status(201).send({ ok: true, entry });
  });

  // POST /api/patients — registra un nuevo paciente (crea booking placeholder cancelado)
  app.post<{
    Body: { name: string; rut?: string; phone?: string; email?: string };
  }>("/patients", async (req, reply) => {
    let payload;
    try { payload = verifyToken(req.headers.authorization); }
    catch { return reply.status(401).send({ error: "No autorizado" }); }
    if (!payload.clinicId) return reply.status(403).send({ error: "Sin clínica asignada" });

    const { name, rut, phone, email } = req.body ?? {};
    if (!name || typeof name !== "string" || !name.trim())
      return reply.status(400).send({ error: "El nombre es obligatorio" });

    if (rut) {
      const existing = await prisma.booking.findFirst({
        where: { clinicId: payload.clinicId, patientRut: rut.trim() },
        select: { id: true },
      });
      if (existing) return reply.status(409).send({ error: "Ya existe un paciente con ese RUT" });
    }

    const today = new Date();
    today.setHours(12, 0, 0, 0);

    const booking = await prisma.booking.create({
      data: {
        clinicId:    payload.clinicId,
        patientName: name.trim(),
        patientRut:  rut?.trim()   || null,
        patientPhone: phone?.trim() || null,
        patientEmail: email?.trim() || null,
        date:   today,
        time:   "00:00",
        doctor: "Registro manual",
        status: "registered",
      },
    });

    return reply.status(201).send({ ok: true, id: booking.id });
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

    let skipped = 0;
    const errors: string[] = [];

    // BUG FIX #6: pre-build a dedup key set from the clinic's existing bookings
    // in a single query instead of N sequential findFirst calls inside the loop.
    const existingBookings = await prisma.booking.findMany({
      where: { clinicId: payload.clinicId },
      select: { patientRut: true, patientName: true, doctor: true, time: true, date: true },
    });
    const existingKeys = new Set<string>(
      existingBookings.map((b) => {
        const dateKey = b.date.toISOString().slice(0, 10);
        const identity = b.patientRut ?? (b.patientName ?? "").toLowerCase().trim();
        return `${identity}|${b.doctor}|${dateKey}|${b.time}`;
      })
    );

    type BookingInsert = {
      clinicId: string; patientName: string; patientRut: string | null;
      patientPhone: string | null; patientEmail: string | null;
      service: string | null; doctor: string; date: Date; time: string; status: string;
    };
    const toInsert: BookingInsert[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const lineNum = i + 2;

      // Build patient name — support split columns (DentaLink) or full-name column
      let patientName: string | null = null;
      if (cols.firstName && (cols.lastNamePaternal || cols.lastNameMaternal)) {
        const first = (cols.firstName ? row[cols.firstName] : "") || "";
        const lastP = (cols.lastNamePaternal ? row[cols.lastNamePaternal] : "") || "";
        const lastM = (cols.lastNameMaternal ? row[cols.lastNameMaternal] : "") || "";
        patientName = `${first} ${lastP} ${lastM}`.replace(/\s+/g, " ").trim() || null;
      } else if (cols.patientName) {
        patientName = row[cols.patientName] || null;
      }
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

      // Date: appointment date preferred; registration date as fallback for patient rosters.
      // Never use birth dates as appointment date.
      const currentYear = new Date().getFullYear();
      const dateStr = cols.date ? row[cols.date] : null;
      const regDateStr = cols.registrationDate ? row[cols.registrationDate] : null;
      let date: Date | null = null;

      for (const raw of [dateStr, regDateStr]) {
        if (!raw || date) continue;
        const parsed = parseDate(raw);
        if (parsed) {
          const year = parsed.getFullYear();
          if (year >= 2000 && year <= currentYear + 3) { date = parsed; }
        }
      }
      if (!date) {
        // No usable date — use today as last-resort placeholder
        date = new Date(); date.setHours(12, 0, 0, 0);
      }

      const timeStr = cols.time ? row[cols.time] : null;
      const time = timeStr ? (parseTime(timeStr) ?? "10:00") : "10:00";

      // Skip duplicates using the pre-built in-memory set
      const dateKey = date.toISOString().slice(0, 10);
      const identity = patientRut ?? patientName.toLowerCase().trim();
      const dedupKey = `${identity}|${doctor}|${dateKey}|${time}`;
      if (existingKeys.has(dedupKey)) { skipped++; continue; }

      // Also deduplicate within this import batch
      existingKeys.add(dedupKey);
      toInsert.push({ clinicId: payload.clinicId, patientName, patientRut, patientPhone, patientEmail, service, doctor, date, time, status });
      void lineNum; // lineNum reserved for error reporting below
    }

    let created = 0;
    try {
      const result = await prisma.booking.createMany({ data: toInsert, skipDuplicates: true });
      created = result.count;
    } catch (e) {
      errors.push("Error al insertar registros en lote");
    }

    return reply.send({ created, skipped, total: rows.length, errors: errors.slice(0, 20) });
  });
}
