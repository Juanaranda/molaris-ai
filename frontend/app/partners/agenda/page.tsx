"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getMe, getToken } from "@/lib/auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const C = {
  bg: "#F7F5F1",
  card: "#FDFCFB",
  border: "#E5E0D9",
  primary: "#0B2F42",
  accent: "#1A5C7A",
  coral: "#D95F45",
  text: "#0C1B26",
  muted: "#607281",
};

interface Booking {
  id: string;
  doctor: string;
  time: string;
  date: string;
  patientName: string | null;
  patientRut: string | null;
  patientPhone: string | null;
  patientEmail: string | null;
  service: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
}

interface DayData {
  date: string;
  bookings: Booking[];
}

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTH_LABELS = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

const GALANA_DOCTORS = [
  "Dra. Ana Aranda",
  "Dra. Ivonne Poblete",
  "Dr. Pedro Engel",
  "Dr. Juan Garcés",
  "Dra. Jacqueline Pérez",
];

function getMondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    confirmed: { label: "Confirmada", bg: "#ECFDF5", color: "#059669" },
    pending:   { label: "Pendiente",  bg: "#FFFBEB", color: "#B45309" },
    cancelled: { label: "Cancelada",  bg: "#F5F5F5", color: "#9CA3AF" },
  };
  const v = map[status] ?? map.pending;
  return (
    <span style={{ background: v.bg, color: v.color, fontSize: 11, fontWeight: 600,
      padding: "2px 8px", borderRadius: 20, whiteSpace: "nowrap" }}>{v.label}</span>
  );
}

/* ── Booking detail modal ──────────────────────────────────────────────────── */
function BookingModal({ booking, onClose, onSave, onCancel }: {
  booking: Booking;
  onClose: () => void;
  onSave: (id: string, status: string, notes: string) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
}) {
  const [status, setStatus] = useState(booking.status);
  const [notes, setNotes] = useState(booking.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  async function handleSave() {
    setSaving(true);
    try { await onSave(booking.id, status, notes); onClose(); }
    finally { setSaving(false); }
  }

  async function handleCancel() {
    if (!confirm("¿Cancelar esta cita?")) return;
    setCancelling(true);
    try { await onCancel(booking.id); onClose(); }
    finally { setCancelling(false); }
  }

  const overlayStyle: React.CSSProperties = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 50,
    display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
  };
  const modalStyle: React.CSSProperties = {
    background: C.card, borderRadius: 16, border: `1px solid ${C.border}`,
    width: "100%", maxWidth: 480, padding: 28, display: "flex", flexDirection: "column", gap: 18,
  };

  return (
    <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modalStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: C.primary }}>Detalle de cita</h2>
          <button onClick={onClose} style={{ color: C.muted, fontSize: 20, background: "none", border: "none", cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 20px", fontSize: 13 }}>
          {[
            ["Paciente", booking.patientName ?? "—"],
            ["RUT", booking.patientRut ?? "—"],
            ["Teléfono", booking.patientPhone ?? "—"],
            ["Email", booking.patientEmail ?? "—"],
            ["Doctor", booking.doctor],
            ["Fecha", new Date(booking.date).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })],
            ["Hora", booking.time],
            ["Servicio", booking.service ?? "—"],
          ].map(([label, val]) => (
            <div key={label}>
              <p style={{ color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>{label}</p>
              <p style={{ color: C.text, fontWeight: 500 }}>{val}</p>
            </div>
          ))}
        </div>

        <div>
          <label style={{ display: "block", color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Estado</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            style={{ width: "100%", padding: "8px 12px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 13, color: C.text, background: "white" }}>
            <option value="confirmed">Confirmada</option>
            <option value="pending">Pendiente</option>
            <option value="cancelled">Cancelada</option>
          </select>
        </div>

        <div>
          <label style={{ display: "block", color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Notas</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
            placeholder="Observaciones internas..."
            style={{ width: "100%", padding: "8px 12px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 13, color: C.text, resize: "vertical", boxSizing: "border-box" }} />
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={handleSave} disabled={saving}
            style={{ flex: 1, padding: "10px 0", borderRadius: 10, background: C.accent, color: "white", fontWeight: 600, fontSize: 13, border: "none", cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
          <button onClick={handleCancel} disabled={cancelling}
            style={{ padding: "10px 16px", borderRadius: 10, background: "#FEE2E2", color: C.coral, fontWeight: 600, fontSize: 13, border: "none", cursor: "pointer", opacity: cancelling ? 0.6 : 1 }}>
            {cancelling ? "..." : "Cancelar cita"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── New booking modal ─────────────────────────────────────────────────────── */
function NewBookingModal({ doctors, onClose, onCreate }: {
  doctors: string[];
  onClose: () => void;
  onCreate: (data: { doctor: string; date: string; time: string; patientName: string; patientRut?: string; patientPhone?: string; patientEmail?: string; service?: string }) => Promise<void>;
}) {
  const today = toDateStr(new Date());
  const [form, setForm] = useState({ doctor: doctors[0] ?? "", date: today, time: "10:00", patientName: "", patientRut: "", patientPhone: "", patientEmail: "", service: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.doctor || !form.date || !form.time || !form.patientName) {
      setError("Doctor, fecha, hora y nombre son obligatorios"); return;
    }
    setSaving(true); setError("");
    try {
      await onCreate({
        doctor: form.doctor, date: form.date, time: form.time,
        patientName: form.patientName,
        patientRut: form.patientRut || undefined,
        patientPhone: form.patientPhone || undefined,
        patientEmail: form.patientEmail || undefined,
        service: form.service || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear cita");
    } finally { setSaving(false); }
  }

  const field = (label: string, key: keyof typeof form, type = "text", required = false) => (
    <div>
      <label style={{ display: "block", color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
        {label}{required && " *"}
      </label>
      <input type={type} value={form[key]} required={required}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        style={{ width: "100%", padding: "8px 12px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 13, color: C.text, boxSizing: "border-box" }} />
    </div>
  );

  const overlayStyle: React.CSSProperties = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 50,
    display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
  };
  const modalStyle: React.CSSProperties = {
    background: C.card, borderRadius: 16, border: `1px solid ${C.border}`,
    width: "100%", maxWidth: 460, padding: 28,
  };

  return (
    <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modalStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: C.primary }}>Nueva cita</h2>
          <button onClick={onClose} style={{ color: C.muted, fontSize: 20, background: "none", border: "none", cursor: "pointer" }}>✕</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Doctor *</label>
            <select value={form.doctor} onChange={(e) => setForm((f) => ({ ...f, doctor: e.target.value }))} required
              style={{ width: "100%", padding: "8px 12px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 13, color: C.text, background: "white" }}>
              {doctors.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {field("Fecha", "date", "date", true)}
            {field("Hora", "time", "time", true)}
          </div>
          {field("Nombre paciente", "patientName", "text", true)}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {field("RUT", "patientRut")}
            {field("Teléfono", "patientPhone", "tel")}
          </div>
          {field("Email", "patientEmail", "email")}
          {field("Servicio", "service")}
          {error && <p style={{ color: C.coral, fontSize: 12 }}>{error}</p>}
          <button type="submit" disabled={saving}
            style={{ padding: "10px 0", borderRadius: 10, background: C.coral, color: "white", fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Creando..." : "Confirmar cita"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ── Main page ─────────────────────────────────────────────────────────────── */
export default function AgendaPage() {
  const router = useRouter();
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOf(new Date()));
  const [days, setDays] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(toDateStr(new Date()));
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  // Auth guard
  useEffect(() => {
    getMe().then((data) => {
      if (!data) { router.push("/login"); return; }
      setAuthChecked(true);
    });
  }, [router]);

  const fetchWeek = useCallback(async (start: Date) => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/agenda/week?start=${toDateStr(start)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDays(data.days ?? []);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (authChecked) fetchWeek(weekStart);
  }, [authChecked, weekStart, fetchWeek]);

  function prevWeek() { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); }
  function nextWeek() { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); }
  function goToday() { setWeekStart(getMondayOf(new Date())); setSelectedDate(toDateStr(new Date())); }

  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 5);
  const weekLabel = weekStart.getMonth() === weekEnd.getMonth()
    ? `${weekStart.getDate()} - ${weekEnd.getDate()} de ${MONTH_LABELS[weekStart.getMonth()]} ${weekStart.getFullYear()}`
    : `${weekStart.getDate()} ${MONTH_LABELS[weekStart.getMonth()]} - ${weekEnd.getDate()} ${MONTH_LABELS[weekEnd.getMonth()]} ${weekStart.getFullYear()}`;

  const todayStr = toDateStr(new Date());
  const selectedDay = days.find((d) => d.date === selectedDate);
  const bookingsByDoctor: Record<string, Booking[]> = {};
  (selectedDay?.bookings ?? []).forEach((b) => {
    if (!bookingsByDoctor[b.doctor]) bookingsByDoctor[b.doctor] = [];
    bookingsByDoctor[b.doctor].push(b);
  });

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

  async function handleCancelBooking(id: string) {
    const token = getToken();
    const res = await fetch(`${API}/api/agenda/bookings/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Error al cancelar");
    await fetchWeek(weekStart);
  }

  async function handleCreate(data: { doctor: string; date: string; time: string; patientName: string; patientRut?: string; patientPhone?: string; patientEmail?: string; service?: string }) {
    const token = getToken();
    const res = await fetch(`${API}/api/agenda/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? "Error al crear cita");
    }
    await fetchWeek(weekStart);
    setSelectedDate(data.date);
  }

  if (!authChecked) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 32, height: 32, border: `3px solid ${C.accent}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ background: C.card, borderBottom: `1px solid ${C.border}`, padding: "20px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.primary, margin: 0 }}>Agenda</h1>
          <p style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>Gestiona tus citas</p>
        </div>
        <button onClick={() => setShowNewModal(true)}
          style={{ background: C.coral, color: "white", border: "none", borderRadius: 10, padding: "10px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          + Nueva cita
        </button>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px" }}>

        {/* Week navigation */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <button onClick={prevWeek} style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, fontSize: 13, cursor: "pointer", color: C.text }}>
            &lt; Semana anterior
          </button>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.primary, flex: 1, textAlign: "center" }}>{weekLabel}</span>
          <button onClick={goToday} style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, fontSize: 13, cursor: "pointer", color: C.accent }}>
            Hoy
          </button>
          <button onClick={nextWeek} style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, fontSize: 13, cursor: "pointer", color: C.text }}>
            Semana siguiente &gt;
          </button>
        </div>

        {/* Day columns */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, marginBottom: 24 }}>
          {loading ? Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ height: 80, background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, opacity: 0.5 }} />
          )) : days.map((day) => {
            const d = new Date(day.date + "T12:00:00");
            const isToday = day.date === todayStr;
            const isSelected = day.date === selectedDate;
            const count = day.bookings.length;
            return (
              <button key={day.date} onClick={() => setSelectedDate(day.date)}
                style={{
                  padding: "12px 8px", borderRadius: 12, cursor: "pointer", border: isSelected ? `2px solid ${C.accent}` : `1px solid ${C.border}`,
                  background: isSelected ? `${C.accent}15` : isToday ? `${C.primary}08` : C.card,
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: isToday ? C.accent : C.muted, textTransform: "uppercase" }}>
                  {DAY_LABELS[d.getDay()]}
                </span>
                <span style={{ fontSize: 20, fontWeight: 800, color: isToday ? C.accent : C.primary }}>{d.getDate()}</span>
                {count > 0 ? (
                  <span style={{ fontSize: 10, fontWeight: 600, background: C.accent, color: "white", padding: "1px 7px", borderRadius: 20 }}>
                    {count} {count === 1 ? "cita" : "citas"}
                  </span>
                ) : (
                  <span style={{ fontSize: 10, color: C.muted }}>Sin citas</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected day detail */}
        <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: C.primary }}>
              {selectedDate ? (() => {
                const d = new Date(selectedDate + "T12:00:00");
                return `${DAY_LABELS[d.getDay()]} ${d.getDate()} de ${MONTH_LABELS[d.getMonth()]}`;
              })() : "Selecciona un día"}
            </h2>
            <span style={{ fontSize: 13, color: C.muted }}>
              {selectedDay?.bookings.length ?? 0} citas
            </span>
          </div>

          {!selectedDay || selectedDay.bookings.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: C.muted }}>
              <p style={{ fontSize: 14 }}>No hay citas para este dia</p>
              <button onClick={() => setShowNewModal(true)}
                style={{ marginTop: 12, padding: "8px 18px", borderRadius: 8, background: C.coral, color: "white", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Agregar cita
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {Object.entries(bookingsByDoctor).map(([doctor, bkgs]) => (
                <div key={doctor}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: C.accent, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>{doctor}</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {bkgs.map((b) => (
                      <button key={b.id} onClick={() => setSelectedBooking(b)}
                        style={{
                          display: "grid", gridTemplateColumns: "56px 1fr auto", gap: 12, alignItems: "center",
                          padding: "14px 16px", borderRadius: 12, border: `1px solid ${C.border}`,
                          background: b.status === "cancelled" ? "#F9F9F9" : "white",
                          cursor: "pointer", textAlign: "left",
                          opacity: b.status === "cancelled" ? 0.6 : 1,
                        }}>
                        <span style={{ fontSize: 18, fontWeight: 800, color: C.primary }}>{b.time}</span>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: 0 }}>{b.patientName ?? "—"}</p>
                          {b.patientRut && <p style={{ fontSize: 12, color: C.muted, margin: "2px 0 0" }}>{b.patientRut}</p>}
                          {b.service && <p style={{ fontSize: 12, color: C.muted, margin: "2px 0 0" }}>{b.service}</p>}
                        </div>
                        <StatusBadge status={b.status} />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedBooking && (
        <BookingModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onSave={handleSave}
          onCancel={handleCancelBooking}
        />
      )}

      {showNewModal && (
        <NewBookingModal
          doctors={GALANA_DOCTORS}
          onClose={() => setShowNewModal(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}
