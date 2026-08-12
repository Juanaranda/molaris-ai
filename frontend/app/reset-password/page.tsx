"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { resetPassword } from "@/lib/auth";

function PasswordInput({ value, onChange, placeholder, style }: {
  value: string; onChange: (v: string) => void; placeholder?: string; style: React.CSSProperties;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} required
        className="w-full px-4 py-3 pr-16 rounded-xl text-sm outline-none" style={style} />
      <button type="button" onClick={() => setShow((s) => !s)}
        aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold hover:opacity-70 transition"
        style={{ color: "#607281" }}>
        {show ? "Ocultar" : "Mostrar"}
      </button>
    </div>
  );
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token") ?? "";
    setToken(t);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("La contraseña debe tener al menos 8 caracteres"); return; }
    if (password !== confirm) { setError("Las contraseñas no coinciden"); return; }
    setLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
      setTimeout(() => router.push("/login"), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = { border: "1px solid #E5E0D9", backgroundColor: "#F7F5F1", color: "#0C1B26" };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#F7F5F1" }}>
      <nav className="flex items-center justify-between px-8 py-5 border-b" style={{ backgroundColor: "#FDFCFB", borderColor: "#E5E0D9" }}>
        <Link href="/"><Image src="/logo.svg" alt="molari.ai" width={140} height={36} priority /></Link>
        <Link href="/login" className="text-sm font-medium" style={{ color: "#607281" }}>Iniciar sesión</Link>
      </nav>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="rounded-2xl p-8 shadow-sm" style={{ backgroundColor: "#FDFCFB", border: "1px solid #E5E0D9" }}>
            <div className="text-center mb-8">
              <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold" style={{ color: "#0C1B26" }}>Nueva contraseña</h1>
              <p className="text-sm mt-1" style={{ color: "#607281" }}>Elige una contraseña nueva para tu cuenta</p>
            </div>

            {!token ? (
              <p className="text-sm rounded-xl px-4 py-2.5 text-center" style={{ color: "#D95F45", backgroundColor: "#FDECEA" }}>
                Enlace inválido. Pide uno nuevo desde <Link href="/login" className="font-semibold underline">Iniciar sesión</Link>.
              </p>
            ) : done ? (
              <p className="text-sm rounded-xl px-4 py-3 text-center" style={{ color: "#1A5C7A", backgroundColor: "#E8F3F7" }}>
                ✓ Contraseña actualizada. Te llevamos al inicio de sesión…
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#607281" }}>Nueva contraseña</label>
                  <PasswordInput value={password} onChange={setPassword} placeholder="Mínimo 8 caracteres" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#607281" }}>Repetir contraseña</label>
                  <PasswordInput value={confirm} onChange={setConfirm} placeholder="••••••••" style={inputStyle} />
                </div>
                {error && (
                  <p className="text-sm rounded-xl px-4 py-2.5" style={{ color: "#D95F45", backgroundColor: "#FDECEA", border: "1px solid rgba(217,95,69,0.15)" }}>{error}</p>
                )}
                <button type="submit" disabled={loading}
                  className="w-full text-white font-semibold py-3 rounded-xl text-sm mt-1 disabled:opacity-50"
                  style={{ backgroundColor: "#0B2F42" }}>
                  {loading ? "Guardando..." : "Guardar contraseña"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
