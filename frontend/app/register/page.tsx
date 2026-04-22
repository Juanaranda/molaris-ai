"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type Step = 1 | 2;

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [clinic, setClinic] = useState({ name: "", phone: "", location: "", instagram: "", whatsapp: "" });
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
          clinic: { name: clinic.name, phone: clinic.phone, location: clinic.location, instagram: clinic.instagram, whatsapp: clinic.whatsapp },
          admin: { name: admin.name, email: admin.email, password: admin.password },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Error al registrar");
      }
      // Auto-login tras registro
      await login(admin.email, admin.password);
      router.push("/partners/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <nav className="flex items-center justify-between px-8 py-5 bg-white border-b border-gray-100">
        <Link href="/"><Image src="/logo.svg" alt="molaris.ai" width={140} height={36} priority /></Link>
        <Link href="/login" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
          Ya tengo cuenta →
        </Link>
      </nav>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Progress */}
          <div className="flex items-center gap-3 mb-8">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${step >= 1 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-400"}`}>1</div>
            <div className={`flex-1 h-0.5 ${step >= 2 ? "bg-blue-600" : "bg-gray-200"}`} />
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${step >= 2 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-400"}`}>2</div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
            {step === 1 && (
              <>
                <div className="mb-7">
                  <h1 className="text-xl font-bold text-gray-900">Tu clínica</h1>
                  <p className="text-sm text-gray-500 mt-1">Información básica de tu clínica dental</p>
                </div>
                <form onSubmit={nextStep} className="flex flex-col gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre de la clínica *</label>
                    <input
                      type="text"
                      value={clinic.name}
                      onChange={(e) => setClinic((c) => ({ ...c, name: e.target.value }))}
                      placeholder="Clínica Dental Las Condes"
                      required
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Teléfono</label>
                    <input
                      type="text"
                      value={clinic.phone}
                      onChange={(e) => setClinic((c) => ({ ...c, phone: e.target.value }))}
                      placeholder="+56 9 1234 5678"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Ubicación</label>
                    <input
                      type="text"
                      value={clinic.location}
                      onChange={(e) => setClinic((c) => ({ ...c, location: e.target.value }))}
                      placeholder="Las Condes, Santiago"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">WhatsApp</label>
                      <input
                        type="text"
                        value={clinic.whatsapp}
                        onChange={(e) => setClinic((c) => ({ ...c, whatsapp: e.target.value }))}
                        placeholder="56912345678"
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Instagram</label>
                      <input
                        type="text"
                        value={clinic.instagram}
                        onChange={(e) => setClinic((c) => ({ ...c, instagram: e.target.value }))}
                        placeholder="@tuclinica"
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                      />
                    </div>
                  </div>
                  {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">{error}</p>}
                  <button type="submit" className="w-full bg-blue-600 text-white font-semibold py-2.5 rounded-xl hover:bg-blue-700 transition-colors text-sm mt-2">
                    Continuar →
                  </button>
                </form>
              </>
            )}

            {step === 2 && (
              <>
                <div className="mb-7">
                  <button onClick={() => setStep(1)} className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1">
                    ← Volver
                  </button>
                  <h1 className="text-xl font-bold text-gray-900">Tu cuenta de admin</h1>
                  <p className="text-sm text-gray-500 mt-1">Accederás con estos datos al portal de {clinic.name || "tu clínica"}</p>
                </div>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Tu nombre</label>
                    <input
                      type="text"
                      value={admin.name}
                      onChange={(e) => setAdmin((a) => ({ ...a, name: e.target.value }))}
                      placeholder="María González"
                      required
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Correo electrónico</label>
                    <input
                      type="email"
                      value={admin.email}
                      onChange={(e) => setAdmin((a) => ({ ...a, email: e.target.value }))}
                      placeholder="admin@tuclinica.cl"
                      required
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Contraseña</label>
                    <input
                      type="password"
                      value={admin.password}
                      onChange={(e) => setAdmin((a) => ({ ...a, password: e.target.value }))}
                      placeholder="Mínimo 8 caracteres"
                      required
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirmar contraseña</label>
                    <input
                      type="password"
                      value={admin.confirm}
                      onChange={(e) => setAdmin((a) => ({ ...a, confirm: e.target.value }))}
                      placeholder="Repite tu contraseña"
                      required
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                    />
                  </div>
                  {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">{error}</p>}
                  <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-semibold py-2.5 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm mt-2">
                    {loading ? "Creando cuenta..." : "Crear cuenta y entrar →"}
                  </button>
                </form>
              </>
            )}
          </div>

          <p className="text-center text-xs text-gray-400 mt-5">
            Al registrarte aceptas los términos de uso de molaris.ai
          </p>
        </div>
      </div>
    </div>
  );
}
