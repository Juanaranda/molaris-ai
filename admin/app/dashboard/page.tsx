"use client";
import { useEffect, useState } from "react";
import { api, AdminOverview } from "@/lib/api";

const fmt = (n: number) => n.toLocaleString("es-CL");
const fmtUsd = (n: number) => `$${n.toFixed(4)}`;
const fmtMs = (n: number) => `${n}ms`;

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.overview().then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-gray-400 animate-pulse">Cargando...</p>;
  if (error)   return <p className="text-sm text-red-500">{error}</p>;
  if (!data)   return null;

  const { totals, clinics, modelBreakdown, dailyCost } = data;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <h1 className="text-lg font-bold text-gray-900">Resumen global</h1>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Clínicas"      value={fmt(totals.clinics)} />
        <Stat label="Conversaciones" value={fmt(totals.sessions)} />
        <Stat label="Leads"          value={fmt(totals.leads)} />
        <Stat label="Citas"          value={fmt(totals.bookings)} />
        <Stat label="Llamados AI"    value={fmt(totals.calls)} />
        <Stat label="Tokens total"   value={fmt(totals.tokensIn + totals.tokensOut)} sub={`${fmt(totals.tokensIn)} in · ${fmt(totals.tokensOut)} out`} />
        <Stat label="Costo total"    value={fmtUsd(totals.costUsd)} />
        <Stat label="Latencia prom." value={fmtMs(totals.avgLatencyMs)} />
      </div>

      {/* Costo diario */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Costo diario (14 días)</p>
        <div className="flex items-end gap-1 h-24">
          {dailyCost.map((d) => {
            const max = Math.max(...dailyCost.map((x) => x.cost), 0.0001);
            const pct = Math.round((d.cost / max) * 100);
            return (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-1 group relative">
                <div className="w-full bg-blue-500 rounded-t" style={{ height: `${pct}%`, minHeight: 2 }} />
                <span className="text-[9px] text-gray-300 hidden group-hover:block absolute -top-5 bg-gray-800 text-white px-1 py-0.5 rounded whitespace-nowrap">
                  {d.day.slice(5)} · ${d.cost.toFixed(4)} · {d.calls} calls
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modelos */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Uso por modelo</p>
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-gray-400 border-b border-gray-100">
            {["Modelo","Tier","Llamados","Tokens in","Tokens out","Costo USD"].map((h) => (
              <th key={h} className="text-left pb-2 font-medium">{h}</th>
            ))}
          </tr></thead>
          <tbody className="divide-y divide-gray-50">
            {modelBreakdown.map((m, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="py-2 font-mono text-xs text-gray-700">{m.model}</td>
                <td className="py-2"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{m.tier}</span></td>
                <td className="py-2 text-gray-600">{fmt(m.calls)}</td>
                <td className="py-2 text-gray-600">{fmt(m.tokensIn)}</td>
                <td className="py-2 text-gray-600">{fmt(m.tokensOut)}</td>
                <td className="py-2 font-mono text-gray-700">{fmtUsd(m.costUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Clínicas */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Clínicas</p>
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-gray-400 border-b border-gray-100">
            {["Clínica","Plan","Estado","Sesiones","Bookings","Llamados 30d","Costo 30d"].map((h) => (
              <th key={h} className="text-left pb-2 font-medium">{h}</th>
            ))}
          </tr></thead>
          <tbody className="divide-y divide-gray-50">
            {clinics.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="py-2 font-medium text-gray-800">{c.name}</td>
                <td className="py-2 text-gray-500 text-xs">{c.plan ?? "—"}</td>
                <td className="py-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-400"}`}>
                    {c.active ? "Activa" : "Inactiva"}
                  </span>
                </td>
                <td className="py-2 text-gray-600">{fmt(c._count.sessions)}</td>
                <td className="py-2 text-gray-600">{fmt(c._count.bookings)}</td>
                <td className="py-2 text-gray-600">{fmt(c.usage30d.calls)}</td>
                <td className="py-2 font-mono text-gray-700">{fmtUsd(c.usage30d.costUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
