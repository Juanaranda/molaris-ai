"use client";
import { useEffect, useState } from "react";
import { api, ModelStats } from "@/lib/api";

const fmt = (n: number) => n.toLocaleString("es-CL");

const TIER_COLOR: Record<string, string> = {
  fast:     "bg-emerald-50 text-emerald-700",
  balanced: "bg-blue-50 text-blue-700",
  smart:    "bg-purple-50 text-purple-700",
  unknown:  "bg-gray-100 text-gray-400",
};

export default function ModelsPage() {
  const [data, setData] = useState<ModelStats | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.models(days).then(setData).finally(() => setLoading(false));
  }, [days]);

  if (loading) return <p className="text-sm text-gray-400 animate-pulse">Cargando...</p>;
  if (!data)   return null;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">Analytics de modelos</h1>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5">
          {[7,14,30,60].map((d) => <option key={d} value={d}>{d} días</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Rendimiento por modelo</p>
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-gray-400 border-b border-gray-100">
            {["Modelo","Tier","Llamados","Costo USD","Avg ms","P50","P95","P99","Tokens/call"].map((h) => (
              <th key={h} className="text-left pb-2 font-medium">{h}</th>
            ))}
          </tr></thead>
          <tbody className="divide-y divide-gray-50">
            {data.byModel.map((m, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="py-2 font-mono text-xs text-gray-700 truncate max-w-[180px]">{m.model}</td>
                <td className="py-2"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${TIER_COLOR[m.tier] ?? TIER_COLOR.unknown}`}>{m.tier}</span></td>
                <td className="py-2 text-gray-600">{fmt(m.calls)}</td>
                <td className="py-2 font-mono text-gray-700">${m.costUsd.toFixed(4)}</td>
                <td className="py-2 text-gray-600">{m.avgLatencyMs}ms</td>
                <td className="py-2 text-gray-500">{m.p50Ms}ms</td>
                <td className="py-2 text-amber-600 font-medium">{m.p95Ms}ms</td>
                <td className="py-2 text-red-500 font-medium">{m.p99Ms}ms</td>
                <td className="py-2 text-gray-500">{m.calls > 0 ? fmt(Math.round((m.tokensIn + m.tokensOut) / m.calls)) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Llamados por tier por día */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Llamados por día y tier</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-gray-400 border-b border-gray-100">
              <th className="text-left pb-2">Día</th>
              {["fast","balanced","smart"].map((t) => <th key={t} className="text-right pb-2 px-3">{t}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {Object.entries(
                data.dailyByTier.reduce<Record<string, Record<string,number>>>((acc, r) => {
                  acc[r.day] ??= {};
                  acc[r.day][r.tier] = r.calls;
                  return acc;
                }, {})
              ).slice(-14).map(([day, tiers]) => (
                <tr key={day} className="hover:bg-gray-50">
                  <td className="py-1.5 text-gray-500">{day.slice(5)}</td>
                  {["fast","balanced","smart"].map((t) => (
                    <td key={t} className="py-1.5 text-right px-3 text-gray-700">{tiers[t] ? fmt(tiers[t]) : "—"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
