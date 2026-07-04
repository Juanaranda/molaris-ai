"use client";
import { useEffect, useState } from "react";
import { api, AdminOverview, ClinicRow, ClinicUsage } from "@/lib/api";

const fmtUsd = (n: number) => `$${n.toFixed(4)}`;

function ClinicDetail({ clinic }: { clinic: ClinicRow }) {
  const [usage, setUsage] = useState<ClinicUsage | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open && !usage) api.clinicUsage(clinic.id).then(setUsage);
  }, [open, clinic.id, usage]);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition">
        <div className="flex items-center gap-3 text-sm">
          <span className={`w-2 h-2 rounded-full ${clinic.active ? "bg-emerald-400" : "bg-gray-300"}`} />
          <span className="font-medium text-gray-800">{clinic.name}</span>
          <span className="text-gray-400 text-xs">/{clinic.slug}</span>
          {clinic.plan && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{clinic.plan}</span>}
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span>{clinic._count.sessions} sesiones</span>
          <span>{clinic._count.bookings} citas</span>
          <span className="font-mono">{fmtUsd(clinic.usage30d.costUsd)} / 30d</span>
          <span className="text-gray-300">{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-4 py-4 bg-gray-50">
          {!usage ? (
            <p className="text-xs text-gray-400 animate-pulse">Cargando uso...</p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-3">
                {usage.byModel.map((m, i) => (
                  <div key={i} className="bg-white rounded-lg border border-gray-200 p-3">
                    <p className="text-[10px] text-gray-400 font-mono truncate">{m.model}</p>
                    <p className="text-sm font-bold text-gray-800 mt-1">{m.calls} llamados</p>
                    <p className="text-xs text-gray-400">{fmtUsd(m.costUsd)}</p>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium mb-2">Últimas 10 llamadas</p>
                <div className="space-y-1">
                  {usage.recent.slice(0, 10).map((r) => (
                    <div key={r.id} className="flex items-center gap-3 text-xs text-gray-600">
                      <span className="font-mono text-gray-400">{new Date(r.createdAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}</span>
                      <span className="font-mono">{r.model.split("/").pop()}</span>
                      <span className="text-gray-400">{(r.tokensIn + r.tokensOut).toLocaleString()} tok</span>
                      <span className="text-gray-400">{r.latencyMs}ms</span>
                      <span className="font-mono text-gray-500">{fmtUsd(r.costUsd)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ClinicsPage() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.overview().then(setData).finally(() => setLoading(false)); }, []);

  if (loading) return <p className="text-sm text-gray-400 animate-pulse">Cargando...</p>;
  if (!data)   return null;

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <h1 className="text-lg font-bold text-gray-900">Clínicas ({data.clinics.length})</h1>
      {data.clinics.map((c) => <ClinicDetail key={c.id} clinic={c} />)}
    </div>
  );
}
