import { useId, useState } from "react";
import { Button, Field } from "@/components/ui";
import { CampoTelefono } from "@/components/ui/CampoTelefono";
import { cx } from "@/lib/cx";
import { PatientAutocomplete } from "../PatientAutocomplete";
import { BotonCerrar, CAMPO, ETIQUETA, useDialogo } from "./DetalleCita";

const TIME_OPTIONS = Array.from({ length: 20 }, (_, i) => {
  const h = Math.floor(i / 2) + 9;
  const m = i % 2 === 0 ? "00" : "30";
  return `${String(h).padStart(2, "0")}:${m}`;
});

export interface NuevaCitaDatos {
  doctor: string; date: string; time: string; box?: string; sede?: string; patientName: string;
  patientRut?: string; patientPhone?: string; patientEmail?: string; service?: string;
}

export function NewBookingModal({ doctors, initialDate, boxes, sedes = [], onClose, onCreate }: {
  doctors: string[];
  initialDate: string;
  boxes: number;
  /** Sedes del doctor independiente (#69). Vacío = no se muestra el selector. */
  sedes?: string[];
  onClose: () => void;
  onCreate: (data: NuevaCitaDatos) => Promise<void>;
}) {
  const [form, setForm] = useState({ doctor: doctors[0] ?? "", date: initialDate, time: "10:00", box: "1",
    sede: sedes[0] ?? "",
    patientName: "", patientRut: "", patientPhone: "", patientEmail: "", service: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Paciente traído de la ficha vs. escrito a mano: cambia si los campos de
  // contacto se pueden tocar y qué se le muestra a quien está agendando.
  const [pacienteExistente, setPacienteExistente] = useState(false);
  const id = useId();
  const dialogo = useDialogo(onClose);

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

  const soloLectura = pacienteExistente ? "bg-ground text-ink-muted" : "";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      {/* En móvil sube desde abajo y ocupa el ancho completo: el pulgar llega al
          borde inferior, no al centro de la pantalla. En desktop sigue centrado. */}
      <div ref={dialogo} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={`${id}-titulo`}
        className="flex max-h-[92vh] outline-none w-full max-w-md flex-col rounded-t-card bg-surface shadow-2xl sm:max-h-[90vh] sm:rounded-card">
        <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-2 sm:px-6">
          <h2 id={`${id}-titulo`} className="text-lg font-bold text-brand-strong">Nueva cita</h2>
          <BotonCerrar onClick={onClose} />
        </div>
        {/* overflow-y-auto y no overflow-hidden: con el modal recortado, el
            desplegable de pacientes quedaba cortado por el borde inferior. */}
        <form onSubmit={submit} className="flex flex-col gap-4 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-doc`} className={ETIQUETA}>Profesional</label>
            <select id={`${id}-doc`} value={form.doctor} onChange={set("doctor")} className={CAMPO}>
              {doctors.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <Field label="Fecha" type="date" value={form.date} onChange={set("date")} required />
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${id}-hora`} className={ETIQUETA}>Hora</label>
              <select id={`${id}-hora`} value={form.time} onChange={set("time")} className={CAMPO}>
                {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${id}-box`} className={ETIQUETA}>Box</label>
              <select id={`${id}-box`} value={form.box} onChange={set("box")} className={CAMPO}>
                {Array.from({ length: boxes }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={String(n)}>Box {n}</option>
                ))}
              </select>
            </div>
          </div>
          {/* Sede: solo si el doctor configuró más de un lugar de atención */}
          {sedes.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${id}-sede`} className={ETIQUETA}>Sede</label>
              <select id={`${id}-sede`} value={form.sede} onChange={set("sede")} className={CAMPO}>
                {sedes.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <span className={ETIQUETA}>Nombre del paciente</span>
            <PatientAutocomplete
              value={form.patientName}
              seleccionado={pacienteExistente}
              inputClassName={CAMPO}
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
            <Field label="RUT" value={form.patientRut} onChange={set("patientRut")} placeholder="12.345.678-9" autoComplete="off" spellCheck={false}
              readOnly={pacienteExistente} className={soloLectura} />
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${id}-tel`} className={ETIQUETA}>Teléfono</label>
              <CampoTelefono id={`${id}-tel`} value={form.patientPhone} onChange={(v) => setForm((f) => ({ ...f, patientPhone: v }))}
                readOnly={pacienteExistente} className={cx("min-h-11", pacienteExistente && "bg-ground")} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email" type="email" value={form.patientEmail} onChange={set("patientEmail")} placeholder="correo@…" autoComplete="off" spellCheck={false}
              readOnly={pacienteExistente} className={soloLectura} />
            <Field label="Servicio" value={form.service} onChange={set("service")} placeholder="Ej: Limpieza dental" />
          </div>
          {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
          <Button type="submit" block loading={saving}>
            {saving ? "Agendando…" : "Agendar cita"}
          </Button>
        </form>
      </div>
    </div>
  );
}
