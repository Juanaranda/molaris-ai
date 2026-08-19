"use client";

import type { Analytics } from "../types";
import {
  DOW_LABELS, IntentBadge, MONTH_LABELS, MiniBar, ScoreBadge, StatCard,
  UrgencyDot, fmtCLP,
} from "../widgets";

/** Cuándo se llena la agenda y cuánto se cancela. */
export function AnaliticaOperaciones({ analytics }: { analytics: Analytics }) {
  return (
    <div className="flex flex-col gap-4">
      {/* KPIs operacionales */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Tasa cancelación</p>
          <p className={`text-3xl font-black leading-none ${
            (analytics.operations?.cancellationRate ?? 0) <= 10 ? "text-green-600" :
            (analytics.operations?.cancellationRate ?? 0) <= 25 ? "text-yellow-500" : "text-red-600"
          }`}>{analytics.operations?.cancellationRate ?? 0}%</p>
          <p className="text-xs text-gray-400 mt-1">De todas las citas creadas</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Ticket promedio</p>
          <p className="text-3xl font-black text-blue-600 leading-none">
            {analytics.operations?.avgTicket ? fmtCLP(analytics.operations.avgTicket) : "—"}
          </p>
          <p className="text-xs text-gray-400 mt-1">{analytics.operations?.paidBookings ?? 0} citas con pago registrado</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Total citas</p>
          <p className="text-3xl font-black text-gray-800 leading-none">{analytics.totals.bookings}</p>
          <p className="text-xs text-gray-400 mt-1">Sin contar canceladas</p>
        </div>
      </div>

      {/* Citas por día de semana */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">Citas por día de semana</p>
        {!analytics.operations?.bookingsByDow?.length ? (
          <p className="text-sm text-gray-400">Sin datos suficientes</p>
        ) : (
          <div className="flex items-end gap-2 h-24">
            {[0,1,2,3,4,5,6].map((dow) => {
              const entry = analytics.operations!.bookingsByDow.find((d) => d.dow === dow);
              const count = entry?.count ?? 0;
              const max = Math.max(...analytics.operations!.bookingsByDow.map((d) => d.count), 1);
              const pct = Math.round((count / max) * 100);
              const isWorkDay = dow >= 1 && dow <= 5;
              return (
                <div key={dow} className="flex-1 flex flex-col items-center gap-1 group">
                  <span className="text-[9px] text-gray-400 opacity-0 group-hover:opacity-100 transition">{count}</span>
                  <div className={`w-full rounded-t-lg transition-all hover:opacity-80 ${isWorkDay ? "bg-blue-500" : "bg-blue-200"}`}
                    style={{ height: `${Math.max(pct, 4)}%`, minHeight: 4 }} />
                  <span className={`text-[10px] font-medium ${isWorkDay ? "text-gray-500" : "text-gray-300"}`}>{DOW_LABELS[dow]}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Citas por hora */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">Demanda horaria</p>
        {!analytics.operations?.bookingsByHour?.length ? (
          <p className="text-sm text-gray-400">Sin datos suficientes</p>
        ) : (
          <div className="flex items-end gap-1 h-20">
            {Array.from({ length: 11 }, (_, i) => i + 9).map((hour) => {
              const entry = analytics.operations!.bookingsByHour.find((h) => h.hour === hour);
              const count = entry?.count ?? 0;
              const max = Math.max(...analytics.operations!.bookingsByHour.map((h) => h.count), 1);
              const pct = Math.round((count / max) * 100);
              return (
                <div key={hour} className="flex-1 flex flex-col items-center gap-1 group">
                  <div className="w-full rounded-t bg-indigo-400 hover:bg-indigo-500 transition-all"
                    style={{ height: `${Math.max(pct, 4)}%`, minHeight: 4 }} />
                  <span className="text-[9px] text-gray-400">{hour}h</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
