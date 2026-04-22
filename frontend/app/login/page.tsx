"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.push("/partners/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#F7F5F1" }}>
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b" style={{ backgroundColor: "#FDFCFB", borderColor: "#E5E0D9" }}>
        <Link href="/">
          <Image src="/logo.svg" alt="molaris.ai" width={140} height={36} priority />
        </Link>
        <Link href="/" className="text-sm font-medium transition-colors" style={{ color: "#607281" }}>
          ← Volver al inicio
        </Link>
      </nav>

      {/* Login card */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="rounded-2xl p-8 shadow-sm" style={{ backgroundColor: "#FDFCFB", border: "1px solid #E5E0D9" }}>
            <div className="text-center mb-8">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "#0B2F42" }}>
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
                  <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                </svg>
              </div>
              <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold" style={{ color: "#0C1B26" }}>Portal de clínicas</h1>
              <p className="text-sm mt-1" style={{ color: "#607281" }}>Accede a tu panel de molaris.ai</p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#607281" }}>
                  Correo electrónico
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@tuclinica.cl"
                  required
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition"
                  style={{ border: "1px solid #E5E0D9", backgroundColor: "#F7F5F1", color: "#0C1B26" }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#1A5C7A")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#E5E0D9")}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#607281" }}>
                  Contraseña
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition"
                  style={{ border: "1px solid #E5E0D9", backgroundColor: "#F7F5F1", color: "#0C1B26" }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#1A5C7A")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#E5E0D9")}
                />
              </div>

              {error && (
                <p className="text-sm rounded-xl px-4 py-2.5" style={{ color: "#D95F45", backgroundColor: "#FDECEA", border: "1px solid rgba(217,95,69,0.15)" }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full text-white font-semibold py-3 rounded-xl text-sm mt-1 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: "#0B2F42" }}
              >
                {loading ? "Ingresando..." : "Ingresar"}
              </button>
            </form>

            <p className="text-center text-xs mt-6" style={{ color: "#607281" }}>
              ¿Aún no tienes cuenta?{" "}
              <Link href="/register" className="font-semibold hover:underline" style={{ color: "#1A5C7A" }}>
                Regístrate gratis
              </Link>
            </p>
          </div>

          {/* Demo hint */}
          <div className="mt-4 rounded-2xl p-4 text-center" style={{ backgroundColor: "#E8F3F7", border: "1px solid rgba(26,92,122,0.15)" }}>
            <p className="text-xs font-bold mb-1" style={{ color: "#1A5C7A" }}>Demo disponible</p>
            <p className="text-xs" style={{ color: "#1A5C7A" }}>
              Prueba con <strong>admin@galana.cl</strong> / <strong>galana2024!</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
