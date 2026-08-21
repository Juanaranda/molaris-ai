"use client";

import { useState } from "react";
import Link from "next/link";
import type { Analytics } from "../types";
import {
  DOW_LABELS, IntentBadge, MONTH_LABELS, MiniBar, ScoreBadge, StatCard,
  UrgencyDot, fmtCLP,
} from "../widgets";

/** Los números que mira el dueño primero: conversión, ingresos y leads recientes. */
export function AnaliticaResumen({ analytics }: { analytics: Analytics }) {
  // Filtro de la tabla de leads recientes; nace y muere en esta sección.
  const [urgencyFilter, setUrgencyFilter] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">

      {/* ── 1. KPIs clínica ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-1">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Citas este mes</p>
          <p className="text-3xl font-black leading-none text-gray-900">
            {analytics.payments?.thisMonth.count ?? analytics.totals.bookings}
          </p>
          {analytics.payments && analytics.payments.lastMonth.count > 0 && (() => {
            const diff = analytics.payments.thisMonth.count - analytics.payments.lastMonth.count;
            return <p className={`text-xs mt-1 ${diff >= 0 ? "text-emerald-600" : "text-red-500"}`}>{diff >= 0 ? "+" : ""}{diff} vs mes anterior</p>;
          })()}
        </div>
        <div className="bg-emerald-50 rounded-2xl border border-emerald-100 shadow-sm p-5 flex flex-col gap-1">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Ingresos este mes</p>
          <p className="text-3xl font-black leading-none text-emerald-700">
            {analytics.payments ? fmtCLP(analytics.payments.thisMonth.income) : "—"}
          </p>
          {analytics.payments && analytics.payments.lastMonth.income > 0 && (() => {
            const diff = analytics.payments.thisMonth.income - analytics.payments.lastMonth.income;
            return <p className={`text-xs mt-1 ${diff >= 0 ? "text-emerald-600" : "text-red-500"}`}>{diff >= 0 ? "+" : ""}{fmtCLP(Math.abs(diff))} vs mes anterior</p>;
          })()}
        </div>
        <div className="bg-blue-50 rounded-2xl border border-blue-100 shadow-sm p-5 flex flex-col gap-1">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Ticket promedio</p>
          <p className="text-3xl font-black leading-none text-blue-700">
            {analytics.operations?.avgTicket ? fmtCLP(analytics.operations.avgTicket) : "—"}
          </p>
        </div>
        <div className="bg-purple-50 rounded-2xl border border-purple-100 shadow-sm p-5 flex flex-col gap-1">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Pacientes únicos</p>
          <p className="text-3xl font-black leading-none text-purple-700">
            {analytics.patients?.total ?? "—"}
          </p>
          {analytics.patients?.newThisMonth != null && (
            <p className="text-xs text-purple-500 mt-1">+{analytics.patients.newThisMonth} nuevos este mes</p>
          )}
        </div>
      </div>

      {/* ── 2. Ingresos + servicios ── */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
        {analytics.payments && analytics.payments.incomeByMonth.length > 0 && (
          <div className="sm:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">Ingresos últimos 6 meses</p>
            <div className="flex items-end gap-2 h-24">
              {analytics.payments.incomeByMonth.map((r) => {
                const max = Math.max(...analytics.payments!.incomeByMonth.map((x) => x.income), 1);
                const pct = Math.round((r.income / max) * 100);
                const [, mm] = r.month.split("-");
                return (
                  <div key={r.month} className="flex-1 flex flex-col items-center gap-1 group">
                    <span className="text-[9px] text-gray-400 opacity-0 group-hover:opacity-100 transition whitespace-nowrap">{fmtCLP(r.income)}</span>
                    <div className="w-full rounded-t-lg bg-emerald-500 hover:bg-emerald-400 transition-all" style={{ height: `${Math.max(pct, 4)}%`, minHeight: 4 }} />
                    <span className="text-[10px] text-gray-400">{MONTH_LABELS[mm] ?? mm}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div className={`${analytics.payments?.incomeByMonth.length ? "sm:col-span-2" : "sm:col-span-5"} bg-white rounded-2xl border border-gray-100 shadow-sm p-5`}>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Servicios más demandados</p>
          {analytics.topServices.length === 0 ? (
            <p className="text-sm text-gray-400">Sin datos aún</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {analytics.topServices.slice(0, 5).map((s) => (
                <div key={s.name} className="flex flex-col gap-0.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-700 truncate max-w-[160px]">{s.name}</span>
                    <span className="text-gray-400 shrink-0 ml-1">{s.count}</span>
                  </div>
                  <MiniBar value={s.count} max={analytics.topServices[0]?.count ?? 1} color="#818CF8" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── 3. Asistente IA ── */}
      <div className="flex items-center gap-3 pt-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-300">Asistente IA · captación</span>
        <div className="flex-1 h-px bg-gray-100" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Conversaciones" value={analytics.totals.sessions} />
        <StatCard label="Leads captados" value={analytics.totals.leads}
          sub={analytics.totals.sessions > 0 ? `${Math.round(analytics.totals.leads / analytics.totals.sessions * 100)}% del total` : undefined} />
        <StatCard label="Score IA promedio" value={`${analytics.totals.avgScore}/100`}
          sub={analytics.totals.avgScore >= 70 ? "Rendimiento alto" : analytics.totals.avgScore >= 40 ? "Rendimiento medio" : "Bajo"} />
        <StatCard label="Conversión a cita" value={`${analytics.bookingRate}%`}
          sub={`${analytics.totals.bookings} citas generadas`} accent />
      </div>

      {/* Urgencia + leads recientes */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="font-semibold text-gray-900 text-sm">Leads recientes</h2>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button onClick={() => setUrgencyFilter(null)}
              className={`text-[11px] px-2.5 py-1 rounded-full transition font-semibold ${!urgencyFilter ? "bg-gray-900 text-white" : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"}`}>
              Todos
            </button>
            {([["high","Alta","#EF4444"],["medium","Media","#F59E0B"],["low","Baja","#9CA3AF"]] as const).map(([key, label, color]) => {
              const count = analytics.urgencyBreakdown.find((u) => u.urgency === key)?.count ?? 0;
              const active = urgencyFilter === key;
              return (
                <button key={key} onClick={() => setUrgencyFilter(active ? null : key)}
                  className={`flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full transition font-semibold border ${
                    active ? "text-white border-transparent" : "text-gray-500 border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                  style={active ? { background: color, borderColor: color } : {}}>
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: active ? "rgba(255,255,255,0.8)" : color }} />
                  {label} · {count}
                </button>
              );
            })}
          </div>
        </div>
        {analytics.recentLeads.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-gray-400">Sin conversaciones aún.</p>
            <Link href="/partners/preview" className="text-sm text-blue-600 mt-2 inline-block hover:underline">Probar asistente</Link>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm min-w-[540px]">
                <thead><tr className="border-b border-gray-100">
                  {["Paciente","Servicio","Score","Intención","Urg.","Canal","Fecha"].map((h) => (
                    <th key={h} className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider pb-3 px-2">{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {(urgencyFilter ? analytics.recentLeads.filter((l) => l.urgency === urgencyFilter) : analytics.recentLeads).map((lead) => (
                    <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 px-2 font-medium text-gray-800">
                        {lead.patientName ?? <span className="text-gray-300 font-normal">Anónimo</span>}
                        {lead.slotBooked && <span className="ml-1.5 text-[10px] bg-green-50 text-green-700 border border-green-100 px-1.5 py-0.5 rounded-full">agendado</span>}
                      </td>
                      <td className="py-2.5 px-2 text-gray-600 max-w-[140px] truncate">{lead.serviceInterest ?? "—"}</td>
                      <td className="py-2.5 px-2"><ScoreBadge score={lead.score} /></td>
                      <td className="py-2.5 px-2"><IntentBadge intent={lead.intent} /></td>
                      <td className="py-2.5 px-2"><UrgencyDot urgency={lead.urgency} /></td>
                      <td className="py-2.5 px-2 text-gray-400 capitalize text-xs">{lead.channel}</td>
                      <td className="py-2.5 px-2 text-gray-400 text-xs whitespace-nowrap">
                        {new Date(lead.createdAt).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {urgencyFilter && (
              <p className="text-[11px] text-gray-400 text-center pt-3">
                {analytics.recentLeads.filter((l) => l.urgency === urgencyFilter).length} de {analytics.recentLeads.length} leads · <button onClick={() => setUrgencyFilter(null)} className="text-blue-500 hover:underline">Ver todos</button>
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
