"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button, Card, Field } from "@/components/ui";
import { CampoTelefono } from "@/components/ui/CampoTelefono";
import { cx } from "@/lib/cx";
import { DIAS_SEMANA, ESPECIALIDADES, formatearRut, rutValido } from "@/lib/doctores";
import { mostrarTelefono } from "@/lib/telefono";
import { getMiPerfil, guardarMiPerfil, type MiPerfil } from "@/lib/invitaciones";

/**
 * Lo que el profesional mantiene de sí mismo (MOL-54): nombres, RUT, WhatsApp,
 * especialidad y días. Solo aparece si la cuenta está unida a un profesional
 * de la clínica (los que entraron por su invitación).
 */
export function PerfilProfesional() {
  const [datos, setDatos] = useState<{ clinica: string; perfil: MiPerfil } | null>(null);
  const [form, setForm] = useState<MiPerfil | null>(null);
  const [editando, setEditando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    getMiPerfil().then((r) => { if (!cancelado) setDatos(r); });
    return () => { cancelado = true; };
  }, []);

  if (!datos) return null;
  const p = datos.perfil;

  const set = <K extends keyof MiPerfil>(k: K, v: MiPerfil[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError("");
    if (!form.nombres.trim() || !form.apellidos.trim()) return setError("Escribe tus nombres y tus apellidos.");
    if (form.rut.trim() && !rutValido(form.rut)) return setError("El RUT no es válido. Revisa el dígito verificador.");
    if (form.days.length === 0) return setError("Marca al menos un día de atención.");
    setGuardando(true);
    try {
      setDatos(await guardarMiPerfil(form));
      setEditando(false);
      setAviso("Guardado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos guardar tu perfil.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Card
      title="Mi perfil profesional"
      action={!editando && (
        <Button variant="secondary" size="sm" onClick={() => { setForm(p); setEditando(true); setAviso(""); }}>Editar</Button>
      )}
    >
      <p className="text-sm text-ink-muted">Lo que ve {datos.clinica} y lo que usa el asistente para ofrecer tus horas.</p>

      {!editando || !form ? (
        <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div><dt className="text-ink-muted">Nombre</dt><dd className="font-semibold text-ink">{`${p.nombres} ${p.apellidos}`.trim() || "—"}</dd></div>
          <div><dt className="text-ink-muted">RUT</dt><dd className="font-semibold text-ink">{p.rut || "—"}</dd></div>
          <div><dt className="text-ink-muted">WhatsApp</dt><dd className="font-semibold text-ink">{mostrarTelefono(p.phone) || "—"}</dd></div>
          <div><dt className="text-ink-muted">Especialidad</dt><dd className="font-semibold text-ink">{p.specialty || "—"}</dd></div>
          <div className="sm:col-span-2">
            <dt className="text-ink-muted">Días que atiendes</dt>
            <dd className="font-semibold text-ink">{DIAS_SEMANA.filter((d) => p.days.includes(d.clave)).map((d) => d.corto).join(" · ") || "—"}</dd>
          </div>
          {aviso && <p className="text-sm font-semibold text-ok sm:col-span-2">{aviso}</p>}
        </dl>
      ) : (
        <form onSubmit={guardar} className="mt-5 flex flex-col gap-4" noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nombres" value={form.nombres} onChange={(e) => set("nombres", e.target.value)} />
            <Field label="Apellidos" value={form.apellidos} onChange={(e) => set("apellidos", e.target.value)} />
            <Field label="RUT" value={form.rut} onChange={(e) => set("rut", formatearRut(e.target.value))} placeholder="12.345.678-5" />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="perfil-whatsapp" className="text-sm font-semibold text-ink">WhatsApp</label>
              <CampoTelefono id="perfil-whatsapp" value={form.phone} onChange={(v) => set("phone", v)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="perfil-especialidad" className="text-sm font-semibold text-ink">Especialidad</label>
              <select id="perfil-especialidad" value={form.specialty} onChange={(e) => set("specialty", e.target.value)}
                className="min-h-11 w-full rounded-control border border-line bg-surface px-3 text-base text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30">
                {[...new Set([form.specialty, ...ESPECIALIDADES].filter(Boolean))].map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
          </div>
          <fieldset>
            <legend className="text-sm font-semibold text-ink">Días que atiendes</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {DIAS_SEMANA.map((d) => {
                const activo = form.days.includes(d.clave);
                return (
                  <button key={d.clave} type="button" aria-pressed={activo}
                    onClick={() => set("days", activo ? form.days.filter((x) => x !== d.clave) : [...form.days, d.clave])}
                    className={cx("h-11 w-12 rounded-control text-sm font-bold transition-colors",
                      activo ? "bg-brand text-white" : "bg-ground text-ink-muted hover:text-ink")}>
                    {d.corto}
                  </button>
                );
              })}
            </div>
          </fieldset>
          {error && <p role="alert" className="rounded-control bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>}
          <div className="flex gap-3">
            <Button type="submit" loading={guardando}>Guardar</Button>
            <Button variant="ghost" onClick={() => { setEditando(false); setError(""); }}>Cancelar</Button>
          </div>
        </form>
      )}
    </Card>
  );
}
