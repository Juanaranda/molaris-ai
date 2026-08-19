"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken, getMe } from "@/lib/auth";
import { ensurePatientId } from "@/lib/clinicalRecord";
import { DentalQuoteTab } from "./DentalQuoteTab";
import { PatientAutocomplete } from "./PatientAutocomplete";
import { invalidatePatientsCache, haceCuanto, type PatientSuggestion } from "@/lib/patients";
import { CircleCheck, ClipboardList, FileText, Pencil, Stethoscope, User, X } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const MONTHS = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

interface Patient {
  key: string; name: string; rut: string | null; phone: string | null; email: string | null;
  visits: number; lastVisit: string; lastDoctor: string; services: string[];
  totalCharged: number; totalPaid: number; pendingCount: number;
}

type EstadoPago = "sin-datos" | "pagado" | "abonado" | "pendiente";

/**
 * Estado de pago de un paciente.
 *
 * "sin-datos" NO es lo mismo que "debe": las citas importadas de otro sistema
 * vienen sin montos, y mostrarlas como deuda hacía que los 2.183 pacientes
 * figuraran debiendo. Un contador que marca todo igual no informa nada.
 */
function estadoPago(p: { totalCharged: number; totalPaid: number }): {
  estado: EstadoPago; saldo: number; porcentaje: number;
} {
  const saldo = p.totalCharged - p.totalPaid;
  if (p.totalCharged <= 0) return { estado: "sin-datos", saldo: 0, porcentaje: 0 };
  const porcentaje = Math.round((p.totalPaid / p.totalCharged) * 100);
  if (saldo <= 0)        return { estado: "pagado",    saldo: 0, porcentaje: 100 };
  if (p.totalPaid > 0)   return { estado: "abonado",   saldo, porcentaje };
  return { estado: "pendiente", saldo, porcentaje: 0 };
}

interface HistoryEntry {
  id: string; doctor: string; date: string; time: string;
  service: string | null; status: string; notes: string | null;
  paymentStatus: string | null; amountTotal: number | null;
  amountPaid: number | null; paymentMethod: string | null; paidAt: string | null;
}

interface TreatmentPlan {
  id: string;
  patientRut: string | null;
  patientName: string;
  doctor: string | null;
  title: string;
  description: string | null;
  totalAmount: number | null;
  amountPaid: number;
  sessions: number;
  sessionsCompleted: number;
  status: string;
  startDate: string;
  endDate: string | null;
  notes: string | null;
  createdAt: string;
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    confirmed: "bg-emerald-50 text-emerald-700 border-emerald-100",
    pending:   "bg-amber-50 text-amber-700 border-amber-100",
    cancelled: "bg-gray-50 text-gray-400 border-gray-100",
  };
  const labels: Record<string, string> = { confirmed: "Confirmada", pending: "Pendiente", cancelled: "Cancelada" };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${map[status] ?? map.pending}`}>
      {labels[status] ?? status}
    </span>
  );
}

const fmtCLP = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${Math.round(n / 1_000)}k`;

const PAY_LABELS: Record<string, { label: string; cls: string }> = {
  paid:    { label: "Pagado",    cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  partial: { label: "Parcial",   cls: "bg-amber-50 text-amber-700 border-amber-200" },
  pending: { label: "Pendiente", cls: "bg-gray-50 text-gray-500 border-gray-200" },
  waived:  { label: "Bonif.",    cls: "bg-purple-50 text-purple-700 border-purple-200" },
};

function PayPill({ status }: { status: string | null }) {
  if (!status) return <span className="text-[10px] text-gray-300 border border-gray-100 px-2 py-0.5 rounded-full">Sin pago</span>;
  const s = PAY_LABELS[status] ?? PAY_LABELS.pending;
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${s.cls}`}>{s.label}</span>;
}

const PLAN_STATUS: Record<string, { label: string; cls: string }> = {
  active:    { label: "En curso",    cls: "bg-blue-50 text-blue-700 border-blue-200" },
  completed: { label: "Completado",  cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  paused:    { label: "Pausado",     cls: "bg-amber-50 text-amber-700 border-amber-200" },
  cancelled: { label: "Cancelado",   cls: "bg-gray-50 text-gray-400 border-gray-100" },
};

function PlanStatusPill({ status }: { status: string }) {
  const s = PLAN_STATUS[status] ?? PLAN_STATUS.active;
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${s.cls}`}>{s.label}</span>;
}

function ProgressBar({ value, max, color = "bg-blue-500" }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-gray-400 w-7 text-right">{pct}%</span>
    </div>
  );
}

interface NewPlanForm {
  title: string; doctor: string; description: string;
  totalAmount: string; sessions: string; notes: string;
}

function NewPlanModal({
  patient, onClose, onCreated,
}: {
  patient: Patient;
  onClose: () => void;
  onCreated: (plan: TreatmentPlan) => void;
}) {
  const [form, setForm] = useState<NewPlanForm>({
    title: "", doctor: "", description: "", totalAmount: "", sessions: "1", notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof NewPlanForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!form.title) { setError("El título es obligatorio"); return; }
    setSaving(true); setError("");
    try {
      const token = getToken();
      const res = await fetch(`${API}/api/treatment-plans`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          patientRut: patient.rut ?? undefined,
          patientName: patient.name,
          doctor: form.doctor || undefined,
          title: form.title,
          description: form.description || undefined,
          totalAmount: form.totalAmount ? parseFloat(form.totalAmount) : undefined,
          sessions: parseInt(form.sessions) || 1,
          notes: form.notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Error al crear"); return; }
      onCreated(data);
    } catch { setError("Error de conexión"); }
    finally { setSaving(false); }
  }

  const [DOCTORS, setDoctors] = useState<string[]>([]);
  useEffect(() => {
    import("@/lib/auth").then(({ getMe }) =>
      getMe().then((data) => {
        const cfg = data?.clinic?.config as { doctors?: { name: string }[] } | undefined;
        if (cfg?.doctors) setDoctors(cfg.doctors.map((d) => d.name));
      })
    );
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
          <div>
            <h3 className="text-base font-black text-gray-900">Nuevo plan de tratamiento</h3>
            <p className="text-xs text-gray-400 mt-0.5">{patient.name}</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 transition flex items-center justify-center text-gray-500"><X className="w-4 h-4" aria-hidden /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">Título *</label>
            <input value={form.title} onChange={set("title")} placeholder="Ortodoncia completa, Implante superior…"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Doctor</label>
              <select value={form.doctor} onChange={set("doctor")}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="">Sin asignar</option>
                {DOCTORS.map((d) => <option key={d} value={d}>{d.replace(/Dra?\. /,"")}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Sesiones</label>
              <input type="number" min="1" value={form.sessions} onChange={set("sessions")}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">Monto total (CLP)</label>
            <input type="number" min="0" value={form.totalAmount} onChange={set("totalAmount")} placeholder="0"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">Descripción</label>
            <textarea value={form.description} onChange={set("description")} rows={2} placeholder="Detalle del tratamiento…"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition disabled:opacity-50">
              {saving ? "Guardando…" : "Crear plan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const TIME_OPTIONS = Array.from({ length: 20 }, (_, i) => {
  const h = Math.floor(i / 2) + 9;
  const m = i % 2 === 0 ? "00" : "30";
  return `${String(h).padStart(2, "0")}:${m}`;
});

function NewBookingFromPatientModal({
  patient, onClose, onCreated,
}: {
  patient: Patient;
  onClose: () => void;
  onCreated: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    date: today, time: "10:00", doctor: "", service: "",
  });
  const [doctors, setDoctors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    import("@/lib/auth").then(({ getMe }) =>
      getMe().then((data) => {
        const cfg = data?.clinic?.config as { doctors?: { name: string }[] } | undefined;
        const list = cfg?.doctors?.map((d) => d.name) ?? [];
        setDoctors(list);
        if (list.length > 0) setForm((f) => ({ ...f, doctor: list[0] }));
      })
    );
  }, []);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!form.date || !form.time || !form.doctor) { setError("Fecha, hora y profesional son obligatorios"); return; }
    setSaving(true); setError("");
    try {
      const token = getToken();
      const res = await fetch(`${API}/api/agenda/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          patientName:  patient.name,
          patientRut:   patient.rut   ?? undefined,
          patientPhone: patient.phone ?? undefined,
          patientEmail: patient.email ?? undefined,
          date:    form.date,
          time:    form.time,
          doctor:  form.doctor,
          service: form.service || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Error al agendar"); return; }
      onCreated();
    } catch { setError("Error de conexión"); }
    finally { setSaving(false); }
  }

  const inp = "w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";
  const lbl = "block text-xs font-bold text-gray-600 mb-1";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
          <div>
            <h3 className="text-base font-black text-gray-900">Nueva cita</h3>
            <p className="text-xs text-gray-400 mt-0.5">{patient.name}</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 transition flex items-center justify-center text-gray-500"><X className="w-4 h-4" aria-hidden /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
          <div>
            <label className={lbl}>Profesional *</label>
            <select value={form.doctor} onChange={set("doctor")} className={inp}>
              {doctors.length === 0 && <option value="">Cargando...</option>}
              {doctors.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
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
              <label className={lbl}>Servicio</label>
              <input value={form.service} onChange={set("service")} placeholder="Consulta, limpieza…" className={inp} />
            </div>
          </div>
          {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition">
              Cancelar
            </button>
            <button type="submit" disabled={saving || doctors.length === 0}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition disabled:opacity-50">
              {saving ? "Agendando…" : "Agendar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PatientDetail({ patient: initialPatient, onClose }: { patient: Patient; onClose: () => void }) {
  const router = useRouter();
  const [patient, setPatient] = useState(initialPatient);
  const [tab, setTab] = useState<"history" | "plans" | "quotes">("history");
  const [openingRecord, setOpeningRecord] = useState(false);
  const [recordError, setRecordError]     = useState("");

  // La ficha ahora es una página con URL propia (abrible en otra pestaña,
  // compartible con el equipo), no un modal sobre un modal.
  async function openClinicalRecord() {
    setOpeningRecord(true); setRecordError("");
    try {
      const me = await getMe();
      if (!me?.clinic?.id) throw new Error("Sin clínica activa");
      const patientId = await ensurePatientId(me.clinic.id, {
        rut: patient.rut ?? undefined,
        phone: patient.phone ?? undefined,
      });
      router.push(`/partners/pacientes/${patientId}`);
    } catch (e) {
      setRecordError(e instanceof Error ? e.message : "Error");
      setOpeningRecord(false);
    }
  }
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [plans, setPlans] = useState<TreatmentPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [showNewBooking, setShowNewBooking] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ name: patient.name, phone: patient.phone ?? "", email: patient.email ?? "" });
  const [savingEdit, setSavingEdit] = useState(false);

  async function savePatientEdit() {
    setSavingEdit(true);
    try {
      const token = getToken();
      const res = await fetch(`${API}/api/patients/${encodeURIComponent(patient.key)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name:  editForm.name  || undefined,
          phone: editForm.phone || undefined,
          email: editForm.email || undefined,
        }),
      });
      if (!res.ok) throw new Error("Error al guardar");
      setPatient((p) => ({ ...p, name: editForm.name || p.name, phone: editForm.phone || null, email: editForm.email || null }));
      setEditMode(false);
    } catch { /* silently keep modal open */ }
    finally { setSavingEdit(false); }
  }

  useEffect(() => {
    if (!patient.rut) return;
    const token = getToken(); if (!token) return;
    setLoadingHistory(true);
    fetch(`${API}/api/patients/${encodeURIComponent(patient.rut)}/history`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error("non-200");
        return r.json();
      })
      .then(setHistory)
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, [patient.rut]);

  useEffect(() => {
    if (tab !== "plans") return;
    const token = getToken(); if (!token) return;
    setLoadingPlans(true);
    const url = patient.rut
      ? `${API}/api/treatment-plans?patientRut=${encodeURIComponent(patient.rut)}`
      : `${API}/api/treatment-plans`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (!r.ok) throw new Error("non-200");
        return r.json();
      })
      .then((data: TreatmentPlan[]) => {
        setPlans(patient.rut ? data : data.filter((p) => p.patientName === patient.name));
      })
      .catch(() => {})
      .finally(() => setLoadingPlans(false));
  }, [tab, patient.rut, patient.name]);

  const balance = patient.totalCharged - patient.totalPaid;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center sm:p-2 bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-none sm:rounded-2xl border border-gray-100 shadow-2xl w-full sm:w-[98vw] sm:max-w-[1600px] flex flex-col h-screen sm:h-[98vh] overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-7 py-6 shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center text-white font-black text-lg shrink-0">
                {patient.name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
              </div>
              <div>
                {editMode ? (
                  <input
                    value={editForm.name}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                    className="text-xl font-black bg-white/10 text-white border border-white/30 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-white/40 w-full"
                    placeholder="Nombre completo"
                  />
                ) : (
                  <h2 className="text-xl font-black text-white leading-tight">{patient.name}</h2>
                )}
                {patient.rut && <p className="text-sm text-white/60 mt-0.5">{patient.rut}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {editMode ? (
                <>
                  <button onClick={() => { setEditMode(false); setEditForm({ name: patient.name, phone: patient.phone ?? "", email: patient.email ?? "" }); }}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/10 text-white/70 hover:bg-white/20 transition">
                    Cancelar
                  </button>
                  <button onClick={savePatientEdit} disabled={savingEdit}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg bg-white text-slate-800 hover:bg-white/90 transition disabled:opacity-50">
                    {savingEdit ? "Guardando…" : "Guardar"}
                  </button>
                </>
              ) : (
                <>
                  {/* Agendar es la acción más frecuente sobre un paciente, así
                      que va sólida y primera. Antes vivía dentro del tab
                      Historial, invisible desde cualquier otra pestaña. */}
                  <button onClick={() => setShowNewBooking(true)}
                    className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl bg-white text-slate-800 hover:bg-white/90 shadow-sm transition"
                    title="Agendar una hora para este paciente">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    Agendar
                  </button>
                  <button onClick={openClinicalRecord} disabled={openingRecord}
                    className="text-xs font-bold px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition disabled:opacity-50"
                    title="Abrir ficha clínica completa con odontograma">
                    <Stethoscope className="w-4 h-4 inline-block align-[-3px]" aria-hidden /> {openingRecord ? "Abriendo…" : "Ficha clínica"}
                  </button>
                  <button onClick={() => setEditMode(true)}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition flex items-center justify-center text-white/70 shrink-0"
                    title="Editar datos del paciente"><Pencil className="w-4 h-4" aria-hidden /></button>
                </>
              )}
              <button onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition flex items-center justify-center text-white/70 shrink-0"><X className="w-4 h-4" aria-hidden /></button>
            </div>
          </div>
          {recordError && <p className="mt-2 text-xs text-red-300">{recordError}</p>}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
            <div>
              <p className="text-[10px] text-white/40 font-bold uppercase tracking-wide">Teléfono</p>
              {editMode ? (
                <input
                  value={editForm.phone}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+56 9 …"
                  className="text-sm bg-white/10 text-white border border-white/30 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-white/40 w-full mt-0.5"
                />
              ) : (
                <p className="text-sm font-semibold text-white/90">{patient.phone || "—"}</p>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-white/40 font-bold uppercase tracking-wide">Email</p>
              {editMode ? (
                <input
                  value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="correo@ejemplo.com"
                  className="text-sm bg-white/10 text-white border border-white/30 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-white/40 w-full mt-0.5"
                />
              ) : (
                <p className="text-sm font-semibold text-white/90 truncate">{patient.email || "—"}</p>
              )}
            </div>
            <div>
              <p className="text-[10px] text-white/40 font-bold uppercase tracking-wide">Visitas totales</p>
              <p className="text-sm font-semibold text-white/90">{patient.visits}</p>
            </div>
            <div>
              <p className="text-[10px] text-white/40 font-bold uppercase tracking-wide">Última visita</p>
              <p className="text-sm font-semibold text-white/90">{fmtDate(patient.lastVisit)}</p>
            </div>
          </div>

          {/* Resumen financiero */}
          {patient.totalCharged > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="bg-white/10 rounded-xl px-3 py-2">
                <p className="text-[9px] text-white/40 font-bold uppercase">Cobrado</p>
                <p className="text-sm font-black text-white/90">{fmtCLP(patient.totalCharged)}</p>
              </div>
              <div className="bg-white/10 rounded-xl px-3 py-2">
                <p className="text-[9px] text-white/40 font-bold uppercase">Pagado</p>
                <p className="text-sm font-black text-emerald-300">{fmtCLP(patient.totalPaid)}</p>
              </div>
              <div className={`rounded-xl px-3 py-2 ${balance > 0 ? "bg-red-500/20" : "bg-emerald-500/10"}`}>
                <p className="text-[9px] text-white/40 font-bold uppercase">Saldo</p>
                <p className={`text-sm font-black ${balance > 0 ? "text-red-300" : "text-emerald-300"}`}>
                  {balance > 0 ? `-${fmtCLP(balance)}` : "Al día"}
                </p>
              </div>
            </div>
          )}

          {patient.services.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {patient.services.map((s) => (
                <span key={s} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-white/70">{s}</span>
              ))}
            </div>
          )}
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {(["history", "plans", "quotes"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-3 text-xs font-bold transition whitespace-nowrap px-2 ${tab === t ? "text-blue-600 border-b-2 border-blue-500" : "text-gray-400 hover:text-gray-600"}`}>
              {t === "history" ? "Historial" : t === "plans" ? `Planes${plans.length > 0 ? ` (${plans.length})` : ""}` : "Presupuesto"}
            </button>
          ))}
        </div>

        {/* Tab: History */}
        {tab === "history" && (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* "Agendar" subió al header del paciente, donde está disponible
                desde cualquier pestaña. Acá queda solo el aviso de pagos. */}
            {patient.pendingCount > 0 && (
              <div className="px-5 py-2 border-b border-gray-50 flex items-center justify-end">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                  {patient.pendingCount} sin registrar pago
                </span>
              </div>
            )}
            <div className="overflow-y-auto">
              {loadingHistory ? (
                <div className="p-5 space-y-3">
                  {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />)}
                </div>
              ) : history.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Sin historial disponible</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {history.map((h) => {
                    const isEditing = editingNoteId === h.id;
                    return (
                      <div key={h.id} className="px-5 py-3 flex flex-col gap-2">
                        {/* Row top: date + doctor + pills */}
                        <div className="flex items-start gap-3">
                          <div className="shrink-0 text-center w-16">
                            <p className="text-xs font-bold text-gray-800">{h.time}</p>
                            <p className="text-[10px] text-gray-400">{fmtDate(h.date)}</p>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-700 truncate">{h.doctor.replace(/Dra?\. /,"")}</p>
                            {h.service && <p className="text-[11px] text-gray-400 truncate">{h.service}</p>}
                            {h.amountTotal && (
                              <p className="text-[11px] text-gray-400 mt-0.5">
                                {h.amountPaid ? fmtCLP(h.amountPaid) : "—"}
                                {h.amountTotal !== h.amountPaid && ` / ${fmtCLP(h.amountTotal)}`}
                                {h.paymentMethod && ` · ${{ cash:"Efectivo",transfer:"Transferencia",card:"Tarjeta",other:"Otro" }[h.paymentMethod] ?? h.paymentMethod}`}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <StatusPill status={h.status} />
                            <PayPill status={h.paymentStatus} />
                          </div>
                        </div>

                        {/* Clinical note */}
                        {isEditing ? (
                          <div className="ml-[76px] flex flex-col gap-2">
                            <textarea
                              autoFocus
                              value={noteText}
                              onChange={(e) => setNoteText(e.target.value)}
                              rows={3}
                              placeholder="Observaciones clínicas, evolución, indicaciones…"
                              className="w-full px-3 py-2 rounded-xl border border-blue-300 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none bg-blue-50/30"
                            />
                            <div className="flex gap-2">
                              <button
                                disabled={savingNote}
                                onClick={async () => {
                                  setSavingNote(true);
                                  const token = getToken();
                                  await fetch(`${API}/api/agenda/bookings/${h.id}`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                                    body: JSON.stringify({ notes: noteText }),
                                  });
                                  setHistory((prev) => prev.map((e) => e.id === h.id ? { ...e, notes: noteText } : e));
                                  setEditingNoteId(null);
                                  setSavingNote(false);
                                }}
                                className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 transition disabled:opacity-50">
                                {savingNote ? "Guardando…" : "Guardar"}
                              </button>
                              <button
                                onClick={() => setEditingNoteId(null)}
                                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-gray-500 border border-gray-200 hover:bg-gray-50 transition">
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="ml-[76px]">
                            {h.notes ? (
                              <button
                                onClick={() => { setEditingNoteId(h.id); setNoteText(h.notes ?? ""); }}
                                className="w-full text-left group">
                                <p className="text-[11px] text-gray-600 bg-slate-50 rounded-lg px-2.5 py-2 border border-slate-100 group-hover:border-blue-200 group-hover:bg-blue-50/30 transition leading-relaxed whitespace-pre-wrap">
                                  {h.notes}
                                </p>
                              </button>
                            ) : (
                              <button
                                onClick={() => { setEditingNoteId(h.id); setNoteText(""); }}
                                className="text-[10px] text-gray-300 hover:text-blue-500 transition font-semibold flex items-center gap-1">
                                <span>+</span> Agregar nota clínica
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: Plans */}
        {tab === "plans" && (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="px-5 py-2.5 border-b border-gray-50 flex justify-end">
              <button onClick={() => setShowNewPlan(true)}
                className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 transition">
                <span className="text-base leading-none">+</span> Nuevo plan
              </button>
            </div>
            <div className="overflow-y-auto">
              {loadingPlans ? (
                <div className="p-5 space-y-3">
                  {[1, 2].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
                </div>
              ) : plans.length === 0 ? (
                <div className="flex flex-col items-center py-10 gap-2">
                  <p className="text-2xl"><ClipboardList className="w-4 h-4" aria-hidden /></p>
                  <p className="text-sm text-gray-400">Sin planes de tratamiento</p>
                  <button onClick={() => setShowNewPlan(true)}
                    className="mt-1 text-xs font-bold text-blue-600 hover:underline">Crear el primero</button>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {plans.map((plan) => {
                    const moneyPct = plan.totalAmount && plan.totalAmount > 0
                      ? Math.min(100, Math.round((plan.amountPaid / plan.totalAmount) * 100)) : null;
                    const sessPct = plan.sessions > 0
                      ? Math.min(100, Math.round((plan.sessionsCompleted / plan.sessions) * 100)) : 0;
                    const pending = plan.totalAmount ? plan.totalAmount - plan.amountPaid : null;
                    return (
                      <div key={plan.id} className="px-5 py-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-800 truncate">{plan.title}</p>
                            {plan.doctor && (
                              <p className="text-[11px] text-gray-400">{plan.doctor.replace(/Dra?\. /,"")}</p>
                            )}
                          </div>
                          <PlanStatusPill status={plan.status} />
                        </div>
                        {plan.description && (
                          <p className="text-[11px] text-gray-500 mb-2 line-clamp-2">{plan.description}</p>
                        )}
                        {/* Financial progress */}
                        {plan.totalAmount && plan.totalAmount > 0 ? (
                          <div className="mb-2">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] text-gray-400 font-semibold">Pago</span>
                              <span className="text-[10px] text-gray-600 font-bold">
                                {fmtCLP(plan.amountPaid)} / {fmtCLP(plan.totalAmount)}
                                {pending && pending > 0 && <span className="text-red-500 ml-1">(-{fmtCLP(pending)})</span>}
                              </span>
                            </div>
                            <ProgressBar value={plan.amountPaid} max={plan.totalAmount}
                              color={moneyPct === 100 ? "bg-emerald-500" : "bg-blue-500"} />
                          </div>
                        ) : null}
                        {/* Session progress */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-gray-400 font-semibold">Sesiones</span>
                            <span className="text-[10px] text-gray-600 font-bold">
                              {plan.sessionsCompleted} / {plan.sessions}
                            </span>
                          </div>
                          <ProgressBar value={plan.sessionsCompleted} max={plan.sessions}
                            color={sessPct === 100 ? "bg-emerald-500" : "bg-purple-500"} />
                        </div>
                        <p className="text-[10px] text-gray-300 mt-2">{fmtDate(plan.startDate)}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
        {/* Tab: Quotes */}
        {tab === "quotes" && (
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
            <DentalQuoteTab patient={{ name: patient.name, rut: patient.rut }} />
          </div>
        )}
      </div>
      {showNewPlan && (
        <NewPlanModal patient={patient} onClose={() => setShowNewPlan(false)}
          onCreated={(plan) => { setPlans((ps) => [plan, ...ps]); setShowNewPlan(false); }} />
      )}
      {showNewBooking && (
        <NewBookingFromPatientModal
          patient={patient}
          onClose={() => setShowNewBooking(false)}
          onCreated={() => {
            setShowNewBooking(false);
            // Reload history to show the new booking
            const token = getToken();
            if (!token || !patient.rut) return;
            fetch(`${API}/api/patients/${encodeURIComponent(patient.rut)}/history`, {
              headers: { Authorization: `Bearer ${token}` },
            })
              .then((r) => {
                if (!r.ok) throw new Error("non-200");
                return r.json();
              })
              .then(setHistory)
              .catch(() => {});
          }}
        />
      )}
    </div>
  );
}

/* ── CSV Import modal ────────────────────────────────────────────────── */
type ImportStep = "upload" | "preview" | "result";

interface ImportResult { created: number; skipped: number; total: number; errors: string[]; }
interface PreviewRow { [col: string]: string; }

function ImportCSVModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep]         = useState<ImportStep>("upload");
  const [csvText, setCsvText]   = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview]   = useState<PreviewRow[]>([]);
  const [headers, setHeaders]   = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult]     = useState<ImportResult | null>(null);
  const [error, setError]       = useState("");

  function parsePreview(text: string) {
    const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return;
    const delim = lines[0].split(";").length > lines[0].split(",").length ? ";" : ",";
    const hdrs = lines[0].split(delim).map((h) => h.trim().replace(/^["']|["']$/g, ""));
    const rows = lines.slice(1, 6).map((line) => {
      const vals = line.split(delim).map((v) => v.trim().replace(/^["']|["']$/g, ""));
      const row: PreviewRow = {};
      hdrs.forEach((h, i) => { row[h] = vals[i] ?? ""; });
      return row;
    });
    setHeaders(hdrs);
    setPreview(rows);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvText(text);
      parsePreview(text);
      setStep("preview");
      setError("");
    };
    reader.readAsText(file, "UTF-8");
  }

  async function handleImport() {
    setImporting(true); setError("");
    try {
      const token = getToken();
      const res = await fetch(`${API}/api/patients/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ csv: csvText }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Error al importar"); return; }
      setResult(data);
      setStep("result");
      onSuccess();
    } catch {
      setError("Error de conexión");
    } finally { setImporting(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-2xl w-full max-w-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
          <div>
            <h2 className="text-base font-black text-gray-900">Importar pacientes desde CSV</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {step === "upload" && "Sube un archivo CSV exportado desde tu sistema actual"}
              {step === "preview" && `${fileName} — ${preview.length} fila${preview.length !== 1 ? "s" : ""} de preview`}
              {step === "result" && "Importación completada"}
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 transition flex items-center justify-center text-gray-500 shrink-0"><X className="w-4 h-4" aria-hidden /></button>
        </div>

        <div className="px-6 py-5">
          {/* Step: upload */}
          {step === "upload" && (
            <div className="flex flex-col gap-5">
              {/* Drop zone */}
              <button
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center hover:border-blue-300 hover:bg-blue-50 transition cursor-pointer w-full">
                <div className="text-4xl mb-3"><FileText className="w-4 h-4" aria-hidden /></div>
                <p className="text-sm font-bold text-gray-700 mb-1">Haz clic para seleccionar un archivo CSV</p>
                <p className="text-xs text-gray-400">Compatible con cualquier exportación CSV de tu sistema de gestión</p>
              </button>
              <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />

              {/* Format guide */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <p className="text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Columnas detectadas automáticamente</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 mb-3">
                  {[
                    ["Nombre",    "Nombre + Apellido paterno/materno (DentaLink) o columna combinada"],
                    ["RUT",       "rut, run, dni"],
                    ["Teléfono",  "Teléfono móvil (preferido), teléfono, celular"],
                    ["Email",     "Correo electrónico, email, correo"],
                    ["Fecha cita","fecha cita, fecha consulta (DD-MM-YYYY o YYYY-MM-DD)"],
                    ["Hora",      "hora, time (HH:MM)"],
                    ["Doctor",    "doctor, profesional, dentista"],
                    ["Servicio",  "servicio, tratamiento, prestación"],
                  ].map(([campo, desc]) => (
                    <div key={campo} className="flex gap-2 text-xs">
                      <span className="font-semibold text-slate-700 w-24 shrink-0">{campo}:</span>
                      <span className="text-slate-400">{desc}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400">Compatible con DentaLink, Dentalink, y otros exportados CSV. El separador puede ser coma (,) o punto y coma (;). Si no hay fecha de cita, los pacientes se registran con fecha de hoy.</p>
              </div>
            </div>
          )}

          {/* Step: preview */}
          {step === "preview" && (
            <div className="flex flex-col gap-4">
              <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50">
                      {headers.map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-bold text-gray-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {preview.map((row, i) => (
                      <tr key={i}>
                        {headers.map((h) => (
                          <td key={h} className="px-3 py-2 text-gray-700 whitespace-nowrap max-w-[160px] truncate">{row[h] ?? ""}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 text-center">
                Mostrando máx. 5 filas de preview. El sistema detectará automáticamente las columnas.
              </p>
              {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
              <div className="flex gap-3">
                <button onClick={() => { setStep("upload"); setError(""); }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition">
                  Cambiar archivo
                </button>
                <button onClick={handleImport} disabled={importing}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: "#D95F45" }}>
                  {importing ? "Importando..." : "Confirmar importación"}
                </button>
              </div>
            </div>
          )}

          {/* Step: result */}
          {step === "result" && result && (
            <div className="flex flex-col items-center gap-5 py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center text-3xl"><CircleCheck className="w-4 h-4" aria-hidden /></div>
              <div>
                <h3 className="text-lg font-black text-gray-900 text-center mb-1">¡Importación completada!</h3>
                <p className="text-sm text-gray-500 text-center">{result.total} filas procesadas</p>
              </div>
              <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
                <div className="bg-emerald-50 rounded-xl p-4 text-center border border-emerald-100">
                  <p className="text-3xl font-black text-emerald-600">{result.created}</p>
                  <p className="text-xs font-semibold text-emerald-600 mt-1">Creadas</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
                  <p className="text-3xl font-black text-gray-400">{result.skipped}</p>
                  <p className="text-xs font-semibold text-gray-400 mt-1">Omitidas</p>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="w-full bg-amber-50 border border-amber-100 rounded-xl p-3">
                  <p className="text-xs font-bold text-amber-700 mb-1">Advertencias ({result.errors.length})</p>
                  <ul className="text-xs text-amber-600 space-y-0.5">
                    {result.errors.map((e, i) => <li key={i}>• {e}</li>)}
                  </ul>
                </div>
              )}
              <button onClick={onClose}
                className="px-8 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition">
                Listo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── NewPatientModal ──────────────────────────────────────────────────── */
function NewPatientModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: "", rut: "", phone: "", email: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Acá el autocompletar no sirve para rellenar sino para frenar: si el nombre
  // que están escribiendo ya está en la base, registrarlo de nuevo parte la
  // historia clínica en dos fichas.
  const [duplicado, setDuplicado] = useState<PatientSuggestion | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("El nombre es obligatorio"); return; }
    if (duplicado) { setError("Ese paciente ya existe. Búscalo en la lista."); return; }
    setSaving(true); setError("");
    try {
      const token = getToken();
      const res = await fetch(`${API}/api/patients`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name:  form.name.trim()  || undefined,
          rut:   form.rut.trim()   || undefined,
          phone: form.phone.trim() || undefined,
          email: form.email.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Error al registrar"); return; }
      invalidatePatientsCache();
      onCreated();
    } catch { setError("Error de conexión"); }
    finally { setSaving(false); }
  }

  const inp = "w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500";
  const lbl = "block text-xs font-bold text-gray-600 mb-1";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
          <h3 className="text-base font-black text-gray-900">Nuevo paciente</h3>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 transition flex items-center justify-center text-gray-500"><X className="w-4 h-4" aria-hidden /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
          <div>
            <label className={lbl}>Nombre completo *</label>
            <PatientAutocomplete
              value={form.name}
              seleccionado={false}
              inputClassName={inp}
              autoFocus
              onChange={(nombre) => { setForm((f) => ({ ...f, name: nombre })); setDuplicado(null); }}
              onSelect={(p) => { setForm((f) => ({ ...f, name: p.name })); setDuplicado(p); }}
              onClear={() => { setForm((f) => ({ ...f, name: "" })); setDuplicado(null); }}
            />
          </div>

          {duplicado && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
              <p className="text-sm font-bold text-amber-900">Ese paciente ya está registrado</p>
              <p className="text-xs text-amber-800 mt-0.5">
                {[duplicado.rut, `${duplicado.visits} ${duplicado.visits === 1 ? "visita" : "visitas"}`,
                  `última ${haceCuanto(duplicado.lastVisit)}`].filter(Boolean).join(" · ")}
              </p>
              <p className="text-xs text-amber-800 mt-1.5">
                Búscalo en la lista en vez de crearlo de nuevo: registrarlo dos veces parte su historial.
              </p>
              <button type="button" onClick={() => { setDuplicado(null); setForm((f) => ({ ...f, name: "" })); }}
                className="mt-2 text-xs font-bold text-amber-900 underline underline-offset-2">
                Escribir otro nombre
              </button>
            </div>
          )}
          <div>
            <label className={lbl}>RUT</label>
            <input value={form.rut} onChange={set("rut")} placeholder="12.345.678-9" className={inp} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Teléfono</label>
              <input value={form.phone} onChange={set("phone")} placeholder="+56 9 1234 5678" className={inp} />
            </div>
            <div>
              <label className={lbl}>Email</label>
              <input type="email" value={form.email} onChange={set("email")} placeholder="correo@gmail.com" className={inp} />
            </div>
          </div>
          {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition disabled:opacity-50">
              {saving ? "Guardando…" : "Registrar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Búsqueda de pacientes ─────────────────────────────────────────────────
 * Dos cosas que fallaban y son el 90% de las búsquedas reales en una clínica
 * chilena: nadie escribe las tildes ("garces" no encontraba a "Garcés"), y el
 * RUT se escribe con puntos y guion mientras que en la base va sin nada
 * ("20.283.625-9" no encontraba a "202836259").
 */
function normalizar(s: string): string {
  // \u0300-\u036f = marcas diacriticas combinantes (NFD las separa de la letra).
  // Escapadas a proposito: como caracteres literales serian invisibles en el editor.
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Deja el RUT comparable: sin puntos, guion ni espacios, en minúscula (por la K). */
function soloRut(s: string): string {
  return s.replace(/[.\-\s]/g, "").toLowerCase();
}

function coincide(p: Patient, query: string): boolean {
  const q = normalizar(query.trim());
  if (!q) return true;
  if (normalizar(p.name).includes(q)) return true;
  const qRut = soloRut(query);
  if (qRut && soloRut(p.rut ?? "").includes(qRut)) return true;
  const qTel = query.replace(/\D/g, "");
  if (qTel && (p.phone ?? "").replace(/\D/g, "").includes(qTel)) return true;
  return false;
}

/**
 * Resalta el tramo coincidente sin alterar el texto original.
 *
 * La comparación es sobre el texto normalizado (sin tildes), pero se recorta
 * el ORIGINAL usando los índices, porque NFD conserva el largo carácter a
 * carácter salvo por las marcas que se quitan. Para evitar desalineación se
 * normaliza sin descomponer: se mapea cada carácter a su versión sin tilde,
 * manteniendo 1 a 1 la posición.
 */
function sinTildes1a1(s: string): string {
  return s
    .toLowerCase()
    .split("")
    .map((ch) => ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "") || ch)
    .join("");
}

function Resaltado({ texto, query }: { texto: string; query: string }) {
  const q = sinTildes1a1(query.trim());
  if (!q) return <>{texto}</>;
  const idx = sinTildes1a1(texto).indexOf(q);
  if (idx < 0) return <>{texto}</>;
  return (
    <>
      {texto.slice(0, idx)}
      <mark className="bg-amber-200 text-inherit rounded-[2px] px-0">{texto.slice(idx, idx + q.length)}</mark>
      {texto.slice(idx + q.length)}
    </>
  );
}

/* ── Main PatientsTab ─────────────────────────────────────────────────── */
export function PatientsTab() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [showImport, setShowImport] = useState(false);
  const [showNewPatient, setShowNewPatient] = useState(false);
  const [selected, setSelected] = useState<Patient | null>(null);
  const [cursor, setCursor]     = useState(0);
  const [exporting, setExporting] = useState(false);
  const [doctorFilter, setDoctorFilter] = useState<string>("");
  const [payFilter, setPayFilter]   = useState<"todos" | "deuda" | "aldia" | "sinregistro">("todos");
  const [dateFilter, setDateFilter] = useState<"todos" | "30" | "90" | "180+">("todos");
  const searchRef = useRef<HTMLInputElement>(null);

  /**
   * Descarga el CSV. Va por fetch y no por un <a href> directo porque el
   * endpoint pide el token en el header: un link plano llegaría sin auth.
   */
  async function exportCsv() {
    const token = getToken(); if (!token) return;
    setExporting(true);
    try {
      const res = await fetch(`${API}/api/patients/export`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("No se pudo exportar");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pacientes-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo exportar");
    } finally {
      setExporting(false);
    }
  }

  const loadPatients = useCallback(() => {
    const token = getToken(); if (!token) return;
    setLoading(true);
    fetch(`${API}/api/patients`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (!r.ok) throw new Error("non-200");
        return r.json();
      })
      .then(setPatients)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadPatients(); }, [loadPatients]);

  // Profesionales presentes en la base, para el desplegable. Sale de los datos
  // y no del equipo configurado: hay fichas antiguas con profesionales que ya
  // no atienden y también se deben poder filtrar.
  const doctorOptions = useMemo(() => {
    const s = new Set<string>();
    for (const p of patients) if (p.lastDoctor && p.lastDoctor !== "Sin asignar") s.add(p.lastDoctor);
    return [...s].sort((a, b) => a.localeCompare(b, "es"));
  }, [patients]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const DIA = 86_400_000;
    return patients.filter((p) => {
      if (!coincide(p, search)) return false;
      if (doctorFilter && p.lastDoctor !== doctorFilter) return false;
      // Se filtra por deuda real (monto), no por "citas sin registrar pago":
      // con datos importados sin montos, eso marcaba a todos como deudores.
      if (payFilter !== "todos") {
        const e = estadoPago(p).estado;
        if (payFilter === "deuda"      && e !== "pendiente" && e !== "abonado") return false;
        if (payFilter === "aldia"      && e !== "pagado")    return false;
        if (payFilter === "sinregistro" && e !== "sin-datos") return false;
      }
      if (dateFilter !== "todos") {
        const dias = (now - new Date(p.lastVisit).getTime()) / DIA;
        // "Sin venir hace 6+ meses" es el filtro de recall: a quién hay que
        // llamar de vuelta. Los otros dos acotan a actividad reciente.
        if (dateFilter === "30"   && dias > 30)  return false;
        if (dateFilter === "90"   && dias > 90)  return false;
        if (dateFilter === "180+" && dias < 180) return false;
      }
      return true;
    });
  }, [patients, search, doctorFilter, payFilter, dateFilter]);

  const hayFiltros = Boolean(doctorFilter) || payFilter !== "todos" || dateFilter !== "todos";

  // "/" enfoca el buscador desde cualquier parte, como en Gmail o GitHub: el
  // doctor llega con el paciente al lado y no quiere ir al mouse.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const escribiendo = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (e.key === "/" && !escribiendo) { e.preventDefault(); searchRef.current?.focus(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Al cambiar el filtro, el cursor vuelve al primer resultado para que Enter
  // siempre abra lo que se está viendo arriba.
  useEffect(() => { setCursor(0); }, [search]);

  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (filtered.length === 0) return;
    if (e.key === "ArrowDown")      { e.preventDefault(); setCursor((c) => Math.min(c + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp")   { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    else if (e.key === "Enter")     { e.preventDefault(); setSelected(filtered[cursor] ?? filtered[0]); }
    else if (e.key === "Escape")    { setSearch(""); searchRef.current?.blur(); }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Search + import — en móvil el buscador toma una fila entera y los
          botones de CSV quedan solo con el ícono: con las tres etiquetas la
          fila medía 630px en una pantalla de 375 y la página se corría de lado. */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="relative w-full sm:flex-1 sm:w-auto">
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={onSearchKeyDown}
            placeholder="Buscar por nombre, RUT o teléfono..."
            className="w-full pl-9 pr-20 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          {search ? (
            <button onClick={() => { setSearch(""); searchRef.current?.focus(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 text-xs flex items-center justify-center transition"
              title="Limpiar búsqueda"><X className="w-4 h-4" aria-hidden /></button>
          ) : (
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50 text-[10px] font-bold text-gray-400 hidden sm:block"
              title="Presiona / para buscar">/</kbd>
          )}
        </div>
        <span className="text-xs font-semibold text-gray-400 shrink-0 hidden sm:block">
          {filtered.length} paciente{filtered.length !== 1 ? "s" : ""}
        </span>
        <button onClick={() => setShowNewPatient(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 transition shrink-0 flex-1 sm:flex-none justify-center">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nuevo paciente
        </button>
        <button onClick={() => setShowImport(true)} aria-label="Importar pacientes desde CSV"
          title="Importar CSV"
          className="flex items-center gap-2 px-3.5 sm:px-4 py-3 sm:py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-600 hover:border-blue-300 hover:text-blue-600 transition shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          <span className="hidden sm:inline">Importar CSV</span>
        </button>
        <button onClick={exportCsv} disabled={exporting}
          title="Descargar la base de pacientes en CSV" aria-label="Exportar pacientes a CSV"
          className="flex items-center gap-2 px-3.5 sm:px-4 py-3 sm:py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-600 hover:border-blue-300 hover:text-blue-600 transition shrink-0 disabled:opacity-50">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 8l5-5 5 5M12 3v12" />
          </svg>
          <span className="hidden sm:inline">{exporting ? "Exportando…" : "Exportar CSV"}</span>
        </button>
      </div>

      {/* Filtros — los mismos ejes que ya muestran las columnas de la tabla */}
      <div className="flex items-center gap-2 flex-wrap">
        <select value={doctorFilter} onChange={(e) => setDoctorFilter(e.target.value)}
          aria-label="Filtrar por profesional"
          className="px-3 py-2.5 sm:py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30">
          <option value="">Todos los profesionales</option>
          {doctorOptions.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>

        <select value={payFilter} onChange={(e) => setPayFilter(e.target.value as typeof payFilter)}
          aria-label="Filtrar por estado de pago"
          className="px-3 py-2.5 sm:py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30">
          <option value="todos">Cualquier pago</option>
          <option value="deuda">Con saldo pendiente</option>
          <option value="aldia">Pagado</option>
          <option value="sinregistro">Sin pago registrado</option>
        </select>

        <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as typeof dateFilter)}
          aria-label="Filtrar por última visita"
          className="px-3 py-2.5 sm:py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30">
          <option value="todos">Cualquier fecha</option>
          <option value="30">Visitó últimos 30 días</option>
          <option value="90">Visitó últimos 90 días</option>
          <option value="180+">Sin venir hace 6+ meses</option>
        </select>

        {hayFiltros && (
          <button onClick={() => { setDoctorFilter(""); setPayFilter("todos"); setDateFilter("todos"); }}
            className="text-xs font-semibold text-gray-400 hover:text-gray-600 transition px-2">
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Patient list */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3"><User className="w-4 h-4" aria-hidden /></p>
            <p className="text-sm font-medium text-gray-500">
              {search ? "No se encontró ningún paciente" : "Sin pacientes registrados"}
            </p>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="hidden sm:grid grid-cols-[1fr_110px_120px_110px_140px_100px_40px] gap-4 px-5 py-2.5 border-b border-gray-50">
              {["Paciente", "RUT", "Teléfono", "Última visita", "Profesional", "Pago", ""].map((h) => (
                <span key={h} className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{h}</span>
              ))}
            </div>
            <div className="divide-y divide-gray-50">
              {filtered.map((p, idx) => {
                const isCursor = idx === cursor && search.length > 0;
                const pago = estadoPago(p);
                return (
                  <button key={p.key} onClick={() => setSelected(p)}
                    className={`w-full text-left px-5 py-3.5 transition group flex sm:grid sm:grid-cols-[1fr_110px_120px_110px_140px_100px_40px] sm:gap-4 items-center gap-3 ${
                      isCursor ? "bg-blue-50 ring-1 ring-inset ring-blue-200" : "hover:bg-gray-50"
                    }`}>
                    {/* Name + initials */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-black text-slate-500 shrink-0">
                        {p.name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">
                          <Resaltado texto={p.name} query={search} />
                        </p>
                        {p.email ? (
                          <p className="text-[11px] text-gray-400 truncate">{p.email}</p>
                        ) : p.services.length > 0 ? (
                          <p className="text-[11px] text-gray-400 truncate">{p.services.slice(0, 2).join(", ")}</p>
                        ) : null}
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 hidden sm:block">
                      {p.rut ? <Resaltado texto={p.rut} query={soloRut(search)} /> : "—"}
                    </span>
                    <span className="text-xs text-gray-500 hidden sm:block">
                      {p.phone ? <Resaltado texto={p.phone} query={search.replace(/\D/g, "")} /> : "—"}
                    </span>
                    <span className="text-xs text-gray-500 hidden sm:block">{fmtDate(p.lastVisit)}</span>
                    <span className="text-xs text-gray-500 hidden sm:block truncate">{p.lastDoctor && p.lastDoctor !== "Sin asignar" ? p.lastDoctor : "—"}</span>
                    {/* Estado pago */}
                    <div className="hidden sm:flex flex-col gap-0.5">
                      {pago.estado === "pagado" && (
                        <span className="text-[10px] font-bold text-emerald-600">Pagado</span>
                      )}
                      {pago.estado === "abonado" && (
                        <>
                          <span className="text-[10px] font-bold text-amber-600">Abonado {pago.porcentaje}%</span>
                          <span className="text-[9px] text-gray-400">falta {fmtCLP(pago.saldo)}</span>
                        </>
                      )}
                      {pago.estado === "pendiente" && (
                        <>
                          <span className="text-[10px] font-bold text-red-600">Pendiente</span>
                          <span className="text-[9px] text-gray-400">{fmtCLP(pago.saldo)}</span>
                        </>
                      )}
                      {pago.estado === "sin-datos" && (
                        <span className="text-[10px] text-gray-400">Sin registrar</span>
                      )}
                    </div>
                    <span className="text-gray-300 group-hover:text-gray-400 transition text-sm shrink-0">›</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {selected && <PatientDetail patient={selected} onClose={() => setSelected(null)} />}

      {showNewPatient && (
        <NewPatientModal
          onClose={() => setShowNewPatient(false)}
          onCreated={() => { setShowNewPatient(false); loadPatients(); }}
        />
      )}

      {showImport && (
        <ImportCSVModal
          onClose={() => setShowImport(false)}
          onSuccess={() => { setShowImport(false); loadPatients(); }}
        />
      )}
    </div>
  );
}
