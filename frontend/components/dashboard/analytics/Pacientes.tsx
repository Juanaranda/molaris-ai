"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { getToken, type ClinicData } from "@/lib/auth";
import type { Analytics } from "../types";
import {
  DOW_LABELS, IntentBadge, MONTH_LABELS, MiniBar, ScoreBadge, StatCard,
  UrgencyDot, fmtCLP,
} from "../widgets";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/** Cuántos vuelven y cuántos son nuevos. */
export function AnaliticaPacientes({ analytics, clinic }: { analytics: Analytics; clinic: ClinicData }) {
  // El disparo manual de la campaña de recall vive acá y no en el panel: es la
  // única sección que lo usa, y tenerlo arriba obligaba a bajarlo por props.
  const [recallDays, setRecallDays]       = useState(90);
  const [recallSending, setRecallSending] = useState(false);
  const [recallResult, setRecallResult]   = useState<{ sent: number; total: number } | null>(null);

  async function sendRecall() {
    setRecallSending(true);
    setRecallResult(null);
    const res = await fetch(`${API}/api/clinics/${clinic.id}/recall/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ daysInactive: recallDays }),
    });
    if (res.ok) setRecallResult(await res.json());
    setRecallSending(false);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* KPIs pacientes */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total pacientes",    val: analytics.patients?.total ?? 0,         color: "text-blue-700",   bg: "bg-blue-50 border-blue-100" },
          { label: "Nuevos este mes",    val: analytics.patients?.newThisMonth ?? 0,   color: "text-emerald-700",bg: "bg-emerald-50 border-emerald-100" },
          { label: "Pacientes recurrentes", val: analytics.patients?.returning ?? 0,   color: "text-purple-700", bg: "bg-purple-50 border-purple-100" },
          { label: "Tasa retención",     val: `${analytics.patients?.retentionRate ?? 0}%`, color: "text-amber-700",  bg: "bg-amber-50 border-amber-100" },
        ].map(({ label, val, color, bg }) => (
          <div key={label} className={`rounded-2xl p-5 border ${bg}`}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">{label}</p>
            <p className={`text-3xl font-black leading-none ${color}`}>{val}</p>
          </div>
        ))}
      </div>

      {/* Visualización retención */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Retención de pacientes</h2>
        <div className="flex flex-col gap-4">
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-gray-600">Pacientes con 2+ visitas</span>
              <span className="font-bold text-gray-800">{analytics.patients?.retentionRate ?? 0}%</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-purple-500 rounded-full transition-all"
                style={{ width: `${analytics.patients?.retentionRate ?? 0}%` }} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="text-center p-4 bg-blue-50 rounded-2xl border border-blue-100">
              <p className="text-2xl font-black text-blue-700">{analytics.patients?.total ?? 0}</p>
              <p className="text-xs text-blue-600 mt-1">Total únicos</p>
            </div>
            <div className="text-center p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
              <p className="text-2xl font-black text-emerald-700">{analytics.patients?.newThisMonth ?? 0}</p>
              <p className="text-xs text-emerald-600 mt-1">Nuevos este mes</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-2xl border border-purple-100">
              <p className="text-2xl font-black text-purple-700">{analytics.patients?.returning ?? 0}</p>
              <p className="text-xs text-purple-600 mt-1">Han vuelto</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recall campaign */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 p-5">
        <div className="flex items-start justify-between mb-3 gap-3">
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">Reactivar pacientes inactivos</h3>
            <p className="text-xs text-gray-500 mt-0.5">Envía un WhatsApp personalizado a pacientes que no han venido en:</p>
          </div>
          {recallResult && (
            <div className="shrink-0 text-xs text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl whitespace-nowrap">
              {recallResult.sent} / {recallResult.total} enviados
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select value={recallDays} onChange={(e) => { setRecallDays(Number(e.target.value)); setRecallResult(null); }}
            className="text-sm px-3 py-2 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
            <option value={30}>30 días sin visitar</option>
            <option value={60}>60 días sin visitar</option>
            <option value={90}>90 días sin visitar</option>
            <option value={180}>6 meses sin visitar</option>
          </select>
          <button onClick={sendRecall} disabled={recallSending || !clinic.whatsapp}
            className="text-sm font-bold px-4 py-2 rounded-xl bg-[#1A5C7A] text-white hover:bg-[#0e4560] transition disabled:opacity-50">
            {recallSending ? "Enviando…" : "Enviar campaña"}
          </button>
          {!clinic.whatsapp && (
            <p className="text-xs text-amber-600"><TriangleAlert className="w-4 h-4 inline-block align-[-3px]" aria-hidden /> Requiere WhatsApp configurado</p>
          )}
        </div>
      </div>
    </div>
  );
}
