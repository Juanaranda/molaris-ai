"use client";

import type { Analytics } from "../types";
import { MiniBar, fmtCLP } from "../widgets";

/** Rendimiento por profesional: citas, cancelaciones e ingresos. */
export function AnaliticaDoctores({ analytics }: { analytics: Analytics }) {
  return (
    <div className="flex flex-col gap-4">
      {!analytics.doctors?.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center text-sm text-gray-400">Sin citas registradas aún</div>
      ) : (
        <>
          {/* Tabla de doctores */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50">
              <h2 className="font-semibold text-gray-900">Rendimiento por profesional</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-100 bg-gray-50/50">
                  {["Profesional","Citas activas","Canceladas","Tasa cancel.","Ingresos"].map((h) => (
                    <th key={h} className="text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 px-5 py-3">{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {analytics.doctors.map((d) => {
                    const maxCitas = Math.max(...analytics.doctors!.map((x) => x.bookings), 1);
                    return (
                      <tr key={d.doctor} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3.5 font-semibold text-gray-800">{d.doctor}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-800 w-8 shrink-0">{d.bookings}</span>
                            <MiniBar value={d.bookings} max={maxCitas} color="#3B82F6" />
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-gray-500">{d.cancelled}</td>
                        <td className="px-5 py-3.5">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            d.cancellationRate <= 10 ? "bg-green-50 text-green-700" :
                            d.cancellationRate <= 25 ? "bg-yellow-50 text-yellow-700" : "bg-red-50 text-red-700"
                          }`}>{d.cancellationRate}%</span>
                        </td>
                        <td className="px-5 py-3.5 font-semibold text-emerald-700">
                          {d.income > 0 ? fmtCLP(d.income) : <span className="text-gray-300">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bar chart citas por doctor */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">Citas por profesional</p>
            <div className="flex flex-col gap-3">
              {analytics.doctors.map((d) => {
                const max = Math.max(...analytics.doctors!.map((x) => x.bookings), 1);
                const name = d.doctor.replace(/Dra?\. /, "");
                return (
                  <div key={d.doctor} className="flex items-center gap-3 text-sm">
                    <span className="w-32 shrink-0 text-gray-600 truncate text-xs">{name}</span>
                    <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500 flex items-center pl-2 transition-all"
                        style={{ width: `${Math.round((d.bookings / max) * 100)}%` }}>
                        {d.bookings > 0 && <span className="text-[10px] text-white font-bold">{d.bookings}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
