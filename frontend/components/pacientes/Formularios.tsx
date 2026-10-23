import { useEffect, useState } from "react";
import { Button, CLASE_CAMPO, CLASE_ETIQUETA, Dialogo, Field, Select } from "@/components/ui";
import { CampoTelefono } from "@/components/ui/CampoTelefono";
import { getToken } from "@/lib/auth";
import { toLocalDateStr } from "@/lib/dateParser";
import { haceCuanto, invalidatePatientsCache, type PatientSuggestion } from "@/lib/patients";
import { PatientAutocomplete } from "../PatientAutocomplete";
import type { Patient, TreatmentPlan } from "./formato";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/** Los profesionales configurados de la clínica, para los desplegables. */
function useProfesionales(alCargar?: (lista: string[]) => void) {
  const [lista, setLista] = useState<string[]>([]);
  useEffect(() => {
    import("@/lib/auth").then(({ getMe }) =>
      getMe().then((data) => {
        const cfg = data?.clinic?.config as { doctors?: { name: string }[] } | undefined;
        const l = cfg?.doctors?.map((d) => d.name) ?? [];
        setLista(l);
        alCargar?.(l);
      })
    );
    // alCargar solo se usa en la primera carga.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return lista;
}

const MensajeError = ({ texto }: { texto: string }) =>
  texto ? <p role="alert" className="text-sm font-semibold text-danger">{texto}</p> : null;

/* ── Nuevo plan de tratamiento ─────────────────────────────────────── */
interface NewPlanForm {
  title: string; doctor: string; description: string;
  totalAmount: string; sessions: string; notes: string;
}

export function NewPlanModal({ patient, onClose, onCreated }: {
  patient: Patient;
  onClose: () => void;
  onCreated: (plan: TreatmentPlan) => void;
}) {
  const [form, setForm] = useState<NewPlanForm>({
    title: "", doctor: "", description: "", totalAmount: "", sessions: "1", notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const doctores = useProfesionales();

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
    } catch { setError("Error de conexión. Revisa tu internet y vuelve a intentar."); }
    finally { setSaving(false); }
  }

  return (
    <Dialogo titulo="Nuevo plan de tratamiento" subtitulo={patient.name} onClose={onClose} capa={60}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-5 py-5">
        <Field label="Título" value={form.title} onChange={set("title")} placeholder="Ej: ortodoncia completa…" required />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Profesional" value={form.doctor} onChange={set("doctor")}>
            <option value="">Sin asignar</option>
            {doctores.map((d) => <option key={d} value={d}>{d}</option>)}
          </Select>
          <Field label="Sesiones" type="number" min="1" inputMode="numeric" value={form.sessions} onChange={set("sessions")} />
        </div>
        <Field label="Monto total (CLP)" type="number" min="0" inputMode="numeric" value={form.totalAmount} onChange={set("totalAmount")} placeholder="Ej: 180000" />
        <Field multiline label="Descripción" rows={2} value={form.description} onChange={set("description")} placeholder="Detalle del tratamiento…" />
        <MensajeError texto={error} />
        <div className="flex gap-3 pt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="flex-1" loading={saving}>{saving ? "Guardando…" : "Crear plan"}</Button>
        </div>
      </form>
    </Dialogo>
  );
}

/* ── Agendar desde el paciente ─────────────────────────────────────── */
const TIME_OPTIONS = Array.from({ length: 20 }, (_, i) => {
  const h = Math.floor(i / 2) + 9;
  const m = i % 2 === 0 ? "00" : "30";
  return `${String(h).padStart(2, "0")}:${m}`;
});

export function NewBookingFromPatientModal({ patient, onClose, onCreated }: {
  patient: Patient;
  onClose: () => void;
  onCreated: () => void;
}) {
  const today = toLocalDateStr(new Date());
  const [form, setForm] = useState({ date: today, time: "10:00", doctor: "", service: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const doctors = useProfesionales((l) => { if (l.length > 0) setForm((f) => ({ ...f, doctor: l[0] })); });

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
    } catch { setError("Error de conexión. Revisa tu internet y vuelve a intentar."); }
    finally { setSaving(false); }
  }

  return (
    <Dialogo titulo="Nueva cita" subtitulo={patient.name} onClose={onClose} ancho="sm" capa={70}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-5 py-5">
        <Select label="Profesional" value={form.doctor} onChange={set("doctor")}>
          {doctors.length === 0 && <option value="">Cargando…</option>}
          {doctors.map((d) => <option key={d} value={d}>{d}</option>)}
        </Select>
        <Field label="Fecha" type="date" value={form.date} onChange={set("date")} required />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Hora" value={form.time} onChange={set("time")}>
            {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
          <Field label="Servicio" value={form.service} onChange={set("service")} placeholder="Consulta, limpieza…" />
        </div>
        <MensajeError texto={error} />
        <div className="flex gap-3 pt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="flex-1" loading={saving} disabled={doctors.length === 0}>
            {saving ? "Agendando…" : "Agendar"}
          </Button>
        </div>
      </form>
    </Dialogo>
  );
}

/* ── Nuevo paciente ────────────────────────────────────────────────── */
export function NewPatientModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
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
    } catch { setError("Error de conexión. Revisa tu internet y vuelve a intentar."); }
    finally { setSaving(false); }
  }

  return (
    <Dialogo titulo="Nuevo paciente" onClose={onClose} ancho="sm">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-5 py-5">
        <div className="flex flex-col gap-1.5">
          <span className={CLASE_ETIQUETA}>Nombre completo</span>
          <PatientAutocomplete
            value={form.name}
            seleccionado={false}
            inputClassName={CLASE_CAMPO}
            autoFocus
            onChange={(nombre) => { setForm((f) => ({ ...f, name: nombre })); setDuplicado(null); }}
            onSelect={(p) => { setForm((f) => ({ ...f, name: p.name })); setDuplicado(p); }}
            onClear={() => { setForm((f) => ({ ...f, name: "" })); setDuplicado(null); }}
          />
        </div>

        {duplicado && (
          <div className="rounded-control border border-warn/30 bg-warn-soft px-3.5 py-3">
            <p className="text-sm font-bold text-warn">Ese paciente ya está registrado</p>
            <p className="mt-0.5 text-[13px] text-ink">
              {[duplicado.rut, `${duplicado.visits} ${duplicado.visits === 1 ? "visita" : "visitas"}`,
                `última ${haceCuanto(duplicado.lastVisit)}`].filter(Boolean).join(" · ")}
            </p>
            <p className="mt-1.5 text-[13px] text-ink">
              Búscalo en la lista en vez de crearlo de nuevo: registrarlo dos veces parte su historial.
            </p>
            <button type="button" onClick={() => { setDuplicado(null); setForm((f) => ({ ...f, name: "" })); }}
              className="mt-1 min-h-11 text-sm font-semibold text-warn underline underline-offset-2">
              Escribir otro nombre
            </button>
          </div>
        )}
        <Field label="RUT" value={form.rut} onChange={set("rut")} placeholder="12.345.678-9" autoComplete="off" spellCheck={false} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="nuevo-paciente-tel" className={CLASE_ETIQUETA}>Teléfono</label>
          <CampoTelefono id="nuevo-paciente-tel" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} className="min-h-11" />
        </div>
        <Field label="Email" type="email" value={form.email} onChange={set("email")} placeholder="correo@gmail.com" autoComplete="off" spellCheck={false} />
        <MensajeError texto={error} />
        <div className="flex gap-3 pt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="flex-1" loading={saving}>{saving ? "Guardando…" : "Registrar"}</Button>
        </div>
      </form>
    </Dialogo>
  );
}
