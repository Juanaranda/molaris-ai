"use client";

import { use, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Field } from "@/components/ui";
import { CampoTelefono } from "@/components/ui/CampoTelefono";
import { cx } from "@/lib/cx";
import { DIAS_SEMANA, ESPECIALIDADES, formatearRut, rutValido } from "@/lib/doctores";
import { aceptarInvitacion, leerInvitacion, type InvitacionAbierta } from "@/lib/invitaciones";

/**
 * El profesional abre el link que le mandó su clínica (MOL-54): completa su
 * perfil, crea su cuenta y entra. Lo que el admin ya puso viene precargado y lo
 * puede cambiar. El RUT y el WhatsApp los pone él.
 */
export default function InvitacionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const [estado, setEstado] = useState<"cargando" | "listo" | "invalida">("cargando");
  const [motivo, setMotivo] = useState("");
  const [clinica, setClinica] = useState("");
  const [form, setForm] = useState({
    nombres: "", apellidos: "", rut: "", phone: "", email: "", password: "",
    specialty: ESPECIALIDADES[0], days: ["monday", "tuesday", "wednesday", "thursday", "friday"] as string[],
    aceptaTerminos: false,
  });
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    leerInvitacion(token).then((r) => {
      if (cancelado) return;
      if (!r.ok) { setMotivo(r.error); setEstado("invalida"); return; }
      const p: InvitacionAbierta["profesional"] = r.datos.profesional;
      setClinica(r.datos.clinica);
      setForm((f) => ({
        ...f,
        nombres: p.nombres, apellidos: p.apellidos, email: p.email,
        specialty: p.specialty || f.specialty,
        days: p.days.length ? p.days : f.days,
      }));
      setEstado("listo");
    });
    return () => { cancelado = true; };
  }, [token]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const alternarDia = (clave: string) =>
    set("days", form.days.includes(clave) ? form.days.filter((d) => d !== clave) : [...form.days, clave]);

  async function crearCuenta(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.nombres.trim() || !form.apellidos.trim()) return setError("Escribe tus nombres y tus apellidos.");
    if (form.rut.trim() && !rutValido(form.rut)) return setError("El RUT no es válido. Revisa el dígito verificador.");
    if (form.days.length === 0) return setError("Marca al menos un día de atención.");
    if (form.password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
    if (!form.aceptaTerminos) return setError("Para crear tu cuenta tienes que aceptar los términos.");
    setEnviando(true);
    try {
      await aceptarInvitacion(token, form);
      router.replace("/partners/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos crear tu cuenta.");
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen bg-ground px-4 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-xl">
        <Link href="/" className="text-sm font-semibold text-brand-strong">molari.ai</Link>

        {estado === "cargando" && <p className="mt-10 text-sm text-ink-muted">Cargando tu invitación…</p>}

        {estado === "invalida" && (
          <div className="mt-8 rounded-card border border-line bg-surface p-6 sm:p-8">
            <h1 className="text-2xl font-bold text-brand-strong">No pudimos abrir la invitación</h1>
            <p className="mt-3 text-ink">{motivo}</p>
            <Link href="/login" className="mt-6 inline-flex min-h-11 items-center font-semibold text-brand hover:underline">
              Ir a iniciar sesión
            </Link>
          </div>
        )}

        {estado === "listo" && (
          <form onSubmit={crearCuenta} className="mt-8 rounded-card border border-line bg-surface p-6 sm:p-8" noValidate>
            <h1 className="text-2xl font-bold text-brand-strong">Te invitaron a {clinica}</h1>
            <p className="mt-2 text-ink-muted">
              Completa tu perfil y crea tu cuenta. Con tu WhatsApp te avisamos cuando un paciente pida hora contigo.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Nombres" value={form.nombres} onChange={(e) => set("nombres", e.target.value)} autoComplete="given-name" placeholder="María José" />
              <Field label="Apellidos" value={form.apellidos} onChange={(e) => set("apellidos", e.target.value)} autoComplete="family-name" placeholder="González Pérez" />
              <Field label="RUT" value={form.rut} onChange={(e) => set("rut", formatearRut(e.target.value))} placeholder="12.345.678-5" hint="Opcional." />
              <div className="flex flex-col gap-1.5">
                <label htmlFor="inv-whatsapp" className="text-sm font-semibold text-ink">WhatsApp</label>
                <CampoTelefono id="inv-whatsapp" value={form.phone} onChange={(v) => set("phone", v)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="inv-especialidad" className="text-sm font-semibold text-ink">Especialidad</label>
                <select id="inv-especialidad" value={form.specialty} onChange={(e) => set("specialty", e.target.value)}
                  className="min-h-11 w-full rounded-control border border-line bg-surface px-3 text-base text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30">
                  {[...new Set([form.specialty, ...ESPECIALIDADES])].map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <Field label="Correo" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" hint="Con este correo vas a entrar." />
            </div>

            <fieldset className="mt-5">
              <legend className="text-sm font-semibold text-ink">Días que atiendes en {clinica}</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {DIAS_SEMANA.map((d) => {
                  const activo = form.days.includes(d.clave);
                  return (
                    <button key={d.clave} type="button" aria-pressed={activo} onClick={() => alternarDia(d.clave)}
                      className={cx("h-11 w-12 rounded-control text-sm font-bold transition-colors",
                        activo ? "bg-brand text-white" : "bg-ground text-ink-muted hover:text-ink")}>
                      {d.corto}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="mt-5">
              <Field label="Crea tu contraseña" type="password" value={form.password} onChange={(e) => set("password", e.target.value)}
                autoComplete="new-password" hint="Al menos 8 caracteres." />
            </div>

            <label className="mt-5 flex items-start gap-3 text-sm text-ink">
              <input type="checkbox" checked={form.aceptaTerminos} onChange={(e) => set("aceptaTerminos", e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-brand)]" />
              <span>
                Acepto los <Link href="/legal/terminos" className="font-semibold text-brand underline">términos</Link> y
                la <Link href="/legal/privacidad" className="font-semibold text-brand underline">política de privacidad</Link> de molari.ai.
              </span>
            </label>

            {error && <p role="alert" className="mt-5 rounded-control bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>}

            <Button type="submit" loading={enviando} block className="mt-6">Crear mi cuenta</Button>
          </form>
        )}
      </div>
    </div>
  );
}
