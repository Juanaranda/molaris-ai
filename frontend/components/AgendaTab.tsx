"use client";

import { useEffect, useState, useCallback } from "react";
import { getToken } from "@/lib/auth";
import type { AuthUser } from "@/lib/auth";
import { DentalQuoteTab } from "./DentalQuoteTab";
import { PatientAutocomplete } from "./PatientAutocomplete";
import { invalidatePatientsCache } from "@/lib/patients";
import { minutosDesdeInicioDeGrilla, esElTramoDeAhora } from "@/lib/agendaTime";
import { restanteHasta } from "@/lib/plazos";
import { X } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// Rotating color palette for any doctor list
const COLOR_PALETTE: { dot: string; bg: string; text: string }[] = [
  { dot: "#10B981", bg: "#D1FAE5", text: "#065F46" },
  { dot: "#3B82F6", bg: "#DBEAFE", text: "#1E40AF" },
  { dot: "#8B5CF6", bg: "#EDE9FE", text: "#5B21B6" },
  { dot: "#F59E0B", bg: "#FEF3C7", text: "#92400E" },
  { dot: "#EC4899", bg: "#FCE7F3", text: "#9D174D" },
  { dot: "#EF4444", bg: "#FEE2E2", text: "#991B1B" },
  { dot: "#14B8A6", bg: "#CCFBF1", text: "#0F766E" },
  { dot: "#F97316", bg: "#FFEDD5", text: "#9A3412" },
];

function buildPalMap(doctors: string[]): Record<string, { dot: string; bg: string; text: string }> {
  const map: Record<string, { dot: string; bg: string; text: string }> = {};
  doctors.forEach((d, i) => { map[d] = COLOR_PALETTE[i % COLOR_PALETTE.length]; });
  return map;
}

const DAY_SHORT  = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
const DAY_FULL   = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
const MONTHS     = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

// Default work hours fallback (used when clinic has no schedule config)
const DEFAULT_WORK_HOURS: Record<number, { start: number; end: number } | null> = {
  0: null, 1: { start: 9, end: 18 }, 2: { start: 9, end: 18 },
  3: { start: 9, end: 18 }, 4: { start: 9, end: 18 }, 5: { start: 9, end: 18 }, 6: null,
};

// Parse clinic schedule config (e.g. { monday: "Lunes: 09:00 - 18:00", saturday: "Sábado: cerrado" })
const DAY_KEY_TO_JS: Record<string, number> = {
  monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 0,
};
function parseWorkHours(cfg?: Record<string, string>): Record<number, { start: number; end: number } | null> {
  if (!cfg || Object.keys(cfg).length === 0) return DEFAULT_WORK_HOURS;
  const result: Record<number, { start: number; end: number } | null> = {
    0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null,
  };
  for (const [key, val] of Object.entries(cfg)) {
    const jsDay = DAY_KEY_TO_JS[key];
    if (jsDay == null) continue;
    if (!val || val.includes("cerrado")) { result[jsDay] = null; continue; }
    const m = val.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
    if (m) result[jsDay] = { start: parseInt(m[1]), end: parseInt(m[3]) };
  }
  return result;
}

// Half-hour slots from 09:00 to 18:30 (grid rows)
const GRID_SLOTS = Array.from({ length: 21 }, (_, i) => {
  const totalMins = 9 * 60 + i * 30;
  return `${String(Math.floor(totalMins / 60)).padStart(2, "0")}:${totalMins % 60 === 0 ? "00" : "30"}`;
});

/** Un solo lee-el-reloj para la línea de "ahora": posición y etiqueta juntas. */
function leerAhora(): { mins: number | null; label: string; fecha: Date } {
  const d = new Date();
  return {
    mins: minutosDesdeInicioDeGrilla(GRID_SLOTS, d),
    label: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
    // La usa la cuenta regresiva de las horas por confirmar. Va acá y no en un
    // estado aparte para que ambas cosas latan con el mismo tick.
    fecha: d,
  };
}

function getWorkHours(dateStr: string, workHours: Record<number, { start: number; end: number } | null>) {
  const dow = new Date(dateStr + "T12:00:00").getDay();
  return workHours[dow] ?? null;
}

function isInWorkHours(slot: string, wh: { start: number; end: number } | null): boolean {
  if (!wh) return false;
  const [h, m] = slot.split(":").map(Number);
  const mins = h * 60 + m;
  return mins >= wh.start * 60 && mins < wh.end * 60;
}

function getMondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  // Sunday (0) → show the upcoming Monday (forward), not last week
  d.setDate(d.getDate() + (day === 0 ? 1 : 1 - day));
  d.setHours(0, 0, 0, 0);
  return d;
}
function toDateStr(d: Date): string { return d.toISOString().slice(0, 10); }
// Extract YYYY-MM-DD from any ISO format (handles full timestamps from Prisma/Fastify)
function safeDateStr(s: string | null | undefined): string { return s ? String(s).slice(0, 10) : ""; }
function formatDate(s: string | null | undefined): string {
  const clean = safeDateStr(s);
  if (!clean || !/^\d{4}-\d{2}-\d{2}$/.test(clean)) return "—";
  const [y, m, d] = clean.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
}

function palOf(doctor: string, palMap?: Record<string, { dot: string; bg: string; text: string }>) {
  return palMap?.[doctor] ?? { dot: "#6B7280", bg: "#F3F4F6", text: "#374151" };
}

interface Booking {
  id: string; doctor: string; time: string; date: string; box: string | null;
  sede: string | null;
  patientName: string | null; patientRut: string | null;
  patientPhone: string | null; patientEmail: string | null;
  service: string | null; status: string; notes: string | null;
  /** "agent" = la pidió el agente y espera confirmación humana. */
  requestedVia: string | null;
  confirmDeadline: string | null;
  confirmedByName: string | null;
  paymentStatus: string | null; amountTotal: number | null;
  amountPaid: number | null; paymentMethod: string | null; paidAt: string | null;
  createdAt: string;
}
interface DayData { date: string; bookings: Booking[]; }

/* ── Status pill ─────────────────────────────────────────────────────── */
function StatusPill({ status, requestedVia }: { status: string; requestedVia?: string | null }) {
  // Una hora que el agente dejó pedida NO es lo mismo que una cita que alguien
  // creó a mano y está esperando al paciente: la primera necesita que un humano
  // decida, y si se ven iguales el doctor cree que tiene la agenda cerrada.
  const esperandoConfirmacion = status === "pending" && requestedVia === "agent";

  const map: Record<string, string> = {
    confirmed: "bg-emerald-50 text-emerald-700 border-emerald-100",
    pending:   "bg-amber-50 text-amber-700 border-amber-100",
    cancelled: "bg-gray-50 text-gray-400 border-gray-100",
  };
  const labels: Record<string, string> = { confirmed: "Confirmada", pending: "Pendiente", cancelled: "Cancelada" };

  if (esperandoConfirmacion) {
    return (
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap bg-amber-100 text-amber-900 border-amber-300">
        Por confirmar
      </span>
    );
  }
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${map[status] ?? map.pending}`}>
      {labels[status] ?? status}
    </span>
  );
}

// Cita mía con el día resuelto (para las secciones "hoy"/"próximas").
type MineBooking = Booking & { dateStr: string };

// Declarados a nivel de módulo (no dentro del render) para no recrearlos en cada
// render — si no, React los remonta y se pierde el estado de sus hijos.
function BookingRow({ b, showDate = false }: { b: MineBooking; showDate?: boolean }) {
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
      <StatusPill status={b.status} requestedVia={b.requestedVia} />
    </div>
  );
}

function Section({ title, bookings, empty, showDate = false, loading }: {
  title: string; bookings: MineBooking[]; empty: string; showDate?: boolean; loading: boolean;
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

/* ── Booking detail modal ────────────────────────────────────────────── */
const PAY_STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  paid:    { label: "Pagado",   cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  partial: { label: "Parcial",  cls: "bg-amber-50 text-amber-700 border-amber-200" },
  pending: { label: "Pendiente",cls: "bg-gray-50 text-gray-500 border-gray-200" },
  waived:  { label: "Bonif.",   cls: "bg-purple-50 text-purple-700 border-purple-200" },
};

function PayPill({ status }: { status: string | null }) {
  if (!status || status === "pending") return null;
  const s = PAY_STATUS_LABELS[status] ?? PAY_STATUS_LABELS.pending;
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${s.cls}`}>{s.label}</span>;
}

/* ── Quick-quote modal ───────────────────────────────────────────────── */
function QuickQuoteModal({ patient, onClose }: {
  patient: { name: string; rut: string | null };
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-white overflow-hidden"
      style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-white shrink-0">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Presupuesto rápido</p>
          <h2 className="text-base font-black text-gray-900 leading-tight">{patient.name}</h2>
        </div>
        <button onClick={onClose}
          className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 transition flex items-center justify-center text-gray-500 shrink-0"><X className="w-4 h-4" aria-hidden /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <DentalQuoteTab patient={patient} />
      </div>
    </div>
  );
}

function BookingModal({ booking, onClose, onSave, onCancel, onNewQuote, onDecided }: {
  booking: Booking;
  onClose: () => void;
  onSave: (id: string, patch: {
    status: string; notes: string;
    paymentStatus: string; amountTotal: string; amountPaid: string; paymentMethod: string;
  }) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
  /** Se llama tras confirmar o rechazar, para refrescar la agenda. */
  onDecided: () => void;
  onNewQuote?: (patient: { name: string; rut: string | null }) => void;
}) {
  const [status, setStatus]             = useState(booking.status);
  const [notes, setNotes]               = useState(booking.notes ?? "");
  const [paymentStatus, setPayStatus]   = useState(booking.paymentStatus ?? "pending");
  const [amountTotal, setAmountTotal]   = useState(booking.amountTotal?.toString() ?? "");
  const [amountPaid, setAmountPaid]     = useState(booking.amountPaid?.toString() ?? "");
  const [paymentMethod, setPayMethod]   = useState(booking.paymentMethod ?? "cash");
  const [saving, setSaving]             = useState(false);
  const [tab, setTab]                   = useState<"info" | "payment">("info");
  const [decidiendo, setDecidiendo]     = useState(false);
  const [decisionError, setDecisionError] = useState("");

  async function decidir(accion: "confirmar" | "rechazar") {
    setDecidiendo(true); setDecisionError("");
    try {
      const res = await fetch(`${API}/api/bookings/${booking.id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ accion }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.mensaje ?? d.error ?? "No pudimos registrar la decisión");
      // Se cierra y se recarga: el estado cambió y la grilla debe reflejarlo.
      onDecided();
    } catch (e) {
      setDecisionError(e instanceof Error ? e.message : "Error");
    } finally { setDecidiendo(false); }
  }
  const pal = palOf(booking.doctor);

  async function save() {
    setSaving(true);
    try {
      await onSave(booking.id, { status, notes, paymentStatus, amountTotal, amountPaid, paymentMethod });
      onClose();
    } finally { setSaving(false); }
  }

  async function cancel() {
    if (!confirm("¿Cancelar esta cita?")) return;
    await onCancel(booking.id);
    onClose();
  }

  const inp = "w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";

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
            <div className="flex items-center gap-1.5 mt-1">
              <StatusPill status={booking.status} requestedVia={booking.requestedVia} />
              <PayPill status={booking.paymentStatus} />
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 transition flex items-center justify-center text-gray-500"><X className="w-4 h-4" aria-hidden /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {(["info", "payment"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-xs font-bold transition border-b-2 -mb-px ${
                tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-gray-400 hover:text-gray-600"
              }`}>
              {t === "info" ? "Detalle" : "Pago"}
            </button>
          ))}
        </div>

        {/* Decisión pendiente: va arriba de todo porque es lo único que hay
            que hacer con esta cita. Lo demás es contexto para decidir. */}
        {booking.status === "pending" && booking.requestedVia === "agent" && (
          <div className="px-6 py-4 border-b" style={{ backgroundColor: "#FFFDF7", borderColor: "#F0E0B8" }}>
            <p className="text-sm font-bold" style={{ color: "#7A5200" }}>Esperando tu confirmación</p>
            <p className="text-xs mt-0.5 mb-3" style={{ color: "#8A6A20" }}>
              La pidió un paciente por el asistente. La hora está reservada, pero no es una cita
              hasta que alguien decida
              {booking.confirmDeadline
                ? ` — se libera sola el ${new Date(booking.confirmDeadline).toLocaleString("es-CL",
                    { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: false })}.`
                : "."}
            </p>
            {/* La fecha exacta de arriba sirve para agendarse; el plazo en
                horas es el que dice si hay que responder ahora. */}
            {(() => {
              const queda = restanteHasta(booking.confirmDeadline);
              if (!queda) return null;
              return (
                <p className="text-xs font-bold mb-3" style={{ color: queda.urgente ? "#B3261E" : "#8A6A20" }}>
                  {queda.vencida ? "El plazo ya venció." : `Vence ${queda.texto}.`}
                </p>
              );
            })()}
            {decisionError && (
              <p className="text-xs mb-2.5 rounded-lg px-3 py-2" style={{ backgroundColor: "#FDECEA", color: "#B3261E" }}>
                {decisionError}
              </p>
            )}
            <div className="flex gap-2">
              <button onClick={() => decidir("confirmar")} disabled={decidiendo}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: "#1F6B4B" }}>
                {decidiendo ? "Confirmando…" : "Confirmar"}
              </button>
              <button onClick={() => decidir("rechazar")} disabled={decidiendo}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors disabled:opacity-50"
                style={{ borderColor: "#E0B44A", color: "#7A5200" }}>
                No se puede
              </button>
            </div>
          </div>
        )}

        <div className="px-6 py-5 flex flex-col gap-4">
          {tab === "info" ? (
            <>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {[
                  ["Hora",     booking.time],
                  ["Fecha",    formatDate(booking.date)],
                  ["Box",      booking.box ? `Box ${booking.box}` : "—"],
                  // Solo se lista si la cita trae sede — en clínica de una sola
                  // sede la fila vacía sería ruido.
                  ...(booking.sede ? [["Sede", booking.sede]] : []),
                  ["RUT",      booking.patientRut ?? "—"],
                  ["Teléfono", booking.patientPhone ?? "—"],
                  ["Email",    booking.patientEmail ?? "—"],
                  ["Servicio", booking.service ?? "—"],
                ].map(([label, val]) => (
                  <div key={label}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">{label}</p>
                    <p className="text-sm font-semibold text-gray-800">{val}</p>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Estado</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className={inp}>
                  <option value="confirmed">Confirmada</option>
                  <option value="pending">Pendiente</option>
                  <option value="cancelled">Cancelada</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Notas internas</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                  placeholder="Observaciones, indicaciones..."
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </>
          ) : (
            <>
              {/* Payment status */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Estado del pago</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(["pending","paid","partial","waived"] as const).map((s) => {
                    const info = PAY_STATUS_LABELS[s];
                    return (
                      <button key={s} type="button" onClick={() => setPayStatus(s)}
                        className={`py-2 rounded-xl text-[11px] font-bold border transition ${
                          paymentStatus === s ? `${info.cls} ring-2 ring-offset-1 ring-current` : "border-gray-200 text-gray-400 hover:border-gray-300"
                        }`}>
                        {info.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Amounts */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Monto cobrado (CLP)</label>
                  <input type="number" min="0" step="1000" value={amountTotal}
                    onChange={(e) => setAmountTotal(e.target.value)}
                    placeholder="Ej: 50000" className={inp} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Monto pagado (CLP)</label>
                  <input type="number" min="0" step="1000" value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    placeholder="Ej: 50000" className={inp} />
                </div>
              </div>

              {/* Method */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Método de pago</label>
                <select value={paymentMethod} onChange={(e) => setPayMethod(e.target.value)} className={inp}>
                  <option value="cash">Efectivo</option>
                  <option value="transfer">Transferencia</option>
                  <option value="card">Tarjeta</option>
                  <option value="other">Otro</option>
                </select>
              </div>

              {booking.paidAt && (
                <p className="text-xs text-gray-400">
                  Pagado el {formatDate(booking.paidAt)}
                </p>
              )}
            </>
          )}

          {/* Presupuesto rápido */}
          {onNewQuote && booking.patientName && (
            <button
              onClick={() => { onClose(); onNewQuote({ name: booking.patientName!, rut: booking.patientRut }); }}
              className="w-full py-2.5 rounded-xl text-sm font-bold text-[#1A5C7A] bg-[#E8F4F8] hover:bg-[#D0EBF4] transition border border-[#B0D8E8]">
              + Nuevo presupuesto para {booking.patientName.split(" ")[0]}
            </button>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
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

function NewBookingModal({ doctors, initialDate, boxes, sedes = [], onClose, onCreate }: {
  doctors: string[];
  initialDate: string;
  boxes: number;
  /** Sedes del doctor independiente (#69). Vacío = no se muestra el selector. */
  sedes?: string[];
  onClose: () => void;
  onCreate: (data: { doctor: string; date: string; time: string; box?: string; sede?: string; patientName: string; patientRut?: string; patientPhone?: string; patientEmail?: string; service?: string }) => Promise<void>;
}) {
  const [form, setForm] = useState({ doctor: doctors[0] ?? "", date: initialDate, time: "10:00", box: "1",
    sede: sedes[0] ?? "",
    patientName: "", patientRut: "", patientPhone: "", patientEmail: "", service: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Paciente traído de la ficha vs. escrito a mano: cambia si los campos de
  // contacto se pueden tocar y qué se le muestra a quien está agendando.
  const [pacienteExistente, setPacienteExistente] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.patientName) { setError("El nombre del paciente es obligatorio"); return; }
    setSaving(true); setError("");
    try {
      await onCreate({ doctor: form.doctor, date: form.date, time: form.time,
        box: form.box || undefined,
        sede: form.sede || undefined,
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      {/* En móvil sube desde abajo y ocupa el ancho completo: el pulgar llega al
          borde inferior, no al centro de la pantalla. En desktop sigue centrado. */}
      <div className="bg-white rounded-t-3xl sm:rounded-2xl border border-gray-100 shadow-2xl w-full max-w-md max-h-[92vh] sm:max-h-[90vh] flex flex-col">
        <div className="px-5 sm:px-6 py-4 border-b border-gray-50 flex items-center justify-between shrink-0 rounded-t-3xl sm:rounded-t-2xl bg-white">
          <h2 className="text-lg font-black text-gray-900">Nueva cita</h2>
          <button onClick={onClose} aria-label="Cerrar"
            className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 transition flex items-center justify-center text-gray-500"><X className="w-4 h-4" aria-hidden /></button>
        </div>
        {/* overflow-y-auto y no overflow-hidden: con el modal recortado, el
            desplegable de pacientes quedaba cortado por el borde inferior. */}
        <form onSubmit={submit} className="px-5 sm:px-6 py-5 flex flex-col gap-4 overflow-y-auto">
          {/* Doctor */}
          <div>
            <label className={lbl}>Profesional *</label>
            <select value={form.doctor} onChange={set("doctor")} className={inp}>
              {doctors.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          {/* Date + Time + Box */}
          <div>
            <label className={lbl}>Fecha *</label>
            <input type="date" value={form.date} onChange={set("date")} required className={inp} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Hora *</label>
              <select value={form.time} onChange={set("time")} className={inp}>
                {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Box</label>
              <select value={form.box} onChange={set("box")} className={inp}>
                {Array.from({ length: boxes }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={String(n)}>Box {n}</option>
                ))}
              </select>
            </div>
          </div>
          {/* Sede — solo si el doctor configuró más de un lugar de atención */}
          {sedes.length > 0 && (
            <div>
              <label className={lbl}>Sede</label>
              <select value={form.sede} onChange={set("sede")} className={inp}>
                {sedes.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
          {/* Patient */}
          <div>
            <label className={lbl}>Nombre paciente *</label>
            <PatientAutocomplete
              value={form.patientName}
              seleccionado={pacienteExistente}
              inputClassName={inp}
              onChange={(nombre) => setForm((f) => ({ ...f, patientName: nombre }))}
              onSelect={(p) => {
                setForm((f) => ({
                  ...f,
                  patientName:  p.name,
                  patientRut:   p.rut   ?? "",
                  patientPhone: p.phone ?? "",
                  patientEmail: p.email ?? "",
                }));
                setPacienteExistente(true);
              }}
              onClear={() => {
                // Se limpia todo el contacto: dejar el RUT del anterior sería
                // la forma más rápida de agendarle la hora a la persona equivocada.
                setForm((f) => ({ ...f, patientName: "", patientRut: "", patientPhone: "", patientEmail: "" }));
                setPacienteExistente(false);
              }}
            />
          </div>
          {/* Con paciente de la ficha, los datos de contacto se muestran de solo
              lectura: son los que ya están guardados, no algo para retipear. */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>RUT</label>
              <input type="text" value={form.patientRut} onChange={set("patientRut")} placeholder="12.345.678-9"
                readOnly={pacienteExistente}
                className={pacienteExistente ? `${inp} bg-gray-50 text-gray-500` : inp} />
            </div>
            <div>
              <label className={lbl}>Teléfono</label>
              <input type="tel" value={form.patientPhone} onChange={set("patientPhone")} placeholder="+56 9..."
                readOnly={pacienteExistente}
                className={pacienteExistente ? `${inp} bg-gray-50 text-gray-500` : inp} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Email</label>
              <input type="email" value={form.patientEmail} onChange={set("patientEmail")} placeholder="correo@..."
                readOnly={pacienteExistente}
                className={pacienteExistente ? `${inp} bg-gray-50 text-gray-500` : inp} />
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
function AdminAgenda({
  boxes,
  doctors: doctorNames = [],
  sedes = [],
  scheduleConfig,
  openNewBookingOnMount = false,
}: {
  boxes: number;
  doctors?: string[];
  sedes?: string[];
  scheduleConfig?: Record<string, string>;
  openNewBookingOnMount?: boolean;
}) {
  const palMap    = buildPalMap(doctorNames);
  const workHours = parseWorkHours(scheduleConfig);
  const [weekStart, setWeekStart]     = useState(() => getMondayOf(new Date()));
  const [days, setDays]               = useState<DayData[]>([]);
  const [loading, setLoading]         = useState(false);
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()));
  const [doctorFilter, setDoctorFilter] = useState<string | null>(null);
  // Filtro por sede (#69): la agenda es una sola aunque el doctor atienda en
  // varios lugares; esto la acota al lugar donde está hoy.
  const [sedeFilter, setSedeFilter] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showNew, setShowNew]         = useState(openNewBookingOnMount);
  const [quotePatient, setQuotePatient] = useState<{ name: string; rut: string | null } | null>(null);

  const fetchWeek = useCallback(async (start: Date, signal?: AbortSignal) => {
    const token = getToken(); if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/agenda/week?start=${toDateStr(start)}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      if (res.ok) { const d = await res.json(); setDays(d.days ?? []); }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchWeek(weekStart, controller.signal);
    return () => controller.abort();
  }, [weekStart, fetchWeek]);

  const todayStr = toDateStr(new Date());
  const weekEnd  = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 5);

  const weekLabel = (() => {
    const ws = weekStart; const we = weekEnd;
    const sm = MONTHS[ws.getMonth()]; const em = MONTHS[we.getMonth()];
    return ws.getMonth() === we.getMonth()
      ? `${ws.getDate()}–${we.getDate()} ${sm} ${ws.getFullYear()}`
      : `${ws.getDate()} ${sm} – ${we.getDate()} ${em} ${ws.getFullYear()}`;
  })();

  // En un teléfono la vista semana son 5 columnas de doctores en 375px: ilegible.
  // Arranca en "día" y el toggle sigue estando por si igual la quieren.
  // Se calcula en el inicializador (no en un efecto) para no pintar primero la
  // semana y saltar a día — ese parpadeo se ve peor que cualquiera de las dos.
  // Se recalcula cada minuto: una línea de "ahora" que se queda congelada
  // miente, y en una agenda eso es peor que no tenerla.
  // Posición y etiqueta salen del mismo tick: si la etiqueta llamara a
  // new Date() en el render, podría mostrar una hora distinta a la de la línea
  // —y además leer el reloj durante el render arriesga desajustes de hidratación.
  const [ahora, setAhora] = useState<{ mins: number | null; label: string; fecha: Date }>(() => leerAhora());
  useEffect(() => {
    const id = setInterval(() => setAhora(leerAhora()), 60_000);
    return () => clearInterval(id);
  }, []);

  const [viewMode, setViewMode] = useState<"week" | "day">(
    () => (typeof window !== "undefined" && window.innerWidth < 640 ? "day" : "week")
  );

  const selectedDay = days.find((d) => safeDateStr(d.date) === selectedDate);
  let dayBookings = [...(selectedDay?.bookings ?? [])];
  if (doctorFilter) dayBookings = dayBookings.filter((b) => b.doctor === doctorFilter);
  if (sedeFilter)   dayBookings = dayBookings.filter((b) => b.sede === sedeFilter);
  dayBookings.sort((a, b) => a.time.localeCompare(b.time));

  // Un booking pasa los filtros activos (doctor y/o sede).
  const matchesFilters = (b: Booking) =>
    (!doctorFilter || b.doctor === doctorFilter) && (!sedeFilter || b.sede === sedeFilter);

  function activeCnt(day: DayData) {
    return day.bookings.filter((b) => b.status !== "cancelled" && matchesFilters(b)).length;
  }

  async function handleSave(id: string, patch: {
    status: string; notes: string;
    paymentStatus: string; amountTotal: string; amountPaid: string; paymentMethod: string;
  }) {
    const token = getToken();
    const body: Record<string, unknown> = {
      status: patch.status,
      notes: patch.notes,
      paymentStatus: patch.paymentStatus,
      paymentMethod: patch.paymentMethod,
    };
    if (patch.amountTotal !== "") body.amountTotal = Number(patch.amountTotal);
    if (patch.amountPaid  !== "") body.amountPaid  = Number(patch.amountPaid);
    const res = await fetch(`${API}/api/agenda/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
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

  async function handleCreate(data: {
    doctor: string; date: string; time: string; box?: string; patientName: string;
    patientRut?: string; patientPhone?: string; patientEmail?: string; service?: string;
  }) {
    const token = getToken();
    const res = await fetch(`${API}/api/agenda/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error ?? "Error"); }
    // Si era un paciente nuevo, tiene que salir en las sugerencias de la
    // próxima cita — si no, se vuelve a tipear igual y el autocompletar no sirve.
    invalidatePatientsCache();
    // Navigate to the week that contains the new booking
    const bookingWeekStart = getMondayOf(new Date(data.date + "T12:00:00"));
    if (toDateStr(bookingWeekStart) !== toDateStr(weekStart)) {
      setWeekStart(bookingWeekStart);
      // useEffect will trigger fetchWeek for the new weekStart
    } else {
      await fetchWeek(weekStart);
    }
    setSelectedDate(data.date);
  }

  const selectedLabel = (() => {
    const d = new Date(selectedDate + "T12:00:00");
    return `${DAY_FULL[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
  })();

  // Solicitudes del agente esperando decisión en la semana visible. Van
  // arriba de todo: si hay que buscarlas dentro de la grilla, se quedan sin
  // responder y caducan solas.
  const porConfirmar = days
    .flatMap((d) => d.bookings.map((b) => ({ ...b, dateStr: d.date })))
    .filter((b) => b.status === "pending" && b.requestedVia === "agent")
    .sort((a, b) => (a.confirmDeadline ?? "").localeCompare(b.confirmDeadline ?? ""));

  // Van ordenadas por plazo, así que la primera es la que menos aguanta.
  const masApurada = porConfirmar.length > 0
    ? restanteHasta(porConfirmar[0].confirmDeadline, ahora.fecha)
    : null;

  return (
    <div className="flex flex-col gap-5">
      {porConfirmar.length > 0 && (
        <div className="rounded-2xl border px-4 sm:px-5 py-4"
          style={{ backgroundColor: "#FFFDF7", borderColor: "#F0E0B8" }}>
          <p className="text-sm font-bold" style={{ color: "#7A5200" }}>
            {porConfirmar.length === 1
              ? "1 hora esperando confirmación"
              : `${porConfirmar.length} horas esperando confirmación`}
          </p>
          <p className="text-xs mt-0.5 mb-3" style={{ color: "#8A6A20" }}>
            Las pidió un paciente por el asistente. Si nadie responde, se liberan solas
            {masApurada && (masApurada.vencida
              ? " — la primera ya venció."
              : <> — la más apurada, <strong>{masApurada.texto}</strong>.</>)}
          </p>
          <div className="flex flex-col gap-1.5">
            {porConfirmar.slice(0, 4).map((b) => {
              const queda = restanteHasta(b.confirmDeadline, ahora.fecha);
              return (
                <button key={b.id} onClick={() => setSelectedBooking(b)}
                  className="flex items-center gap-3 text-left rounded-xl px-3 py-2.5 bg-white/70 hover:bg-white transition border"
                  style={{ borderColor: "#F0E0B8" }}>
                  <span className="text-xs font-black tabular-nums shrink-0" style={{ color: "#7A5200" }}>
                    {DAY_SHORT[new Date(b.dateStr + "T12:00:00").getDay()]} {b.time}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-gray-800 truncate">{b.patientName ?? "—"}</span>
                    <span className="block text-[11px] text-gray-500 truncate">
                      {[b.service, b.doctor].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  {/* El plazo pesa más que "Revisar": es lo que decide si esta
                      hora se atiende ahora o se pierde. */}
                  {queda && (
                    <span className="text-[11px] font-bold shrink-0 tabular-nums text-right"
                      style={{ color: queda.urgente ? "#B3261E" : "#7A5200" }}>
                      {queda.texto}
                    </span>
                  )}
                  <span className="text-xs font-bold shrink-0" style={{ color: "#7A5200" }}>›</span>
                </button>
              );
            })}
            {porConfirmar.length > 4 && (
              <p className="text-[11px] pt-0.5" style={{ color: "#8A6A20" }}>
                y {porConfirmar.length - 4} más en la agenda de abajo
              </p>
            )}
          </div>
        </div>
      )}

      {/* Week nav — en móvil va en dos filas: en una sola, "+ Nueva cita"
          quedaba fuera de pantalla y era el botón más usado de la agenda. */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); }}
            className="w-11 h-11 sm:w-8 sm:h-8 rounded-lg border border-gray-200 bg-white text-gray-500 hover:border-gray-300 transition flex items-center justify-center font-bold shrink-0">‹</button>
          <span className="text-xs sm:text-sm font-semibold text-gray-700 text-center capitalize truncate">
            {weekLabel}
          </span>
          <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); }}
            className="w-11 h-11 sm:w-8 sm:h-8 rounded-lg border border-gray-200 bg-white text-gray-500 hover:border-gray-300 transition flex items-center justify-center font-bold shrink-0">›</button>
          <button onClick={() => { setWeekStart(getMondayOf(new Date())); setSelectedDate(todayStr); }}
            className="text-xs font-semibold px-3.5 py-3 sm:py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition shrink-0">
            Hoy
          </button>
        </div>
        <div className="flex items-center gap-2 justify-between sm:justify-end">
          {/* View toggle */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
            {(["week", "day"] as const).map((m) => (
              <button key={m} onClick={() => setViewMode(m)}
                className={`text-[11px] font-bold px-3.5 py-3 sm:py-1.5 rounded-md transition ${
                  viewMode === m ? "bg-white text-gray-800 shadow-sm" : "text-gray-400 hover:text-gray-600"
                }`}>
                {m === "week" ? "Semana" : "Día"}
              </button>
            ))}
          </div>
          <button onClick={() => setShowNew(true)}
            className="text-sm font-bold px-4 py-2.5 sm:py-2 rounded-xl text-white hover:opacity-90 transition shrink-0"
            style={{ backgroundColor: "#D95F45", boxShadow: "0 2px 8px rgba(217,95,69,0.3)" }}>
            + Nueva cita
          </button>
        </div>
      </div>

      {/* Day strip — only in day view */}
      <div className={`grid grid-cols-6 gap-1 sm:gap-2 ${viewMode === "week" ? "hidden" : ""}`}>
        {loading ? Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[76px] rounded-2xl bg-gray-100 animate-pulse" />
        )) : days.map((day) => {
          const d = new Date(safeDateStr(day.date) + "T12:00:00");
          const isToday    = safeDateStr(day.date) === todayStr;
          const isSelected = safeDateStr(day.date) === selectedDate;
          const cnt = activeCnt(day);
          return (
            <button key={day.date} onClick={() => { setSelectedDate(safeDateStr(day.date)); setViewMode("day"); }}
              className={`flex flex-col items-center gap-1 py-2 sm:py-3 px-0.5 sm:px-1 rounded-xl sm:rounded-2xl border transition cursor-pointer ${
                isSelected
                  ? "border-blue-600 bg-blue-600 shadow-md"
                  : isToday
                  ? "border-blue-200 bg-blue-50"
                  : "border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm"
              }`}>
              <span className={`text-[8px] sm:text-[9px] font-bold uppercase tracking-wide ${isSelected ? "text-blue-200" : isToday ? "text-blue-500" : "text-gray-400"}`}>
                {DAY_SHORT[d.getDay()]}
              </span>
              <span className={`text-base sm:text-xl font-black leading-none ${isSelected ? "text-white" : isToday ? "text-blue-600" : "text-gray-800"}`}>
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

      {/* Doctor filter pills — shown in both views */}
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none"
        style={{ scrollbarWidth: "none" }}>
        <span className="text-xs font-semibold text-gray-400">Ver:</span>
        <button onClick={() => setDoctorFilter(null)}
          className={`text-xs font-semibold px-3.5 py-3 sm:py-1.5 rounded-full border transition ${
            !doctorFilter ? "bg-gray-800 text-white border-gray-800" : "border-gray-200 text-gray-500 hover:border-gray-300 bg-white"
          }`}>
          Todos
        </button>
        {doctorNames.map((doc) => {
          const pal = palOf(doc, palMap);
          const short = doc.replace(/Dra?\. /, "").split(" ")[0];
          return (
            <button key={doc} onClick={() => setDoctorFilter(doctorFilter === doc ? null : doc)}
              className="text-xs font-semibold px-3.5 py-3 sm:py-1.5 rounded-full border transition"
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

      {/* Filtro por sede — solo si el doctor configuró más de un lugar */}
      {sedes.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none"
          style={{ scrollbarWidth: "none" }}>
          <span className="text-xs font-semibold text-gray-400">Sede:</span>
          <button onClick={() => setSedeFilter(null)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition whitespace-nowrap ${
              !sedeFilter ? "bg-gray-800 text-white border-gray-800" : "border-gray-200 text-gray-500 hover:border-gray-300 bg-white"
            }`}>
            Todas
          </button>
          {sedes.map((s) => (
            <button key={s} onClick={() => setSedeFilter(sedeFilter === s ? null : s)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition whitespace-nowrap ${
                sedeFilter === s
                  ? "bg-[#1A5C7A] text-white border-[#1A5C7A]"
                  : "border-gray-200 text-gray-500 hover:border-gray-300 bg-white"
              }`}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* ── Week grid ─────────────────────────────────────────────────── */}
      {viewMode === "week" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 520 }}>
              <div style={{ minWidth: 620 }}>
                {/* Day headers */}
                <div style={{ display: "grid", gridTemplateColumns: "48px repeat(6, 1fr)", position: "sticky", top: 0, background: "white", zIndex: 10, borderBottom: "2px solid #F1F5F9" }}>
                  <div />
                  {days.map((day) => {
                    const d = new Date(safeDateStr(day.date) + "T12:00:00");
                    const isToday = safeDateStr(day.date) === todayStr;
                    const cnt = day.bookings.filter((b) => b.status !== "cancelled" && matchesFilters(b)).length;
                    return (
                      <div key={day.date}
                        style={{ padding: "8px 4px", textAlign: "center", borderLeft: "1px solid #F1F5F9", background: isToday ? "#EFF6FF" : "transparent", cursor: "pointer" }}
                        onClick={() => { setSelectedDate(safeDateStr(day.date)); setViewMode("day"); }}>
                        <p style={{ margin: 0, fontSize: 9, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: isToday ? "#3B82F6" : "#94A3B8" }}>
                          {DAY_SHORT[d.getDay()]}
                        </p>
                        <p style={{ margin: "1px 0 3px", fontSize: 18, fontWeight: 900, lineHeight: 1, color: isToday ? "#3B82F6" : "#0C1B26" }}>
                          {d.getDate()}
                        </p>
                        {cnt > 0 && (
                          <span style={{ fontSize: 9, background: isToday ? "#3B82F6" : "#D95F45", color: "white", padding: "1px 6px", borderRadius: 20, fontWeight: 700 }}>
                            {cnt}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Time rows */}
                {GRID_SLOTS.map((slot) => {
                  const isHour = slot.endsWith(":00");
                  return (
                    <div key={slot} style={{ display: "grid", gridTemplateColumns: "48px repeat(6, 1fr)", minHeight: 40, borderBottom: `1px solid ${isHour ? "#F1F5F9" : "#FAFAFA"}` }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "flex-end", paddingRight: 6, paddingTop: 3 }}>
                        {isHour && <span style={{ fontSize: 9, fontWeight: 600, color: "#94A3B8" }}>{slot}</span>}
                      </div>
                      {days.map((day) => {
                        const isToday = safeDateStr(day.date) === todayStr;
                        const cell = day.bookings.filter((b) => {
                          if (!matchesFilters(b)) return false;
                          const [h, m] = b.time.split(":").map(Number);
                          return `${String(h).padStart(2,"0")}:${m < 30 ? "00" : "30"}` === slot;
                        });
                        return (
                          <div key={day.date}
                            onClick={() => { if (!cell.length) { setSelectedDate(safeDateStr(day.date)); setShowNew(true); } }}
                            style={{ borderLeft: "1px solid #F1F5F9", padding: "2px 2px", background: isToday ? "#F0F7FF" : "transparent", cursor: cell.length ? "default" : "pointer" }}>
                            {cell.map((b) => {
                              const pal = palOf(b.doctor, palMap);
                              return (
                                <button key={b.id} onClick={(e) => { e.stopPropagation(); setSelectedBooking(b); }}
                                  style={{ width: "100%", display: "block", textAlign: "left", background: pal.bg, borderLeft: `2px solid ${pal.dot}`, borderRadius: 3, padding: "1px 3px", marginBottom: 1, cursor: "pointer", border: "none" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                                    <span style={{ fontSize: 8, fontWeight: 800, color: pal.dot, whiteSpace: "nowrap" }}>{b.time}</span>
                                    <span style={{ fontSize: 8, fontWeight: 600, color: pal.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                                      {b.patientName ?? "—"}
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Day timeline grid — only in day view ─────────────────────── */}
      {viewMode === "day" && (() => {
        const wh = getWorkHours(selectedDate, workHours);
        const activeCitas = dayBookings.filter((b) => b.status !== "cancelled").length;
        // Map bookings by their half-hour slot key
        const slotMap = new Map<string, Booking[]>();
        for (const b of dayBookings) {
          const [h, m] = b.time.split(":").map(Number);
          const slotKey = `${String(h).padStart(2,"0")}:${m < 30 ? "00" : "30"}`;
          if (!slotMap.has(slotKey)) slotMap.set(slotKey, []);
          slotMap.get(slotKey)!.push(b);
        }

        return (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-bold text-gray-800 capitalize">{selectedLabel}</h3>
                {wh ? (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                    {String(wh.start).padStart(2,"0")}:00 – {String(wh.end).padStart(2,"0")}:00
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">Cerrado</span>
                )}
              </div>
              <span className="text-xs text-gray-400">
                {activeCitas} cita{activeCitas !== 1 ? "s" : ""} activa{activeCitas !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 px-5 py-2 border-b border-gray-50 bg-gray-50/60">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-white border border-gray-200" />
                <span className="text-[10px] text-gray-400 font-medium">Horario de atención</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-gray-100 border border-gray-200" />
                <span className="text-[10px] text-gray-400 font-medium">Fuera de horario</span>
              </div>
            </div>

            {/* Time grid */}
            <div className="overflow-y-auto" style={{ maxHeight: "520px" }}>
              {GRID_SLOTS.map((slot) => {
                const inWork = isInWorkHours(slot, wh);
                const slotBookings = slotMap.get(slot) ?? [];
                const isHour = slot.endsWith(":00");
                // ahoraMin entra en la comparación solo para que la fila se
                // repinte cuando avanza el minuto; la regla vive en lib/agendaTime.
                const esSlotDeAhora =
                  ahora.mins !== null && selectedDate === todayStr && esElTramoDeAhora(slot, GRID_SLOTS);
                return (
                  <div key={slot} className={`relative flex min-h-[44px] border-b border-gray-50 last:border-b-0 transition-colors ${
                    inWork ? "bg-white" : "bg-gray-50/70"
                  }`}>
                    {esSlotDeAhora && (
                      <div className="pointer-events-none absolute left-0 right-0 top-0 flex items-center z-10" aria-hidden="true">
                        <span className="w-14 shrink-0 pr-1.5 text-right text-[9px] font-black text-red-500 tabular-nums">
                          {ahora.label}
                        </span>
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                        <span className="flex-1 h-px bg-red-500/70" />
                      </div>
                    )}
                    {/* Time label */}
                    <div className={`w-14 shrink-0 flex items-start justify-end pr-3 pt-2 ${
                      isHour ? "text-[11px] font-bold text-gray-500" : "text-[10px] text-gray-300"
                    }`}>
                      {isHour ? slot : "·"}
                    </div>
                    {/* Left border indicator: solid for work hours, dashed-like for off */}
                    <div className={`w-px self-stretch shrink-0 ${inWork ? "bg-blue-100" : "bg-gray-200"}`} />
                    {/* Slot content */}
                    <div className="flex-1 px-3 py-1.5 flex flex-col gap-1 justify-center">
                      {slotBookings.length === 0 && inWork && (
                        <button onClick={() => setShowNew(true)}
                          className="w-full text-left text-[10px] text-gray-200 hover:text-blue-400 transition py-1 rounded group">
                          <span className="group-hover:underline">+ cita</span>
                        </button>
                      )}
                      {slotBookings.map((b) => {
                        const pal = palOf(b.doctor, palMap);
                        const isCancelled = b.status === "cancelled";
                        // Una hora que el agente dejó pedida se dibuja con borde
                        // punteado y sin el relleno del profesional: a simple
                        // vista se lee como "hueco reservado", no como cita.
                        const porConfirmar = b.status === "pending" && b.requestedVia === "agent";
                        return (
                          <button key={b.id} onClick={() => setSelectedBooking(b)}
                            className={`w-full text-left flex items-center gap-2.5 px-2.5 py-2 rounded-xl border hover:shadow-sm transition group ${
                              isCancelled ? "opacity-40 line-through" : ""
                            }`}
                            style={porConfirmar
                              ? { background: "#FFFDF7", borderColor: "#E0B44A", borderStyle: "dashed" }
                              : { background: pal.bg, borderColor: `${pal.dot}40` }}>
                            {/* Time exact */}
                            <span className="text-[10px] font-black tabular-nums shrink-0" style={{ color: pal.dot }}>
                              {b.time}
                            </span>
                            {/* Color dot */}
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: pal.dot }} />
                            {/* Doctor */}
                            {!doctorFilter && (
                              <span className="text-[10px] font-bold shrink-0 hidden sm:block" style={{ color: pal.text }}>
                                {b.doctor.replace(/Dra?\. /, "").split(" ")[0]}
                              </span>
                            )}
                            {/* Patient */}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold truncate" style={{ color: pal.text }}>{b.patientName ?? "—"}</p>
                              <p className="text-[10px] truncate" style={{ color: pal.text, opacity: 0.6 }}>
                                {[b.service, b.box ? `Box ${b.box}` : null].filter(Boolean).join(" · ") || null}
                              </p>
                            </div>
                            {/* Status + pay */}
                            <div className="flex flex-col items-end gap-0.5 shrink-0">
                              <StatusPill status={b.status} requestedVia={b.requestedVia} />
                              <PayPill status={b.paymentStatus} />
                            </div>
                            <span className="text-[10px] opacity-30 group-hover:opacity-60 transition">›</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {selectedBooking && (
        <BookingModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onSave={async (id, patch) => { await handleSave(id, patch); setSelectedBooking(null); }}
          onCancel={async (id) => { await handleCancel(id); setSelectedBooking(null); }}
          onDecided={() => { setSelectedBooking(null); fetchWeek(weekStart); }}
          onNewQuote={(p) => setQuotePatient(p)}
        />
      )}
      {quotePatient && (
        <QuickQuoteModal patient={quotePatient} onClose={() => setQuotePatient(null)} />
      )}
      {showNew && (
        <NewBookingModal
          doctors={doctorNames}
          initialDate={selectedDate}
          boxes={boxes}
          sedes={sedes}
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
    const controller = new AbortController();
    fetch(`${API}/api/agenda/week?start=${toDateStr(getMondayOf(new Date()))}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error("non-200");
        return r.json();
      })
      .then((d) => setDays(d.days ?? []))
      .catch((err) => { if (err.name !== "AbortError") setDays([]); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
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

      <Section title="Mis citas de hoy" bookings={todayMine} empty="No tienes citas para hoy" loading={loading} />
      <Section title="Próximas citas esta semana" bookings={upcomingMine} empty="Sin citas próximas" showDate loading={loading} />
    </div>
  );
}

/* ── Main export ─────────────────────────────────────────────────────── */
export function AgendaTab({
  user,
  boxes = 2,
  doctors,
  sedes,
  scheduleConfig,
  openNewBookingOnMount = false,
}: {
  user: AuthUser;
  boxes?: number;
  doctors?: string[];
  sedes?: string[];
  scheduleConfig?: Record<string, string>;
  openNewBookingOnMount?: boolean;
}) {
  const isAdmin = user.role === "ADMIN" || user.role === "SUPERADMIN";
  return isAdmin
    ? <AdminAgenda boxes={boxes} doctors={doctors} sedes={sedes} scheduleConfig={scheduleConfig} openNewBookingOnMount={openNewBookingOnMount} />
    : <DoctorAgenda user={user} />;
}
