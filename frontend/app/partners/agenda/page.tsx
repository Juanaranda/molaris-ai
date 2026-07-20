"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getMe, getToken } from "@/lib/auth";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const C = {
  bg: "#F0EDE8", card: "#FDFCFB", border: "#E5E0D9",
  primary: "#0B2F42", accent: "#1A5C7A", coral: "#D95F45",
  text: "#0C1B26", muted: "#607281",
};

const PALETTE = [
  { light: "#D1FAE5", text: "#065F46", solid: "#10B981", avatar: "#ECFDF5" },
  { light: "#DBEAFE", text: "#1E40AF", solid: "#3B82F6", avatar: "#EFF6FF" },
  { light: "#EDE9FE", text: "#5B21B6", solid: "#8B5CF6", avatar: "#F5F3FF" },
  { light: "#FEF3C7", text: "#92400E", solid: "#F59E0B", avatar: "#FFFBEB" },
  { light: "#FCE7F3", text: "#9D174D", solid: "#EC4899", avatar: "#FDF2F8" },
];

const FALLBACK_DOCTORS = [
  "Dr. Ivonne Poblete", "Dr. Juan Garcés", "Dr. Javiera Palmilla",
  "Dr. Nicolás Rojas", "Dr. Yamileth Zerpa",
];

const DAY_LABELS  = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
const MONTH_LABELS = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

const GRID_START  = 9;
const GRID_END    = 19;
const SLOT_H      = 56;  // px per 30-min slot

function timeLabels(): string[] {
  const out: string[] = [];
  for (let h = GRID_START; h < GRID_END; h++) {
    out.push(`${String(h).padStart(2,"0")}:00`);
    out.push(`${String(h).padStart(2,"0")}:30`);
  }
  return out;
}
const TIME_SLOTS = timeLabels();

function slotIndexOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h - GRID_START) * 2 + Math.floor(m / 30);
}

function getMondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateStr(d: Date): string { return d.toISOString().slice(0, 10); }

interface Booking {
  id: string; doctor: string; time: string; date: string;
  patientName: string | null; patientRut: string | null;
  patientPhone: string | null; patientEmail: string | null;
  service: string | null; status: string; notes: string | null; createdAt: string;
}
interface DayData { date: string; bookings: Booking[]; }
type ViewMode = "day" | "week";

/* ── helpers ─────────────────────────────────────────────────────────────── */
function buildPalMap(doctors: string[]) {
  return Object.fromEntries(doctors.map((d, i) => [d, PALETTE[i % PALETTE.length]]));
}

function nowOffsetPx(): number {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  return ((mins - GRID_START * 60) / 30) * SLOT_H;
}
function isWithinGrid(): boolean {
  const h = new Date().getHours();
  return h >= GRID_START && h < GRID_END;
}

/* ── Status pill ──────────────────────────────────────────────────────────── */
function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    confirmed: { label: "Confirmada", bg: "#D1FAE5", color: "#065F46" },
    pending:   { label: "Pendiente",  bg: "#FEF3C7", color: "#92400E" },
    cancelled: { label: "Cancelada",  bg: "#F1F5F9", color: "#94A3B8" },
  };
  const v = map[status] ?? map.pending;
  return (
    <span style={{ background: v.bg, color: v.color, fontSize: 10, fontWeight: 700,
      padding: "2px 8px", borderRadius: 20, whiteSpace: "nowrap" }}>
      {v.label}
    </span>
  );
}

/* ── Full booking card (day view) ─────────────────────────────────────────── */
function BookingCard({ booking, color, onClick }: {
  booking: Booking; color: (typeof PALETTE)[0]; onClick: () => void;
}) {
  const cancelled = booking.status === "cancelled";
  return (
    <div onClick={(e) => { e.stopPropagation(); onClick(); }} style={{
      background: cancelled ? "#F8FAFC" : color.avatar,
      border: `1.5px solid ${cancelled ? "#E2E8F0" : color.solid}`,
      borderLeft: `4px solid ${cancelled ? "#CBD5E1" : color.solid}`,
      borderRadius: 10, padding: "8px 10px", cursor: "pointer",
      opacity: cancelled ? 0.55 : 1, transition: "box-shadow 0.15s, transform 0.15s",
      display: "flex", flexDirection: "column", gap: 2, overflow: "hidden",
    }}
    onMouseEnter={(e) => {
      (e.currentTarget as HTMLDivElement).style.boxShadow = `0 4px 16px ${color.solid}30`;
      (e.currentTarget as HTMLDivElement).style.transform = "translateY(-1px)";
    }}
    onMouseLeave={(e) => {
      (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
      (e.currentTarget as HTMLDivElement).style.transform = "none";
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: cancelled ? "#94A3B8" : color.solid }}>{booking.time}</span>
        <StatusPill status={booking.status} />
      </div>
      <p style={{ fontSize: 12, fontWeight: 700, color: cancelled ? "#94A3B8" : C.text,
        margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {booking.patientName ?? "—"}
      </p>
      {booking.service && (
        <p style={{ fontSize: 11, color: C.muted, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {booking.service}
        </p>
      )}
    </div>
  );
}

/* ── Mini card (week view) ────────────────────────────────────────────────── */
function MiniCard({ booking, color, onClick }: {
  booking: Booking; color: (typeof PALETTE)[0]; onClick: () => void;
}) {
  const cancelled = booking.status === "cancelled";
  return (
    <div onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        borderLeft: `3px solid ${cancelled ? "#CBD5E1" : color.solid}`,
        background: cancelled ? "#F8FAFC" : color.avatar,
        borderRadius: 5, padding: "3px 6px", cursor: "pointer",
        opacity: cancelled ? 0.5 : 1, marginBottom: 2,
        transition: "filter 0.1s",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.filter = "brightness(0.94)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.filter = "none"; }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: color.solid, whiteSpace: "nowrap" }}>{booking.time}</span>
        <span style={{ fontSize: 10, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {booking.patientName ?? "—"}
        </span>
      </div>
      {booking.service && (
        <p style={{ margin: 0, fontSize: 9, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {booking.service}
        </p>
      )}
    </div>
  );
}

/* ── Time axis shared component ───────────────────────────────────────────── */
function TimeCell({ rowIdx }: { rowIdx: number }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "flex-end",
      paddingRight: 10, paddingTop: 4, flexShrink: 0 }}>
      {rowIdx % 2 === 0 && (
        <span style={{ fontSize: 11, fontWeight: 600, color: C.muted, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
          {TIME_SLOTS[rowIdx]}
        </span>
      )}
    </div>
  );
}

/* ── Day view grid (doctors = columns) ────────────────────────────────────── */
function DayGrid({ bookings, doctors, onSelect, onNewBooking }: {
  bookings: Booking[];
  doctors: string[];
  onSelect: (b: Booking) => void;
  onNewBooking: (time: string) => void;
}) {
  const palMap = buildPalMap(doctors);
  const cols = doctors.length;

  return (
    <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "calc(100vh - 310px)", position: "relative" }}>
      <div style={{ minWidth: 600 }}>
        {/* Doctor headers */}
        <div style={{
          display: "grid", gridTemplateColumns: `56px repeat(${cols}, 1fr)`,
          borderBottom: `2px solid ${C.border}`, position: "sticky", top: 0, background: C.card, zIndex: 10,
        }}>
          <div />
          {doctors.map((doc, i) => {
            const pal = palMap[doc] ?? PALETTE[i % PALETTE.length];
            const abbr = doc.replace("Dra. ","").replace("Dr. ","");
            const [first, ...rest] = abbr.split(" ");
            return (
              <div key={doc} style={{ padding: "12px 10px", display: "flex", alignItems: "center", gap: 8,
                borderLeft: `1px solid ${C.border}` }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, background: pal.light,
                  border: `2px solid ${pal.solid}`, display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 800, color: pal.text }}>
                  {(first[0] + (rest[0]?.[0] ?? "")).toUpperCase()}
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: C.primary, lineHeight: 1.2 }}>{first}</p>
                  <p style={{ margin: 0, fontSize: 10, color: C.muted }}>{rest.join(" ")}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Grid rows */}
        <div style={{ position: "relative" }}>
          {isWithinGrid() && (
            <div style={{ position: "absolute", left: 56, right: 0, top: nowOffsetPx(), height: 2,
              background: "#EF4444", zIndex: 5, pointerEvents: "none" }}>
              <div style={{ width: 8, height: 8, background: "#EF4444", borderRadius: "50%",
                position: "absolute", left: -4, top: -3 }} />
            </div>
          )}

          {TIME_SLOTS.map((slot, rowIdx) => (
            <div key={slot} style={{
              display: "grid", gridTemplateColumns: `56px repeat(${cols}, 1fr)`,
              height: SLOT_H, borderBottom: `1px solid ${rowIdx % 2 === 1 ? C.border : "#F0EDE8"}`,
            }}>
              <TimeCell rowIdx={rowIdx} />
              {doctors.map((doc, colIdx) => {
                const pal = palMap[doc] ?? PALETTE[colIdx % PALETTE.length];
                const cell = bookings.filter((b) => b.doctor === doc && slotIndexOf(b.time) === rowIdx);
                return (
                  <div key={doc}
                    onClick={() => { if (!cell.length) onNewBooking(slot); }}
                    style={{ borderLeft: `1px solid ${C.border}`, padding: "4px 5px",
                      display: "flex", flexDirection: "column", gap: 3,
                      cursor: cell.length ? "default" : "pointer" }}
                    onMouseEnter={(e) => { if (!cell.length) (e.currentTarget as HTMLDivElement).style.background = `${C.accent}08`; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}>
                    {cell.map((b) => (
                      <BookingCard key={b.id} booking={b} color={pal} onClick={() => onSelect(b)} />
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Week view grid (days = columns) ──────────────────────────────────────── */
function WeekGrid({ days, doctors, onSelect, onNewBooking }: {
  days: DayData[];
  doctors: string[];
  onSelect: (b: Booking) => void;
  onNewBooking: (date: string, time: string) => void;
}) {
  const todayStr = toDateStr(new Date());
  const palMap = buildPalMap(doctors);
  const todayIdx = days.findIndex((d) => d.date === todayStr);

  return (
    <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "calc(100vh - 190px)", position: "relative" }}>
      <div style={{ minWidth: 700 }}>
        {/* Day headers */}
        <div style={{
          display: "grid", gridTemplateColumns: `56px repeat(${days.length}, minmax(110px, 1fr))`,
          borderBottom: `2px solid ${C.border}`, position: "sticky", top: 0, background: C.card, zIndex: 10,
        }}>
          <div />
          {days.map((day) => {
            const d = new Date(day.date + "T12:00:00");
            const isToday = day.date === todayStr;
            const count = day.bookings.filter((b) => b.status !== "cancelled").length;
            return (
              <div key={day.date} style={{
                padding: "10px 8px", borderLeft: `1px solid ${C.border}`, textAlign: "center",
                background: isToday ? `${C.accent}0C` : "transparent",
              }}>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
                  textTransform: "uppercase", color: isToday ? C.accent : C.muted }}>
                  {DAY_LABELS[d.getDay()]}
                </p>
                <p style={{ margin: "2px 0 4px", fontSize: 22, fontWeight: 900, lineHeight: 1,
                  color: isToday ? C.accent : C.primary }}>
                  {d.getDate()}
                </p>
                {count > 0 && (
                  <span style={{ fontSize: 10, background: isToday ? C.accent : C.coral,
                    color: "white", padding: "1px 8px", borderRadius: 20, fontWeight: 700 }}>
                    {count}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Grid rows */}
        <div style={{ position: "relative" }}>
          {/* Now line — only in today's column */}
          {isWithinGrid() && todayIdx >= 0 && (
            <div style={{
              position: "absolute",
              // each col = (100% - 56px) / days.length, offset by todayIdx cols + 56px label
              left: `calc(56px + ${todayIdx} * (100% - 56px) / ${days.length})`,
              width: `calc((100% - 56px) / ${days.length})`,
              top: nowOffsetPx(), height: 2,
              background: "#EF4444", zIndex: 5, pointerEvents: "none",
            }}>
              <div style={{ width: 8, height: 8, background: "#EF4444", borderRadius: "50%",
                position: "absolute", left: -4, top: -3 }} />
            </div>
          )}

          {TIME_SLOTS.map((slot, rowIdx) => (
            <div key={slot} style={{
              display: "grid", gridTemplateColumns: `56px repeat(${days.length}, minmax(110px, 1fr))`,
              minHeight: SLOT_H, borderBottom: `1px solid ${rowIdx % 2 === 1 ? C.border : "#F0EDE8"}`,
            }}>
              <TimeCell rowIdx={rowIdx} />
              {days.map((day) => {
                const isToday = day.date === todayStr;
                const cell = day.bookings.filter((b) => slotIndexOf(b.time) === rowIdx);
                return (
                  <div key={day.date}
                    onClick={() => { if (!cell.length) onNewBooking(day.date, slot); }}
                    style={{
                      borderLeft: `1px solid ${C.border}`, padding: "3px 4px",
                      background: isToday ? `${C.accent}06` : "transparent",
                      cursor: cell.length ? "default" : "pointer",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => { if (!cell.length) (e.currentTarget as HTMLDivElement).style.background = `${C.accent}10`; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = isToday ? `${C.accent}06` : "transparent"; }}>
                    {cell.map((b) => {
                      const color = palMap[b.doctor] ?? PALETTE[0];
                      return <MiniCard key={b.id} booking={b} color={color} onClick={() => onSelect(b)} />;
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Booking detail modal ─────────────────────────────────────────────────── */
function BookingModal({ booking, doctorIndex, onClose, onSave, onCancel }: {
  booking: Booking; doctorIndex: number;
  onClose: () => void;
  onSave: (id: string, status: string, notes: string) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
}) {
  const [status, setStatus] = useState(booking.status);
  const [notes, setNotes]   = useState(booking.notes ?? "");
  const [saving, setSaving]     = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const pal = PALETTE[doctorIndex % PALETTE.length];

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

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth
      slotProps={{
        paper: { sx: { borderRadius: 3, border: `1px solid ${C.border}`, boxShadow: "0 24px 64px rgba(0,0,0,0.15)" } },
        backdrop: { sx: { backdropFilter: "blur(4px)", background: "rgba(11,47,66,0.45)" } },
      }}>
      <div style={{ background: pal.light, padding: "20px 24px", borderBottom: `1px solid ${pal.solid}30`,
        display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: pal.text, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {booking.doctor}
          </p>
          <h2 style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 800, color: C.primary }}>
            {booking.patientName ?? "Paciente sin nombre"}
          </h2>
        </div>
        <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: "50%",
          background: "rgba(0,0,0,0.08)", border: "none", cursor: "pointer",
          fontSize: 16, color: C.muted, display: "flex", alignItems: "center", justifyContent: "center" }}>
          ✕
        </button>
      </div>

      <DialogContent sx={{ p: 3, display: "flex", flexDirection: "column", gap: 2.5 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 24px" }}>
          {[
            ["Hora", booking.time],
            ["Fecha", new Date(booking.date).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })],
            ["RUT", booking.patientRut ?? "—"],
            ["Teléfono", booking.patientPhone ?? "—"],
            ["Email", booking.patientEmail ?? "—"],
            ["Servicio", booking.service ?? "—"],
          ].map(([label, val]) => (
            <div key={label}>
              <p style={{ color: C.muted, fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                letterSpacing: "0.07em", margin: "0 0 3px" }}>{label}</p>
              <p style={{ color: C.text, fontWeight: 600, fontSize: 13, margin: 0 }}>{val}</p>
            </div>
          ))}
        </div>

        <div>
          <label style={{ display: "block", color: C.muted, fontSize: 10, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Estado</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            style={{ width: "100%", padding: "10px 14px", borderRadius: 12, border: `1.5px solid ${C.border}`,
              fontSize: 13, fontWeight: 600, color: C.text, background: "white", appearance: "auto" }}>
            <option value="confirmed">Confirmada</option>
            <option value="pending">Pendiente</option>
            <option value="cancelled">Cancelada</option>
          </select>
        </div>

        <div>
          <label style={{ display: "block", color: C.muted, fontSize: 10, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Notas internas</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
            placeholder="Observaciones, indicaciones, etc."
            style={{ width: "100%", padding: "10px 14px", borderRadius: 12, border: `1.5px solid ${C.border}`,
              fontSize: 13, color: C.text, resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} />
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={handleSave} disabled={saving}
            style={{ flex: 1, padding: "12px 0", borderRadius: 12, background: pal.solid, color: "white",
              fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer",
              opacity: saving ? 0.6 : 1, transition: "opacity 0.15s" }}>
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
          <button onClick={handleCancel} disabled={cancelling}
            style={{ padding: "12px 18px", borderRadius: 12, background: "#FEE2E2", color: "#DC2626",
              fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer",
              opacity: cancelling ? 0.6 : 1 }}>
            {cancelling ? "..." : "Cancelar cita"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── New booking modal ────────────────────────────────────────────────────── */
const TIME_OPTIONS: string[] = [];
for (let h = 9; h < 19; h++) {
  TIME_OPTIONS.push(`${String(h).padStart(2,"0")}:00`);
  TIME_OPTIONS.push(`${String(h).padStart(2,"0")}:30`);
}

function NewBookingModal({ doctors, initialDate, initialTime, open, onClose, onCreate }: {
  doctors: string[]; initialDate: string; initialTime: string; open: boolean;
  onClose: () => void;
  onCreate: (data: { doctor: string; date: string; time: string; patientName: string; patientRut?: string; patientPhone?: string; patientEmail?: string; service?: string }) => Promise<void>;
}) {
  const [form, setForm] = useState({
    doctor: doctors[0] ?? "", date: initialDate, time: initialTime,
    patientName: "", patientRut: "", patientPhone: "", patientEmail: "", service: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  // Sync pre-filled values whenever the modal opens
  useEffect(() => {
    if (open) setForm((f) => ({ ...f, date: initialDate, time: initialTime }));
  }, [open, initialDate, initialTime]);

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

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 14px", borderRadius: 12, border: `1.5px solid ${C.border}`,
    fontSize: 13, color: C.text, boxSizing: "border-box", fontFamily: "inherit", background: "white",
  };
  const labelStyle: React.CSSProperties = {
    display: "block", color: C.muted, fontSize: 10, fontWeight: 700,
    textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5,
  };
  const set = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      slotProps={{
        paper: { sx: { borderRadius: 3, border: `1px solid ${C.border}`, boxShadow: "0 24px 64px rgba(0,0,0,0.15)" } },
        backdrop: { sx: { backdropFilter: "blur(4px)", background: "rgba(11,47,66,0.45)" } },
      }}>
      <div style={{ padding: "20px 24px", borderBottom: `1px solid ${C.border}`,
        display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, color: C.muted, fontWeight: 600 }}>Nueva cita</p>
          <h2 style={{ margin: "2px 0 0", fontSize: 20, fontWeight: 800, color: C.primary }}>Agendar paciente</h2>
        </div>
        <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: "50%",
          background: "#F1F5F9", border: "none", cursor: "pointer", fontSize: 16, color: C.muted }}>✕</button>
      </div>

      <DialogContent sx={{ p: 3 }}>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelStyle}>Profesional *</label>
            <select value={form.doctor} onChange={set("doctor")} required style={{ ...inputStyle, appearance: "auto" }}>
              {doctors.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Fecha *</label>
              <input type="date" value={form.date} onChange={set("date")} required style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Hora *</label>
              <select value={form.time} onChange={set("time")} required style={{ ...inputStyle, appearance: "auto" }}>
                {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Nombre paciente *</label>
            <input type="text" value={form.patientName} onChange={set("patientName")} required
              placeholder="Nombre completo" style={inputStyle} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>RUT</label>
              <input type="text" value={form.patientRut} onChange={set("patientRut")} placeholder="12.345.678-9" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Teléfono</label>
              <input type="tel" value={form.patientPhone} onChange={set("patientPhone")} placeholder="+56 9..." style={inputStyle} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Email</label>
              <input type="email" value={form.patientEmail} onChange={set("patientEmail")} placeholder="correo@..." style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Servicio</label>
              <input type="text" value={form.service} onChange={set("service")} placeholder="Ej: Limpieza dental" style={inputStyle} />
            </div>
          </div>

          {error && (
            <div style={{ background: "#FEE2E2", border: "1px solid #FECACA", borderRadius: 10,
              padding: "10px 14px", color: "#DC2626", fontSize: 12, fontWeight: 600 }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={saving}
            style={{ padding: "14px 0", borderRadius: 12, background: C.coral, color: "white",
              fontWeight: 800, fontSize: 14, border: "none", cursor: "pointer",
              opacity: saving ? 0.6 : 1, boxShadow: "0 4px 16px rgba(217,95,69,0.35)" }}>
            {saving ? "Agendando..." : "Confirmar cita"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ── Main page ────────────────────────────────────────────────────────────── */
export default function AgendaPage() {
  const router = useRouter();
  const [viewMode, setViewMode]       = useState<ViewMode>("week");
  const [weekStart, setWeekStart]     = useState<Date>(() => getMondayOf(new Date()));
  const [days, setDays]               = useState<DayData[]>([]);
  const [loading, setLoading]         = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(toDateStr(new Date()));
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newDefaults, setNewDefaults] = useState({ date: toDateStr(new Date()), time: "10:00" });
  const [authChecked, setAuthChecked] = useState(false);
  const [clinicDoctors, setClinicDoctors] = useState<string[]>(FALLBACK_DOCTORS);

  useEffect(() => {
    getMe().then((data) => {
      if (!data) { router.push("/login"); return; }
      const cfg = data.clinic?.config as { doctors?: { name: string }[] } | undefined;
      if (cfg?.doctors?.length) setClinicDoctors(cfg.doctors.map((d) => d.name));
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
      if (res.ok) { const data = await res.json(); setDays(data.days ?? []); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (authChecked) fetchWeek(weekStart); }, [authChecked, weekStart, fetchWeek]);

  function prevWeek() { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); }
  function nextWeek() { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); }
  function goToday()  { setWeekStart(getMondayOf(new Date())); setSelectedDate(toDateStr(new Date())); }

  function openNewBooking(date: string, time: string) {
    setNewDefaults({ date, time });
    setShowNewModal(true);
  }

  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 5);
  const todayStr = toDateStr(new Date());
  const selectedDay = days.find((d) => d.date === selectedDate);
  const todayBookings = days.find((d) => d.date === todayStr)?.bookings ?? [];
  const confirmedToday = todayBookings.filter((b) => b.status === "confirmed").length;
  const pendingToday   = todayBookings.filter((b) => b.status === "pending").length;

  const weekLabel = (() => {
    const ws = weekStart, we = weekEnd;
    return ws.getMonth() === we.getMonth()
      ? `${ws.getDate()} – ${we.getDate()} de ${MONTH_LABELS[ws.getMonth()]} ${ws.getFullYear()}`
      : `${ws.getDate()} ${MONTH_LABELS[ws.getMonth()]} – ${we.getDate()} ${MONTH_LABELS[we.getMonth()]} ${ws.getFullYear()}`;
  })();

  const selectedDayLabel = (() => {
    const d = new Date(selectedDate + "T12:00:00");
    return `${DAY_LABELS[d.getDay()]} ${d.getDate()} de ${MONTH_LABELS[d.getMonth()]}`;
  })();

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
      method: "DELETE", headers: { Authorization: `Bearer ${token}` },
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
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ width: 36, height: 36, border: `3px solid ${C.accent}`, borderTopColor: "transparent",
          borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  const selectedDoctorIndex = selectedBooking ? clinicDoctors.indexOf(selectedBooking.doctor) : 0;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } * { box-sizing: border-box; }`}</style>

      {/* ── Top header ──────────────────────────────────────────────────────── */}
      <div style={{ background: C.primary, padding: "0 24px", display: "flex", alignItems: "center",
        justifyContent: "space-between", height: 58, flexShrink: 0, gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Link href="/partners/dashboard"
            style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: 600, textDecoration: "none",
              display: "flex", alignItems: "center", gap: 5 }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "white")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.55)")}>
            Dashboard
          </Link>
          <div style={{ width: 1, height: 18, background: "rgba(255,255,255,0.15)" }} />
          <h1 style={{ color: "white", fontSize: 15, fontWeight: 800, margin: 0 }}>Agenda</h1>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Today stats */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.08)",
            borderRadius: 8, padding: "5px 12px", border: "1px solid rgba(255,255,255,0.12)" }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>Hoy</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: "white" }}>{todayBookings.length}</span>
            {confirmedToday > 0 && (
              <span style={{ fontSize: 10, background: "#10B981", color: "white", fontWeight: 700, padding: "1px 7px", borderRadius: 20 }}>
                {confirmedToday} conf.
              </span>
            )}
            {pendingToday > 0 && (
              <span style={{ fontSize: 10, background: "#F59E0B", color: "white", fontWeight: 700, padding: "1px 7px", borderRadius: 20 }}>
                {pendingToday} pend.
              </span>
            )}
          </div>

          {/* View toggle */}
          <div style={{ display: "flex", gap: 3, background: "rgba(255,255,255,0.1)", borderRadius: 8, padding: 3 }}>
            {(["week","day"] as ViewMode[]).map((m) => (
              <button key={m} onClick={() => setViewMode(m)}
                style={{ padding: "5px 12px", borderRadius: 6, border: "none", cursor: "pointer",
                  background: viewMode === m ? "white" : "transparent",
                  color: viewMode === m ? C.primary : "rgba(255,255,255,0.65)",
                  fontWeight: 700, fontSize: 12,
                  boxShadow: viewMode === m ? "0 1px 4px rgba(0,0,0,0.18)" : "none",
                  transition: "all 0.15s" }}>
                {m === "day" ? "Día" : "Semana"}
              </button>
            ))}
          </div>

          <button onClick={() => openNewBooking(selectedDate, "10:00")}
            style={{ background: C.coral, color: "white", border: "none", borderRadius: 8,
              padding: "8px 16px", fontWeight: 800, fontSize: 13, cursor: "pointer",
              boxShadow: "0 4px 12px rgba(217,95,69,0.4)" }}>
            + Nueva cita
          </button>
        </div>
      </div>

      {/* ── Navigator bar ───────────────────────────────────────────────────── */}
      <div style={{ background: C.card, borderBottom: `1px solid ${C.border}`, padding: "12px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={prevWeek}
            style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.border}`,
              background: "white", cursor: "pointer", fontSize: 16, color: C.text,
              display: "flex", alignItems: "center", justifyContent: "center" }}>‹</button>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.primary, flex: 1, textAlign: "center" }}>
            {viewMode === "week" ? weekLabel : selectedDayLabel}
          </span>
          <button onClick={goToday}
            style={{ padding: "5px 12px", borderRadius: 8, border: `1.5px solid ${C.accent}`,
              background: "white", cursor: "pointer", fontSize: 12, fontWeight: 700, color: C.accent }}>
            Hoy
          </button>
          <button onClick={nextWeek}
            style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.border}`,
              background: "white", cursor: "pointer", fontSize: 16, color: C.text,
              display: "flex", alignItems: "center", justifyContent: "center" }}>›</button>
        </div>

        {/* Day strip — only in day view */}
        {viewMode === "day" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, marginTop: 12 }}>
            {loading ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ height: 72, background: "#F1F5F9", borderRadius: 12, opacity: 0.5 }} />
            )) : days.map((day) => {
              const d = new Date(day.date + "T12:00:00");
              const isToday    = day.date === todayStr;
              const isSelected = day.date === selectedDate;
              const count = day.bookings.filter((b) => b.status !== "cancelled").length;
              return (
                <button key={day.date} onClick={() => setSelectedDate(day.date)} style={{
                  padding: "10px 6px", borderRadius: 12, cursor: "pointer", border: "none",
                  background: isSelected ? C.primary : isToday ? `${C.accent}12` : "white",
                  boxShadow: isSelected ? `0 4px 14px ${C.primary}30` : "0 1px 3px rgba(0,0,0,0.06)",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 3, transition: "all 0.15s",
                }}>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
                    color: isSelected ? "rgba(255,255,255,0.65)" : isToday ? C.accent : C.muted,
                    textTransform: "uppercase" }}>{DAY_LABELS[d.getDay()]}</span>
                  <span style={{ fontSize: 20, fontWeight: 900, lineHeight: 1,
                    color: isSelected ? "white" : isToday ? C.accent : C.primary }}>{d.getDate()}</span>
                  {count > 0
                    ? <span style={{ fontSize: 9, fontWeight: 700, background: isSelected ? "rgba(255,255,255,0.2)" : C.coral,
                        color: "white", padding: "1px 7px", borderRadius: 20 }}>{count}</span>
                    : <span style={{ fontSize: 9, color: isSelected ? "rgba(255,255,255,0.35)" : "#CBD5E1" }}>—</span>
                  }
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Grid ────────────────────────────────────────────────────────────── */}
      <div style={{ background: C.card, borderTop: `1px solid ${C.border}` }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 80 }}>
            <div style={{ width: 32, height: 32, border: `3px solid ${C.accent}`, borderTopColor: "transparent",
              borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          </div>
        ) : viewMode === "week" ? (
          <WeekGrid
            days={days}
            doctors={clinicDoctors}
            onSelect={setSelectedBooking}
            onNewBooking={openNewBooking}
          />
        ) : (
          <>
            {/* Day view title */}
            <div style={{ padding: "14px 24px 10px", display: "flex", alignItems: "center", justifyContent: "space-between",
              borderBottom: `1px solid ${C.border}` }}>
              <p style={{ margin: 0, fontSize: 12, color: C.muted }}>
                {(selectedDay?.bookings.filter((b) => b.status !== "cancelled").length ?? 0)} citas activas
              </p>
              <button onClick={() => openNewBooking(selectedDate, "10:00")}
                style={{ padding: "6px 14px", borderRadius: 8, border: `1.5px dashed ${C.border}`,
                  background: "transparent", color: C.muted, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                + Agregar cita este día
              </button>
            </div>

            {!selectedDay?.bookings.length ? (
              <div style={{ textAlign: "center", padding: "70px 24px" }}>
                <div style={{ fontSize: 44, marginBottom: 10 }}>📅</div>
                <p style={{ fontSize: 15, fontWeight: 700, color: C.primary, margin: "0 0 6px" }}>Sin citas para este día</p>
                <p style={{ fontSize: 13, color: C.muted, margin: "0 0 18px" }}>Puedes agregar una cita manualmente</p>
                <button onClick={() => openNewBooking(selectedDate, "10:00")}
                  style={{ padding: "10px 24px", borderRadius: 12, background: C.coral, color: "white",
                    border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(217,95,69,0.35)" }}>
                  Agendar cita
                </button>
              </div>
            ) : (
              <DayGrid
                bookings={selectedDay.bookings}
                doctors={clinicDoctors}
                onSelect={setSelectedBooking}
                onNewBooking={(time) => openNewBooking(selectedDate, time)}
              />
            )}
          </>
        )}
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      {selectedBooking && (
        <BookingModal
          booking={selectedBooking}
          doctorIndex={Math.max(0, clinicDoctors.indexOf(selectedBooking.doctor))}
          onClose={() => setSelectedBooking(null)}
          onSave={handleSave}
          onCancel={handleCancelBooking}
        />
      )}

      <NewBookingModal
        doctors={clinicDoctors}
        initialDate={newDefaults.date}
        initialTime={newDefaults.time}
        open={showNewModal}
        onClose={() => setShowNewModal(false)}
        onCreate={handleCreate}
      />
    </div>
  );
}
