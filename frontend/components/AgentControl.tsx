"use client";

import { useCallback, useEffect, useState } from "react";
import { AgentStatus, getAgentStatus, setAgentEnabled } from "@/lib/agent";

export function AgentControl({ clinicId }: { clinicId: string }) {
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setStatus(await getAgentStatus(clinicId)); }
    catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally   { setLoading(false); }
  }, [clinicId]);

  useEffect(() => { load(); }, [load]);

  async function toggle() {
    if (!status) return;
    const turningOff = status.agentEnabled;
    let reason: string | undefined;
    if (turningOff) {
      const r = window.prompt("¿Por qué apagas el agente? (opcional — ej: 'precios desactualizados')");
      if (r === null) return; // canceló
      reason = r.trim() || undefined;
    }
    setSaving(true); setError("");
    try { setStatus(await setAgentEnabled(clinicId, !status.agentEnabled, reason)); }
    catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally   { setSaving(false); }
  }

  if (loading) return <div className="text-sm text-gray-400 py-4">Cargando estado del agente…</div>;
  if (!status) return null;

  const on = status.agentEnabled;

  return (
    <div className={`rounded-2xl border p-5 ${on ? "border-emerald-200 bg-emerald-50/40" : "border-red-200 bg-red-50/50"}`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 inline-flex w-2.5 h-2.5 rounded-full ${on ? "bg-emerald-500" : "bg-red-500"} ${on ? "animate-pulse" : ""}`} />
          <div>
            <h3 className="text-sm font-bold text-gray-900">
              Asistente IA {on ? "encendido" : "apagado"}
            </h3>
            <p className="text-[12px] text-gray-500 mt-0.5 max-w-md">
              {on
                ? "El asistente responde y agenda solo en WhatsApp y tu web. Si algo falla, apágalo y atenderá tu equipo."
                : "El asistente NO está respondiendo. Los mensajes que lleguen los verá tu equipo y se responde una persona."}
            </p>
            {!on && status.agentDisabledReason && (
              <p className="text-[11px] text-red-600 mt-1.5">Motivo: {status.agentDisabledReason}</p>
            )}
          </div>
        </div>
        <button onClick={toggle} disabled={saving}
          className={`text-xs font-bold px-4 py-2 rounded-xl transition disabled:opacity-50 shrink-0 ${
            on
              ? "bg-red-600 text-white hover:bg-red-700"
              : "bg-emerald-600 text-white hover:bg-emerald-700"
          }`}>
          {saving ? "…" : on ? "Apagar agente" : "Encender agente"}
        </button>
      </div>
      {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
    </div>
  );
}
