"use client";

import type { Analytics } from "../types";
import { MiniBar, fmtCLP } from "../widgets";

/** Qué prestaciones se piden más y cuánto dejan. */
export function AnaliticaServicios({ analytics }: { analytics: Analytics }) {
  return (
    <div className="flex flex-col gap-4">
      {!analytics.services?.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center text-sm text-gray-400">
          Sin datos de servicios. Asegúrate de registrar el servicio al crear las citas.
        </div>
      ) : (
        <>
          {/* Tabla de servicios */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50">
              <h2 className="font-semibold text-gray-900">Ingresos y demanda por servicio</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-100 bg-gray-50/50">
                  {["Servicio","Citas","Ingresos","% del total"].map((h) => (
                    <th key={h} className="text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 px-5 py-3">{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {analytics.services.map((s) => {
                    const totalIncome = analytics.services!.reduce((a, b) => a + b.income, 0) || 1;
                    const maxCitas    = analytics.services![0]?.count ?? 1;
                    return (
                      <tr key={s.service} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3.5 font-medium text-gray-800">{s.service}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-700 w-6 shrink-0">{s.count}</span>
                            <MiniBar value={s.count} max={maxCitas} color="#60A5FA" />
                          </div>
                        </td>
                        <td className="px-5 py-3.5 font-semibold text-emerald-700">
                          {s.income > 0 ? fmtCLP(s.income) : <span className="text-gray-300 font-normal">—</span>}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-xs text-gray-500">{Math.round((s.income / totalIncome) * 100)}%</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Desglose de pagos */}
          {analytics.payments && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">Estado de pagos (todas las citas)</p>
              <div className="flex flex-col gap-2">
                {[
                  { key: "paid",    label: "Pagado",     color: "#10B981" },
                  { key: "partial", label: "Parcial",    color: "#F59E0B" },
                  { key: "pending", label: "Pendiente",  color: "#9CA3AF" },
                  { key: "waived",  label: "Bonificado", color: "#8B5CF6" },
                ].map(({ key, label, color }) => {
                  const entry = analytics.payments!.byStatus.find((s) => s.status === key);
                  if (!entry) return null;
                  const total = analytics.payments!.byStatus.reduce((a, b) => a + b.count, 0) || 1;
                  return (
                    <div key={key} className="flex items-center gap-3 text-sm">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                      <span className="text-gray-500 w-24 shrink-0">{label}</span>
                      <MiniBar value={entry.count} max={total} color={color} />
                      <span className="font-bold text-gray-700 w-8 text-right shrink-0">{entry.count}</span>
                      <span className="text-xs text-gray-400 w-16 text-right shrink-0">{entry.totalPaid > 0 ? fmtCLP(entry.totalPaid) : ""}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
