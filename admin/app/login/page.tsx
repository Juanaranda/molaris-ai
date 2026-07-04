"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, saveToken } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("superadmin@molari.ai");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const { token, user } = await api.login(email, password);
      if (user.role !== "SUPERADMIN") { setError("Acceso restringido a SUPERADMIN"); return; }
      saveToken(token);
      router.push("/dashboard");
    } catch {
      setError("Credenciales incorrectas");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-sm">
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">molari.ai</p>
          <h1 className="text-xl font-bold text-gray-900">Panel de operaciones</h1>
          <p className="text-sm text-gray-400 mt-1">Solo acceso SUPERADMIN</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <input value={email} onChange={(e) => setEmail(e.target.value)}
            type="email" placeholder="Email" required
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input value={password} onChange={(e) => setPassword(e.target.value)}
            type="password" placeholder="Contraseña" required
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-gray-900 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 transition">
            {loading ? "Ingresando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
