"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getMe, getToken, ClinicData } from "@/lib/auth";
import { ChatDemo } from "@/components/ChatDemo";

export default function PreviewPage() {
  const [clinic, setClinic] = useState<ClinicData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) { window.location.href = "/login"; return; }
    getMe()
      .then((res) => { if (res) setClinic(res.clinic ?? null); else window.location.href = "/login"; })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--surface, #F7F5F1)" }}>
        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
      </div>
    );
  }

  if (!clinic) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--surface, #F7F5F1)" }}>
        <p className="text-sm text-gray-500">Sin clínica asignada.</p>
      </div>
    );
  }

  const assistantName = (clinic.config as Record<string, string> | null)?.assistantName ?? "Asistente";

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--surface, #F7F5F1)" }}>
      <nav className="bg-white border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: "#E5E0D9" }}>
        <Link href="/partners/dashboard"
          className="text-sm font-semibold hover:opacity-70 transition-opacity"
          style={{ color: "var(--teal-dark, #0B2F42)" }}>
          ← Volver al panel
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs uppercase tracking-widest font-medium" style={{ color: "var(--ink-muted, #607281)" }}>
            Sandbox · {clinic.name}
          </span>
          {/* Indicador visual de que esto es una prueba, no la demo pública */}
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
            Modo prueba
          </span>
        </div>
      </nav>

      <div className="flex-1 max-w-xl mx-auto w-full px-4 py-10 flex flex-col gap-6">
        <div className="rounded-2xl p-5 border text-sm flex flex-col gap-1"
          style={{ backgroundColor: "#FFF8EC", borderColor: "#F5DFA8", color: "#7A4F00" }}>
          <p className="font-semibold text-base">Estás probando tu asistente</p>
          <p>
            Este es <strong>{assistantName}</strong>, el asistente configurado para <strong>{clinic.name}</strong>.
            Cada cambio que hagas en Configuración se reflejará aquí.
            Esta vista no es visible para tus pacientes.
          </p>
        </div>

        {/* isDemoMode=false → usa el asistente real de la clínica */}
        <ChatDemo clinicSlug={clinic.slug} clinicName={clinic.name} isDemoMode={false} />
      </div>
    </div>
  );
}
