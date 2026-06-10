"use client";
import { useEffect, useState } from "react";
import { api, ErrorStats } from "@/lib/api";

const ERROR_COLOR: Record<string, string> = {
  timeout:        "bg-orange-50 text-orange-700",
  rate_limit:     "bg-yellow-50 text-yellow-700",
  content_filter: "bg-purple-50 text-purple-700",
  model_error:    "bg-red-50 text-red-700",
  parse_error:    "bg-blue-50 text-blue-700",
  unknown:        "bg-gray-100 text-gray-500",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function ErrorsPage() {
  const [data, setData] = useState<ErrorStats | null>(null);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.errors(days).then(setData).finally(() => setLoading(false));
  }, [days]);

  if (loading) return <p className="text-sm text-gray-400 animate-pulse">Cargando...</p>;
  if (!data)   return null;

  const totalErrors = data.byType.reduce((s, e) => s + e.count, 0);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Registro de errores</h1>
          <p className="text-sm text-gray-400">{totalErrors} fallos en los últimos {days} días</p>
        </div>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5">
          {[1,3,7,14,30].map((d) => <option key={d} value={d}>{d} días</option>)}
        </select>
      </div>

      {/* Resumen por tipo */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {data.byType.map((e) => (
          <div key={e.type} className="bg-white rounded-xl border border-gray-200 p-3 text-center">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ERROR_COLOR[e.type] ?? ERROR_COLOR.unknown}`}>{e.type}</span>
            <p className="text-xl font-bold text-gray-900 mt-2">{e.count}</p>
          </div>
        ))}
      </div>

      {/* Tasa de error por día */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Tasa de error por día</p>
        <table className="w-full text-xs">
          <thead><tr className="text-gray-400 border-b border-gray-100">
            {["Día","Total calls","Fallos","Tasa de error"].map((h) => <th key={h} className="text-left pb-2 font-medium">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-50">
            {data.errorRate.map((r) => (
              <tr key={r.day} className="hover:bg-gray-50">
                <td className="py-1.5 text-gray-500">{r.day}</td>
                <td className="py-1.5 text-gray-700">{r.total.toLocaleString()}</td>
                <td className="py-1.5 text-red-500 font-medium">{r.failures}</td>
                <td className="py-1.5">
                  <span className={`font-bold ${r.rate > 5 ? "text-red-600" : r.rate > 1 ? "text-amber-500" : "text-emerald-600"}`}>
                    {r.rate}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Log de errores recientes */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Log de errores recientes</p>
        {data.errors.length === 0 ? (
          <p className="text-sm text-emerald-600 font-medium">Sin errores en este período</p>
        ) : (
          <div className="space-y-2">
            {data.errors.map((e) => (
              <div key={e.id} className="flex items-start gap-3 text-xs border-b border-gray-50 pb-2">
                <span className={`shrink-0 font-bold px-2 py-0.5 rounded-full ${ERROR_COLOR[e.errorType ?? "unknown"] ?? ERROR_COLOR.unknown}`}>
                  {e.errorType ?? "unknown"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-gray-700">{e.clinic.name}</span>
                    <span className="text-gray-400">·</span>
                    <span className="font-mono text-gray-500">{e.model}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${ERROR_COLOR[e.tier] ?? "bg-gray-100 text-gray-400"}`}>{e.tier}</span>
                    {e.latencyMs && <span className="text-gray-400">{e.latencyMs}ms</span>}
                  </div>
                  <p className="text-gray-400 truncate">{e.errorMessage ?? "Sin mensaje"}</p>
                </div>
                <span className="shrink-0 text-gray-300">{fmtDate(e.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
