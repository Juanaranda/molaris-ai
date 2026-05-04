"use client";

import { useEffect, useState, useCallback } from "react";
import { getToken } from "@/lib/auth";
import type { AuthUser } from "@/lib/auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// Doctor → color mapping (name as key)
const DOCTOR_COLORS: Record<string, { dot: string; bg: string; text: string }> = {
  "Dra. Ana Aranda":       { dot: "#10B981", bg: "#D1FAE5", text: "#065F46" },
  "Dra. Ivonne Poblete":   { dot: "#3B82F6", bg: "#DBEAFE", text: "#1E40AF" },
  "Dr. Pedro Engel":       { dot: "#8B5CF6", bg: "#EDE9FE", text: "#5B21B6" },
  "Dr. Juan Garcés":       { dot: "#F59E0B", bg: "#FEF3C7", text: "#92400E" },
  "Dra. Jacqueline Pérez": { dot: "#EC4899", bg: "#FCE7F3", text: "#9D174D" },
};
const DOCTORS = Object.keys(DOCTOR_COLORS);

const DAY_SHORT  = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
const DAY_FULL   = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
const MONTHS     = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

function getMondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0, 0, 0, 0);
  return d;
}
function toDateStr(d: Date): string { return d.toISOString().slice(0, 10); }

function palOf(doctor: string) {
  return DOCTOR_COLORS[doctor] ?? { dot: "#6B7280", bg: "#F3F4F6", text: "#374151" };
}

interface Booking {
  id: string; doctor: string; time: string; date: string;
  patientName: string | null; patientRut: string | null;
  patientPhone: string | null; patientEmail: string | null;
  service: string | null; status: string; notes: string | null; createdAt: string;
}
interface DayData { date: string; bookings: Booking[]; }

/* ── Status pill ─────────────────────────────────────────────────────── */
function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    confirmed: "bg-emerald-50 text-emerald-700 border-emerald-100",
    pending:   "bg-amber-50 text-amber-700 border-amber-100",
    cancelled: "bg-gray-50 text-gray-400 border-gray-100",
  };
  const labels: Record<string, string> = { confirmed: "Confirmada", pending: "Pendiente", cancelled: "Cancelada" };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${map[status] ?? map.pending}`}>
      {labels[status] ?? status}
    </span>
  );
}

/* ── Booking detail modal ────────────────────────────────────────────── */
function BookingModal({ booking, onClose, onSave, onCancel }: {
  booking: Booking;
  onClose: () => void;
  onSave: (id: string, status: string, notes: string) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
}) {
  const [status, setStatus] = useState(booking.status);
  const [notes, setNotes]   = useState(booking.notes ?? "");
  const [saving, setSaving] = useState(false);
  const pal = palOf(booking.doctor);

  async function save() {
    setSaving(true);
    try { await onSave(booking.id, status, notes); onClose(); }
    finally { setSaving(false); }
  }

  async function cancel() {
    if (!confirm("¿Cancelar esta cita?")) return;
    await onCancel(booking.id);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-50 flex items-start justify-between"
          style={{ background: pal.bg }}>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: pal.text }}>{booking.doctor}</p>
            <h2 className="text-lg font-black text-gray-900 mt-0.5">{booking.patientName ?? "Paciente"}</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 transition flex items-center justify-center text-gray-500">
            ✕
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-5">
          {/* Info grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            {[
              ["Hora",    booking.time],
              ["Fecha",   new Date(booking.date).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })],
              ["RUT",     booking.patientRut ?? "—"],
              ["Teléfono",booking.patientPhone ?? "—"],
              ["Email",   booking.patientEmail ?? "—"],
              ["Servicio",booking.service ?? "—"],
            ].map(([label, val]) => (
              <div key={label}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">{label}</p>
                <p className="text-sm font-semibold text-gray-800">{val}</p>
              </div>
            ))}
          </div>

          {/* Status */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Estado</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="confirmed">Confirmada</option>
              <option value="pending">Pendiente</option>
              <option value="cancelled">Cancelada</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Notas internas</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              placeholder="Observaciones, indicaciones..."
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={save} disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: pal.dot }}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
            <button onClick={cancel}
              className="px-4 py-2.5 rounded-xl text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 transition">
              Cancelar cita
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── New booking modal ───────────────────────────────────────────────── */
const TIME_OPTIONS = Array.from({ length: 20 }, (_, i) => {
  const h = Math.floor(i / 2) + 9;
  const m = i % 2 === 0 ? "00" : "30";
  return `${String(h).padStart(2, "0")}:${m}`;
});

function NewBookingModal({ doctors, initialDate, onClose, onCreate }: {
  doctors: string[];
  initialDate: string;
  onClose: () => void;
  onCreate: (data: { doctor: string; date: string; time: string; patientName: string; patientRut?: string; patientPhone?: string; patientEmail?: string; service?: string }) => Promise<void>;
}) {
  const [form, setForm] = useState({ doctor: doctors[0] ?? "", date: initialDate, time: "10:00",
    patientName: "", patientRut: "", patientPhone: "", patientEmail: "", service: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.patientName) { setError("El nombre del paciente es obligatorio"); return; }
    setSaving(true); setError("");
    try {
      await onCreate({ doctor: form.doctor, date: form.date, time: form.time,
        patientName: form.patientName,
        patientRut:   form.patientRut   || undefined,
        patientPhone: form.patientPhone || undefined,
        patientEmail: form.patientEmail || undefined,
        service:      form.service      || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear cita");
    } finally { setSaving(false); }
  }

  const inp = "w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500";
  const lbl = "block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
          <h2 className="text-lg font-black text-gray-900">Nueva cita</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 transition flex items-center justify-center text-gray-500">✕</button>
        </div>
        <form onSubmit={submit} className="px-6 py-5 flex flex-col gap-4">
          {/* Doctor */}
          <div>
            <label className={lbl}>Profesional *</label>
            <select value={form.doctor} onChange={set("doctor")} className={inp}>
              {doctors.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Fecha *</label>
              <input type="date" value={form.date} onChange={set("date")} required className={inp} />
            </div>
            <div>
              <label className={lbl}>Hora *</label>
              <select value={form.time} onChange={set("time")} className={inp}>
                {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          {/* Patient */}
          <div>
            <label className={lbl}>Nombre paciente *</label>
            <input type="text" value={form.patientName} onChange={set("patientName")} placeholder="Nombre completo" required className={inp} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>RUT</label>
              <input type="text" value={form.patientRut} onChange={set("patientRut")} placeholder="12.345.678-9" className={inp} />
            </div>
            <div>
              <label className={lbl}>Teléfono</label>
              <input type="tel" value={form.patientPhone} onChange={set("patientPhone")} placeholder="+56 9..." className={inp} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Email</label>
              <input type="email" value={form.patientEmail} onChange={set("patientEmail")} placeholder="correo@..." className={inp} />
            </div>
            <div>
              <label className={lbl}>Servicio</label>
              <input type="text" value={form.service} onChange={set("service")} placeholder="Ej: Limpieza dental" className={inp} />
            </div>
          </div>
          {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
          <button type="submit" disabled={saving}
            className="w-full py-3 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "#D95F45" }}>
            {saving ? "Agendando..." : "Confirmar cita"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ── Admin agenda ────────────────────────────────────────────────────── */
function AdminAgenda() {
  const [weekStart, setWeekStart]     = useState(() => getMondayOf(new Date()));
  const [days, setDays]               = useState<DayData[]>([]);
  const [loading, setLoading]         = useState(false);
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()));
  const [doctorFilter, setDoctorFilter] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showNew, setShowNew]         = useState(false);

  const fetchWeek = useCallback(async (start: Date) => {
    const token = getToken(); if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/agenda/week?start=${toDateStr(start)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) { const d = await res.json(); setDays(d.days ?? []); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchWeek(weekStart); }, [weekStart, fetchWeek]);

  const todayStr = toDateStr(new Date());
  const weekEnd  = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 5);

  const weekLabel = (() => {
    const ws = weekStart; const we = weekEnd;
    const sm = MONTHS[ws.getMonth()]; const em = MONTHS[we.getMonth()];
    return ws.getMonth() === we.getMonth()
      ? `${ws.getDate()}–${we.getDate()} ${sm} ${ws.getFullYear()}`
      : `${ws.getDate()} ${sm} – ${we.getDate()} ${em} ${ws.getFullYear()}`;
  })();

  const selectedDay = days.find((d) => d.date === selectedDate);
  let dayBookings = [...(selectedDay?.bookings ?? [])];
  if (doctorFilter) dayBookings = dayBookings.filter((b) => b.doctor === doctorFilter);
  dayBookings.sort((a, b) => a.time.localeCompare(b.time));

  function activeCnt(day: DayData) {
    return day.bookings.filter((b) => b.status !== "cancelled" && (!doctorFilter || b.doctor === doctorFilter)).length;
  }

  async function handleSave(id: string, status: string, notes: string) {
    const token = getToken();
    const res = await fetch(`${API}/api/agenda/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status, notes }),
    });
    if (!res.ok) throw new Error("Error al guardar");
    await fetchWeek(weekStart);
  }

  async function handleCancel(id: string) {
    const token = getToken();
    const res = await fetch(`${API}/api/agenda/bookings/${id}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Error al cancelar");
    await fetchWeek(weekStart);
  }

  async function handleCreate(data: Parameters<typeof handleSave>[0] extends never ? never : {
    doctor: string; date: string; time: string; patientName: string;
    patientRut?: string; patientPhone?: string; patientEmail?: string; service?: string;
  }) {
    const token = getToken();
    const res = await fetch(`${API}/api/agenda/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error ?? "Error"); }
    await fetchWeek(weekStart);
    setSelectedDate(data.date);
  }

  const selectedLabel = (() => {
    const d = new Date(selectedDate + "T12:00:00");
    return `${DAY_FULL[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
  })();

  return (
    <div className="flex flex-col gap-5">
      {/* Week nav */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); }}
            className="w-8 h-8 rounded-lg border border-gray-200 bg-white text-gray-500 hover:border-gray-300 transition flex items-center justify-center font-bold">‹</button>
          <span className="text-sm font-semibold text-gray-700 min-w-[200px] text-center capitalize">{weekLabel}</span>
          <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); }}
            className="w-8 h-8 rounded-lg border border-gray-200 bg-white text-gray-500 hover:border-gray-300 transition flex items-center justify-center font-bold">›</button>
          <button onClick={() => { setWeekStart(getMondayOf(new Date())); setSelectedDate(todayStr); }}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition ml-1">
            Hoy
          </button>
        </div>
        <button onClick={() => setShowNew(true)}
          className="text-sm font-bold px-4 py-2 rounded-xl text-white hover:opacity-90 transition"
          style={{ backgroundColor: "#D95F45", boxShadow: "0 2px 8px rgba(217,95,69,0.3)" }}>
          + Nueva cita
        </button>
      </div>

      {/* Day strip */}
      <div className="grid grid-cols-6 gap-2">
        {loading ? Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[76px] rounded-2xl bg-gray-100 animate-pulse" />
        )) : days.map((day) => {
          const d = new Date(day.date + "T12:00:00");
          const isToday    = day.date === todayStr;
          const isSelected = day.date === selectedDate;
          const cnt = activeCnt(day);
          return (
            <button key={day.date} onClick={() => setSelectedDate(day.date)}
              className={`flex flex-col items-center gap-1 py-3 px-1 rounded-2xl border transition cursor-pointer ${
                isSelected
                  ? "border-blue-600 bg-blue-600 shadow-md"
                  : isToday
                  ? "border-blue-200 bg-blue-50"
                  : "border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm"
              }`}>
              <span className={`text-[9px] font-bold uppercase tracking-wide ${isSelected ? "text-blue-200" : isToday ? "text-blue-500" : "text-gray-400"}`}>
                {DAY_SHORT[d.getDay()]}
              </span>
              <span className={`text-xl font-black leading-none ${isSelected ? "text-white" : isToday ? "text-blue-600" : "text-gray-800"}`}>
                {d.getDate()}
              </span>
              {cnt > 0 ? (
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${isSelected ? "bg-white/20 text-white" : "bg-blue-600 text-white"}`}>
                  {cnt}
                </span>
              ) : (
                <span className={`text-[9px] ${isSelected ? "text-blue-300" : "text-gray-300"}`}>—</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Doctor filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-gray-400">Ver:</span>
        <button onClick={() => setDoctorFilter(null)}
          className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition ${
            !doctorFilter ? "bg-gray-800 text-white border-gray-800" : "border-gray-200 text-gray-500 hover:border-gray-300 bg-white"
          }`}>
          Todos
        </button>
        {DOCTORS.map((doc) => {
          const pal = palOf(doc);
          const short = doc.replace(/Dra?\. /, "").split(" ")[0];
          return (
            <button key={doc} onClick={() => setDoctorFilter(doctorFilter === doc ? null : doc)}
              className="text-xs font-semibold px-3 py-1.5 rounded-full border transition"
              style={doctorFilter === doc
                ? { background: pal.dot, color: "white", borderColor: pal.dot }
                : { background: "white", color: pal.text, borderColor: `${pal.dot}60` }
              }>
              <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle" style={{ background: pal.dot }} />
              {short}
            </button>
          );
        })}
      </div>

      {/* Day timeline */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-800 capitalize">{selectedLabel}</h3>
          <span className="text-xs text-gray-400">
            {dayBookings.filter((b) => b.status !== "cancelled").length} cita{dayBookings.filter((b) => b.status !== "cancelled").length !== 1 ? "s" : ""} activa{dayBookings.filter((b) => b.status !== "cancelled").length !== 1 ? "s" : ""}
          </span>
        </div>

        {dayBookings.length === 0 ? (
          <div className="text-center py-14">
            <p className="text-4xl mb-3">📅</p>
            <p className="text-sm font-medium text-gray-500">Sin citas para este día</p>
            <button onClick={() => setShowNew(true)}
              className="mt-4 text-xs font-bold px-4 py-2 rounded-xl text-white"
              style={{ backgroundColor: "#D95F45" }}>
              + Agregar cita
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {dayBookings.map((b) => {
              const pal = palOf(b.doctor);
              const isCancelled = b.status === "cancelled";
              return (
                <button key={b.id} onClick={() => setSelectedBooking(b)}
                  className={`w-full flex items-center gap-4 px-5 py-3.5 text-left hover:bg-gray-50 transition group ${isCancelled ? "opacity-40" : ""}`}>
                  {/* Time */}
                  <span className="text-sm font-black text-gray-800 w-12 shrink-0 tabular-nums">{b.time}</span>
                  {/* Color bar */}
                  <span className="w-1 h-8 rounded-full shrink-0" style={{ background: pal.dot }} />
                  {/* Doctor (when showing all) */}
                  {!doctorFilter && (
                    <span className="text-xs font-bold shrink-0 w-32 hidden sm:block" style={{ color: pal.text }}>
                      {b.doctor.replace("Dra. ", "").replace("Dr. ", "")}
                    </span>
                  )}
                  {/* Patient info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{b.patientName ?? "—"}</p>
                    <p className="text-xs text-gray-400 truncate">{[b.service, b.patientRut].filter(Boolean).join(" · ")}</p>
                  </div>
                  {/* Phone */}
                  {b.patientPhone && (
                    <span className="text-xs text-gray-400 shrink-0 hidden lg:block">{b.patientPhone}</span>
                  )}
                  {/* Status */}
                  <StatusPill status={b.status} />
                  {/* Edit hint */}
                  <span className="text-xs text-gray-300 group-hover:text-gray-400 transition shrink-0">›</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedBooking && (
        <BookingModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onSave={async (id, status, notes) => { await handleSave(id, status, notes); setSelectedBooking(null); }}
          onCancel={async (id) => { await handleCancel(id); setSelectedBooking(null); }}
        />
      )}
      {showNew && (
        <NewBookingModal
          doctors={DOCTORS}
          initialDate={selectedDate}
          onClose={() => setShowNew(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}

/* ── Doctor (USER) agenda ────────────────────────────────────────────── */
function DoctorAgenda({ user }: { user: AuthUser }) {
  const [days, setDays]     = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken(); if (!token) return;
    fetch(`${API}/api/agenda/week?start=${toDateStr(getMondayOf(new Date()))}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setDays(d.days ?? []))
      .finally(() => setLoading(false));
  }, []);

  const todayStr = toDateStr(new Date());
  const allBookings = days.flatMap((d) => d.bookings.map((b) => ({ ...b, dateStr: d.date })));
  const mine = allBookings.filter((b) => b.doctor === user.name && b.status !== "cancelled");
  const todayMine    = mine.filter((b) => b.dateStr === todayStr).sort((a, b) => a.time.localeCompare(b.time));
  const upcomingMine = mine.filter((b) => b.dateStr > todayStr).sort((a, b) =>
    a.dateStr === b.dateStr ? a.time.localeCompare(b.time) : a.dateStr.localeCompare(b.dateStr)
  );

  const pal = palOf(user.name);
  const initials = user.name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  function BookingRow({ b, showDate = false }: { b: typeof mine[0]; showDate?: boolean }) {
    return (
      <div className="flex items-center gap-4 px-5 py-4">
        {showDate ? (
          <div className="text-center shrink-0 w-16">
            <p className="text-[10px] font-bold text-gray-400 uppercase leading-none mb-0.5">
              {DAY_SHORT[new Date(b.dateStr + "T12:00:00").getDay()]}
            </p>
            <p className="text-sm font-black text-gray-800 tabular-nums">{b.time}</p>
          </div>
        ) : (
          <span className="text-sm font-black text-gray-800 w-16 shrink-0 tabular-nums">{b.time}</span>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">{b.patientName ?? "—"}</p>
          <p className="text-xs text-gray-400 truncate">{[b.service, b.patientRut].filter(Boolean).join(" · ")}</p>
        </div>
        {b.patientPhone && <span className="text-xs text-gray-400 hidden sm:block">{b.patientPhone}</span>}
        <StatusPill status={b.status} />
      </div>
    );
  }

  function Section({ title, bookings, empty, showDate = false }: {
    title: string; bookings: typeof mine; empty: string; showDate?: boolean;
  }) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-50">
          <h3 className="text-sm font-bold text-gray-800">{title}</h3>
        </div>
        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : bookings.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">{empty}</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {bookings.map((b) => <BookingRow key={b.id} b={b} showDate={showDate} />)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Doctor identity card */}
      <div className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
        <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-black shrink-0"
          style={{ background: pal.bg, color: pal.text, border: `2px solid ${pal.dot}` }}>
          {initials}
        </div>
        <div>
          <p className="text-base font-bold text-gray-800">{user.name}</p>
          <p className="text-sm font-semibold" style={{ color: pal.dot }}>
            {todayMine.length} cita{todayMine.length !== 1 ? "s" : ""} hoy
            {upcomingMine.length > 0 && ` · ${upcomingMine.length} próxima${upcomingMine.length !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      <Section title="Mis citas de hoy" bookings={todayMine} empty="No tienes citas para hoy" />
      <Section title="Próximas citas esta semana" bookings={upcomingMine} empty="Sin citas próximas" showDate />
    </div>
  );
}

/* ── Main export ─────────────────────────────────────────────────────── */
export function AgendaTab({ user }: { user: AuthUser }) {
  const isAdmin = user.role === "ADMIN" || user.role === "SUPERADMIN";
  return isAdmin ? <AdminAgenda /> : <DoctorAgenda user={user} />;
}
