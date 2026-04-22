"use client";

import Link from "next/link";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type Step = 1 | 2;

const BENEFITS = [
  "Asistente IA que responde 24/7 en WhatsApp, Instagram y tu web",
  "Agendamiento directo sin llamadas ni intermediarios",
  "Lead scoring automático con cada conversación",
  "Panel de control para ver leads y configurar tu clínica",
];

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [clinic, setClinic] = useState({ name: "", phone: "", location: "" });
  const [admin, setAdmin] = useState({ name: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function nextStep(e: FormEvent) {
    e.preventDefault();
    if (!clinic.name.trim()) { setError("El nombre de la clínica es requerido"); return; }
    setError("");
    setStep(2);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (admin.password !== admin.confirm) { setError("Las contraseñas no coinciden"); return; }
    if (admin.password.length < 8) { setError("La contraseña debe tener al menos 8 caracteres"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/clinics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinic: { name: clinic.name, phone: clinic.phone, location: clinic.location },
          admin: { name: admin.name, email: admin.email, password: admin.password },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Error al registrar");
      }
      const { slug } = await res.json();
      await login(admin.email, admin.password);
      router.push(`/demo/${slug}?welcome=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "var(--surface, #F7F5F1)" }}>

      {/* ── Panel izquierdo (solo desktop) ───────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[45%] flex-col justify-between p-12 text-white"
        style={{ backgroundColor: "var(--teal-dark, #0B2F42)" }}>
        <Link href="/" className="text-sm font-semibold tracking-tight opacity-80 hover:opacity-100 transition-opacity">
          ← molaris.ai
        </Link>

        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-6" style={{ color: "var(--coral, #D95F45)" }}>
            Plan Starter · Gratis 30 días
          </p>
          <h1 className="font-[family-name:var(--font-display,sans-serif)] text-4xl font-bold leading-tight mb-8">
            Tu clínica merece<br />un asistente que<br />nunca descansa.
          </h1>
          <ul className="flex flex-col gap-4">
            {BENEFITS.map((b, i) => (
              <li key={i} className="flex items-start gap-3 text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>
                <span className="mt-0.5 w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ backgroundColor: "var(--coral, #D95F45)", color: "white" }}>✓</span>
                {b}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
          © {new Date().getFullYear()} molaris.ai · Santiago, Chile
        </p>
      </div>

      {/* ── Panel derecho ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col">
        {/* Nav mobile */}
        <nav className="lg:hidden flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: "#E5E0D9", backgroundColor: "white" }}>
          <Link href="/" className="text-sm font-semibold" style={{ color: "var(--teal-dark, #0B2F42)" }}>
            ← molaris.ai
          </Link>
          <Link href="/login" className="text-sm" style={{ color: "var(--ink-muted, #607281)" }}>
            Ya tengo cuenta
          </Link>
        </nav>

        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">

            {/* Desktop: link "ya tengo cuenta" */}
            <div className="hidden lg:flex justify-end mb-6">
              <Link href="/login" className="text-sm transition-colors hover:opacity-70" style={{ color: "var(--ink-muted, #607281)" }}>
                Ya tengo cuenta →
              </Link>
            </div>

            {/* Stepper */}
            <div className="flex items-center gap-2 mb-8">
              {([1, 2] as Step[]).map((s, i) => (
                <div key={s} className="flex items-center gap-2 flex-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                    step >= s
                      ? "text-white"
                      : "bg-gray-100 text-gray-400"
                  }`} style={step >= s ? { backgroundColor: "var(--teal-mid, #1A5C7A)" } : {}}>
                    {step > s ? "✓" : s}
                  </div>
                  <span className={`text-xs hidden sm:block ${step >= s ? "font-medium" : "text-gray-400"}`}
                    style={step >= s ? { color: "var(--ink, #0C1B26)" } : {}}>
                    {s === 1 ? "Tu clínica" : "Tu cuenta"}
                  </span>
                  {i < 1 && <div className={`flex-1 h-px mx-2 ${step > s ? "" : "bg-gray-200"}`}
                    style={step > s ? { backgroundColor: "var(--teal-mid, #1A5C7A)" } : {}} />}
                </div>
              ))}
            </div>

            {/* Card */}
            <div className="bg-white rounded-3xl shadow-sm border p-8" style={{ borderColor: "#E5E0D9" }}>

              {step === 1 && (
                <>
                  <div className="mb-7">
                    <h2 className="font-[family-name:var(--font-display,sans-serif)] text-2xl font-bold" style={{ color: "var(--ink, #0C1B26)" }}>
                      Información de tu clínica
                    </h2>
                    <p className="text-sm mt-1.5" style={{ color: "var(--ink-muted, #607281)" }}>
                      Así configuraremos tu asistente virtual
                    </p>
                  </div>
                  <form onSubmit={nextStep} className="flex flex-col gap-4">
                    <Field label="Nombre de la clínica *" value={clinic.name}
                      onChange={(v) => setClinic((c) => ({ ...c, name: v }))}
                      placeholder="Clínica Dental Las Condes" autoFocus />
                    <Field label="Teléfono" value={clinic.phone}
                      onChange={(v) => setClinic((c) => ({ ...c, phone: v }))}
                      placeholder="+56 9 1234 5678" />
                    <Field label="Ciudad / Ubicación" value={clinic.location}
                      onChange={(v) => setClinic((c) => ({ ...c, location: v }))}
                      placeholder="Las Condes, Santiago" />
                    {error && <ErrorMsg msg={error} />}
                    <SubmitBtn label="Continuar →" disabled={false} loading={false} />
                  </form>
                </>
              )}

              {step === 2 && (
                <>
                  <div className="mb-7">
                    <button onClick={() => setStep(1)} className="text-xs mb-4 flex items-center gap-1 transition-opacity hover:opacity-70"
                      style={{ color: "var(--ink-muted, #607281)" }}>
                      ← Volver
                    </button>
                    <h2 className="font-[family-name:var(--font-display,sans-serif)] text-2xl font-bold" style={{ color: "var(--ink, #0C1B26)" }}>
                      Crea tu cuenta de acceso
                    </h2>
                    <p className="text-sm mt-1.5" style={{ color: "var(--ink-muted, #607281)" }}>
                      Administrarás {clinic.name} con estos datos
                    </p>
                  </div>
                  <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <Field label="Tu nombre" value={admin.name}
                      onChange={(v) => setAdmin((a) => ({ ...a, name: v }))}
                      placeholder="María González" autoFocus />
                    <Field label="Correo electrónico" type="email" value={admin.email}
                      onChange={(v) => setAdmin((a) => ({ ...a, email: v }))}
                      placeholder="admin@tuclinica.cl" />
                    <Field label="Contraseña" type="password" value={admin.password}
                      onChange={(v) => setAdmin((a) => ({ ...a, password: v }))}
                      placeholder="Mínimo 8 caracteres" />
                    <Field label="Confirmar contraseña" type="password" value={admin.confirm}
                      onChange={(v) => setAdmin((a) => ({ ...a, confirm: v }))}
                      placeholder="Repite tu contraseña" />
                    {error && <ErrorMsg msg={error} />}
                    <SubmitBtn label="Crear cuenta y ver mi demo →" disabled={loading} loading={loading} />
                  </form>
                </>
              )}
            </div>

            <p className="text-center text-xs mt-5" style={{ color: "var(--ink-muted, #607281)" }}>
              Al registrarte aceptas los{" "}
              <Link href="#" className="underline underline-offset-2">términos de uso</Link>{" "}
              de molaris.ai
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function Field({ label, value, onChange, placeholder, type = "text", autoFocus }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; autoFocus?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
        style={{ color: "var(--ink-muted, #607281)" }}>
        {label}
      </label>
      <input type={type} value={value} autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 rounded-xl border text-sm transition focus:outline-none focus:ring-2"
        style={{ borderColor: "#E5E0D9", backgroundColor: "var(--surface, #F7F5F1)",
          color: "var(--ink, #0C1B26)" } as React.CSSProperties}
        onFocus={(e) => { e.target.style.borderColor = "var(--teal-mid, #1A5C7A)"; e.target.style.backgroundColor = "white"; }}
        onBlur={(e) => { e.target.style.borderColor = "#E5E0D9"; e.target.style.backgroundColor = "var(--surface, #F7F5F1)"; }}
      />
    </div>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <p className="text-xs px-4 py-3 rounded-xl border" style={{ color: "#c0392b", backgroundColor: "#fef2f2", borderColor: "#fecaca" }}>
      {msg}
    </p>
  );
}

function SubmitBtn({ label, disabled, loading }: { label: string; disabled: boolean; loading: boolean }) {
  return (
    <button type="submit" disabled={disabled}
      className="w-full font-semibold py-3.5 rounded-xl text-sm text-white mt-2 transition-opacity hover:opacity-90 disabled:opacity-50"
      style={{ backgroundColor: "var(--teal-mid, #1A5C7A)" }}>
      {loading ? "Creando cuenta..." : label}
    </button>
  );
}
