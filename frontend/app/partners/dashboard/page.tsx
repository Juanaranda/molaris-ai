"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMe, getToken, logout, updateClinic, AuthUser, ClinicData } from "@/lib/auth";
import { DoctorsEditor, DoctorRow } from "@/components/DoctorsEditor";
import { ServicesEditor, ServiceRow } from "@/components/ServicesEditor";
import { BookingsTab } from "@/components/BookingsTab";
import { SetupChecklist } from "@/components/SetupChecklist";
import { AgendaTab } from "@/components/AgendaTab";
import { PatientsTab } from "@/components/PatientsTab";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/* ─── Tipos ────────────────────────────────────────────────────────────────── */
interface ReminderConfig {
  enabled: boolean;
  dayBefore: boolean;
  twoHours: boolean;
  customEnabled: boolean;
  customHours: number;
}

interface SurveyConfig {
  enabled: boolean;
  hoursAfter: number;
  message: string;
}

interface RecallConfig {
  enabled: boolean;
  daysInactive: number;
  message: string;
}

interface ClinicConfig {
  tone?: string;
  assistantName?: string;
  doctors?: DoctorRow[];
  services?: ServiceRow[];
  boxes?: number;
  schedule?: { weekdays?: string; saturday?: string; sunday?: string };
  reminders?: ReminderConfig;
  recallCampaign?: RecallConfig;
  postApptSurvey?: boolean | SurveyConfig;
}

interface Analytics {
  totals: { sessions: number; leads: number; readyToBook: number; slotBooked: number; bookings: number; avgScore: number };
  conversionRate: number;
  bookingRate: number;
  intentBreakdown: { intent: string; count: number }[];
  urgencyBreakdown: { urgency: string; count: number }[];
  topServices: { name: string; count: number }[];
  recentLeads: {
    id: string; patientName: string | null; serviceInterest: string | null;
    intent: string | null; urgency: string | null; score: number | null;
    slotBooked: boolean; channel: string; createdAt: string;
  }[];
  sessionsByDay: { day: string; count: number }[];
  payments?: {
    thisMonth: { income: number; count: number };
    lastMonth: { income: number; count: number };
    byStatus: { status: string | null; count: number; totalCharged: number; totalPaid: number }[];
    incomeByMonth: { month: string; income: number; count: number }[];
  };
  doctors?: { doctor: string; bookings: number; cancelled: number; cancellationRate: number; income: number }[];
  patients?: { total: number; newThisMonth: number; returning: number; retentionRate: number };
  operations?: {
    cancellationRate: number;
    bookingsByDow: { dow: number; count: number }[];
    bookingsByHour: { hour: number; count: number }[];
    avgTicket: number;
    paidBookings: number;
  };
  services?: { service: string; count: number; income: number }[];
}

/* ─── Helpers visuales ─────────────────────────────────────────────────────── */
function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    SUPERADMIN: "bg-purple-100 text-purple-700",
    ADMIN: "bg-blue-100 text-blue-700",
    USER: "bg-gray-100 text-gray-600",
  };
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${styles[role] ?? styles.USER}`}>{role}</span>;
}

function IntentBadge({ intent }: { intent: string | null }) {
  if (!intent) return <span className="text-gray-300 text-xs">—</span>;
  const map: Record<string, { label: string; cls: string }> = {
    ready_to_book: { label: "Listo para agendar", cls: "bg-green-50 text-green-700 border border-green-100" },
    evaluating:    { label: "Evaluando",           cls: "bg-yellow-50 text-yellow-700 border border-yellow-100" },
    just_browsing: { label: "Explorando",          cls: "bg-gray-50 text-gray-500 border border-gray-100" },
  };
  const v = map[intent] ?? { label: intent, cls: "bg-gray-50 text-gray-500 border border-gray-100" };
  return <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${v.cls}`}>{v.label}</span>;
}

function UrgencyDot({ urgency }: { urgency: string | null }) {
  const colors: Record<string, string> = { high: "bg-red-500", medium: "bg-yellow-400", low: "bg-gray-300" };
  if (!urgency) return null;
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[urgency] ?? "bg-gray-300"}`} title={urgency} />;
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-gray-300 text-xs">—</span>;
  const color = score >= 70 ? "text-green-600" : score >= 40 ? "text-yellow-500" : "text-gray-400";
  return <span className={`font-black text-sm ${color}`}>{score}</span>;
}

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-1">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</p>
      <p className={`text-3xl font-black leading-none ${accent ? "text-blue-600" : "text-gray-900"}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function InfoField({ label, value, editable, onChange, placeholder }: {
  label: string; value: string; editable: boolean; onChange: (v: string) => void; placeholder?: string;
}) {
  if (!editable) return (
    <div>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm text-gray-800">{value || "—"}</p>
    </div>
  );
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">{label}</label>
      <input type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
    </div>
  );
}

type Tab = "agenda" | "analytics" | "patients" | "bookings" | "config";

/* ─── Analytics Panel ──────────────────────────────────────────────────────── */
const MONTH_LABELS: Record<string, string> = {
  "01":"Ene","02":"Feb","03":"Mar","04":"Abr","05":"May","06":"Jun",
  "07":"Jul","08":"Ago","09":"Sep","10":"Oct","11":"Nov","12":"Dic",
};
const DOW_LABELS = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
const fmtCLP = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${(n / 1_000).toFixed(0)}k`;

type AnalyticsSub = "resumen" | "doctores" | "pacientes" | "servicios" | "operaciones";

function MiniBar({ value, max, color = "#3B82F6" }: { value: number; max: number; color?: string }) {
  return (
    <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.round((value / Math.max(max, 1)) * 100)}%`, background: color }} />
    </div>
  );
}

function AnalyticsPanel({ clinic, analytics, loading, onGoToConfig, onRetry }: {
  clinic: ClinicData;
  analytics: Analytics | null;
  loading: boolean;
  onGoToConfig: () => void;
  onRetry: () => void;
}) {
  const [sub, setSub] = useState<AnalyticsSub>("resumen");

  return (
    <div className="flex flex-col gap-5">
      <SetupChecklist clinic={clinic} onGoToConfig={onGoToConfig} />

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && !analytics && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center text-sm text-gray-400">
          No se pudieron cargar los datos.{" "}
          <button onClick={onRetry} className="text-blue-600 hover:underline">Reintentar</button>
        </div>
      )}

      {!loading && analytics && (
        <>
          {/* Sub-tabs */}
          <div className="flex gap-1 overflow-x-auto">
            {([
              ["resumen",     "Resumen"],
              ["doctores",    "Doctores"],
              ["pacientes",   "Pacientes"],
              ["servicios",   "Servicios"],
              ["operaciones", "Operaciones"],
            ] as [AnalyticsSub, string][]).map(([key, label]) => (
              <button key={key} onClick={() => setSub(key)}
                className={`px-4 py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition ${
                  sub === key ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-500 hover:border-gray-300"
                }`}>
                {label}
              </button>
            ))}
          </div>

          {/* ── RESUMEN ──────────────────────────────────── */}
          {sub === "resumen" && (
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
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-gray-900 text-sm">Leads recientes</h2>
                  <div className="flex items-center gap-4">
                    {[["high","Alta","#EF4444"],["medium","Media","#FBBF24"],["low","Baja","#9CA3AF"]].map(([key, label, color]) => {
                      const count = analytics.urgencyBreakdown.find((u) => u.urgency === key)?.count ?? 0;
                      return (
                        <span key={key} className="flex items-center gap-1 text-xs text-gray-500">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                          {label} <span className="font-bold text-gray-700">{count}</span>
                        </span>
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
                  <div className="overflow-x-auto -mx-2">
                    <table className="w-full text-sm min-w-[540px]">
                      <thead><tr className="border-b border-gray-100">
                        {["Paciente","Servicio","Score","Intención","Urg.","Canal","Fecha"].map((h) => (
                          <th key={h} className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider pb-3 px-2">{h}</th>
                        ))}
                      </tr></thead>
                      <tbody className="divide-y divide-gray-50">
                        {analytics.recentLeads.map((lead) => (
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
                )}
              </div>
            </div>
          )}

          {/* ── DOCTORES ─────────────────────────────────── */}
          {sub === "doctores" && (
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
          )}

          {/* ── PACIENTES ────────────────────────────────── */}
          {sub === "pacientes" && (
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
            </div>
          )}

          {/* ── SERVICIOS ────────────────────────────────── */}
          {sub === "servicios" && (
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
          )}

          {/* ── OPERACIONES ──────────────────────────────── */}
          {sub === "operaciones" && (
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
          )}
        </>
      )}
    </div>
  );
}

/* ─── Status Pill ──────────────────────────────────────────────────────────── */
function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    confirmed: "bg-emerald-50 text-emerald-700 border-emerald-100",
    pending:   "bg-amber-50 text-amber-700 border-amber-100",
    cancelled: "bg-gray-50 text-gray-400 border-gray-100",
  };
  const labels: Record<string, string> = { confirmed: "Confirmada", pending: "Pendiente", cancelled: "Cancelada" };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${map[status] ?? map.pending}`}>
      {labels[status] ?? status}
    </span>
  );
}

/* ─── Doctor View (role === "USER") ────────────────────────────────────────── */
interface DoctorBooking {
  id: string;
  startTime: string;
  patientName: string | null;
  service: string | null;
  status: string;
  doctor: string | null;
}

function DoctorView({ user, clinic, onShowFull }: { user: AuthUser; clinic: ClinicData; onShowFull: () => void }) {
  const [bookings, setBookings] = useState<DoctorBooking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);

  const todayStr = new Date().toISOString().slice(0, 10);
  const firstName = user.name?.split(" ")[0] ?? user.name ?? "Doctor/a";

  const todayLabel = new Date().toLocaleDateString("es-CL", {
    weekday: "long", day: "numeric", month: "long",
  });

  useEffect(() => {
    async function load() {
      setLoadingBookings(true);
      try {
        const res = await fetch(`${API}/api/agenda/bookings?date=${todayStr}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (res.ok) {
          const data: DoctorBooking[] = await res.json();
          const filtered = data.filter((b) =>
            b.doctor && b.doctor.toLowerCase().includes(user.name?.split(" ").pop()?.toLowerCase() ?? "")
          );
          setBookings(filtered);
        }
      } catch {}
      finally { setLoadingBookings(false); }
    }
    load();
  }, [todayStr, user.name]);

  const activeBookings = bookings.filter((b) => b.status !== "cancelled");
  const nextBooking = activeBookings.find((b) => new Date(b.startTime) > new Date());

  function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#F8FAFC" }}>
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 sm:px-8 py-4 bg-white border-b border-gray-100 sticky top-0 z-10">
        <Link href="/"><Image src="/logo.svg" alt="molari.ai" width={120} height={32} priority /></Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600 hidden sm:block">{user.name}</span>
          <RoleBadge role={user.role} />
          <button
            onClick={onShowFull}
            className="text-xs font-medium text-gray-500 hover:text-gray-800 border border-gray-200 px-3 py-1.5 rounded-lg transition-colors">
            Ver panel completo
          </button>
        </div>
      </nav>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 py-8 flex flex-col gap-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-black" style={{ color: "#0B2F42" }}>
            Buenos dias, {firstName}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5 capitalize">{todayLabel}</p>
          <p className="text-xs text-gray-400 mt-0.5">{clinic.name}</p>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-1">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Citas hoy</p>
            <p className="text-3xl font-black leading-none" style={{ color: "#0B2F42" }}>
              {loadingBookings ? "—" : activeBookings.length}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-1">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Proxima cita</p>
            <p className="text-3xl font-black leading-none" style={{ color: "#D95F45" }}>
              {loadingBookings ? "—" : nextBooking ? fmtTime(nextBooking.startTime) : "—"}
            </p>
            {nextBooking && (
              <p className="text-xs text-gray-400 mt-0.5 truncate">{nextBooking.patientName ?? "Paciente"}</p>
            )}
          </div>
        </div>

        {/* Appointments list */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 text-sm">Agenda de hoy</h2>
            {!loadingBookings && (
              <span className="text-xs text-gray-400">{activeBookings.length} cita{activeBookings.length !== 1 ? "s" : ""}</span>
            )}
          </div>

          {loadingBookings && (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#0B2F42", borderTopColor: "transparent" }} />
            </div>
          )}

          {!loadingBookings && activeBookings.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-sm text-gray-400">Sin citas programadas para hoy.</p>
            </div>
          )}

          {!loadingBookings && activeBookings.length > 0 && (
            <div className="divide-y divide-gray-50">
              {activeBookings.map((b) => (
                <div key={b.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                  <div className="shrink-0 w-14 text-center">
                    <span className="text-sm font-black" style={{ color: "#0B2F42" }}>{fmtTime(b.startTime)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{b.patientName ?? "Paciente"}</p>
                    {b.service && <p className="text-xs text-gray-400 truncate mt-0.5">{b.service}</p>}
                  </div>
                  <StatusPill status={b.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Link to full agenda */}
        <button
          onClick={onShowFull}
          className="text-sm font-semibold text-center py-3 rounded-2xl border-2 transition-colors hover:bg-gray-50"
          style={{ borderColor: "#0B2F42", color: "#0B2F42" }}>
          Ver agenda completa
        </button>
      </div>
    </div>
  );
}

/* ─── Dashboard principal ──────────────────────────────────────────────────── */
export default function PartnersDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [clinic, setClinic] = useState<ClinicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("agenda");

  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [forceFull, setForceFull] = useState(false);

  // Basic info
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", whatsapp: "", instagram: "", location: "", assistantName: "", tone: "" });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // Schedule
  const [schedEditing, setSchedEditing] = useState(false);
  const [schedForm, setSchedForm] = useState({ weekdays: "", saturday: "", sunday: "" });
  const [schedSaving, setSchedSaving] = useState(false);
  const [schedMsg, setSchedMsg] = useState("");

  // Reminders
  const [remForm, setRemForm] = useState<ReminderConfig>({ enabled: true, dayBefore: true, twoHours: true, customEnabled: false, customHours: 24 });
  const [remSaving, setRemSaving] = useState(false);
  const [remMsg, setRemMsg] = useState("");
  const [remEditing, setRemEditing] = useState(false);

  // Recall campaign
  const DEFAULT_RECALL_MSG = `Hola {nombre}, te echamos de menos en ${clinic?.name ?? "{clinica}"}. ¿Qué tal si agendamos tu próximo control?`;
  const [recallForm, setRecallForm] = useState<RecallConfig>({ enabled: false, daysInactive: 90, message: DEFAULT_RECALL_MSG });
  const [recallSaving, setRecallSaving] = useState(false);
  const [recallMsg, setRecallMsg] = useState("");
  const [recallTriggering, setRecallTriggering] = useState(false);
  const [recallEditing, setRecallEditing] = useState(false);

  // Post-appt survey
  const DEFAULT_SURVEY_MSG = "Hola {nombre}, ¿cómo fue tu visita a {clinica}? Tu opinión nos ayuda a mejorar. ¿Nos dejarías una reseña? ⭐";
  const [surveyForm, setSurveyForm] = useState<SurveyConfig>({ enabled: false, hoursAfter: 2, message: DEFAULT_SURVEY_MSG });
  const [surveySaving, setSurveySaving] = useState(false);
  const [surveyMsg, setSurveyMsg] = useState("");
  const [surveyEditing, setSurveyEditing] = useState(false);

  useEffect(() => {
    getMe().then((data) => {
      if (!data) { router.push("/login"); return; }
      setUser(data.user);
      setClinic(data.clinic);
      if (data.clinic) { syncForm(data.clinic); syncSchedForm(data.clinic); syncRemForm(data.clinic); syncRecallForm(data.clinic); syncSurveyForm(data.clinic); }
      setLoading(false);
      if (data.clinic) fetchAnalytics(data.clinic.id);
    });
  }, [router]);

  async function fetchAnalytics(clinicId: string) {
    setAnalyticsLoading(true);
    try {
      const res = await fetch(`${API}/api/clinics/${clinicId}/analytics`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) setAnalytics(await res.json());
    } catch {}
    finally { setAnalyticsLoading(false); }
  }

  function syncForm(c: ClinicData) {
    const cfg = c.config as ClinicConfig;
    setForm({ name: c.name ?? "", phone: c.phone ?? "", whatsapp: c.whatsapp ?? "",
      instagram: c.instagram ?? "", location: c.location ?? "", assistantName: cfg.assistantName ?? "",
      tone: cfg.tone ?? "" });
  }
  function syncSchedForm(c: ClinicData) {
    const cfg = c.config as ClinicConfig;
    setSchedForm({ weekdays: cfg.schedule?.weekdays ?? "", saturday: cfg.schedule?.saturday ?? "", sunday: cfg.schedule?.sunday ?? "" });
  }
  function syncRemForm(c: ClinicData) {
    const cfg = c.config as ClinicConfig;
    setRemForm({ enabled: cfg.reminders?.enabled !== false, dayBefore: cfg.reminders?.dayBefore !== false, twoHours: cfg.reminders?.twoHours !== false, customEnabled: cfg.reminders?.customEnabled ?? false, customHours: cfg.reminders?.customHours ?? 24 });
  }
  function syncRecallForm(c: ClinicData) {
    const cfg = c.config as ClinicConfig;
    setRecallForm({
      enabled: cfg.recallCampaign?.enabled ?? false,
      daysInactive: cfg.recallCampaign?.daysInactive ?? 90,
      message: cfg.recallCampaign?.message ?? DEFAULT_RECALL_MSG,
    });
  }
  function syncSurveyForm(c: ClinicData) {
    const cfg = c.config as ClinicConfig;
    const raw = cfg.postApptSurvey;
    if (raw && typeof raw === "object") {
      setSurveyForm({ enabled: raw.enabled ?? false, hoursAfter: raw.hoursAfter ?? 2, message: raw.message ?? DEFAULT_SURVEY_MSG });
    } else {
      setSurveyForm((f) => ({ ...f, enabled: raw === true }));
    }
  }

  function handleLogout() { logout(); router.push("/"); }

  async function saveBasicInfo() {
    if (!clinic) return;
    setSaving(true); setSaveMsg("");
    try {
      const { assistantName, tone, ...basicFields } = form;
      const cfg = { ...(clinic.config as ClinicConfig), assistantName, tone };
      const updated = await updateClinic(clinic.id, { ...basicFields, config: cfg as Record<string, unknown> });
      setClinic(updated); syncForm(updated); setEditing(false);
      setSaveMsg("Guardado"); setTimeout(() => setSaveMsg(""), 3000);
    } catch (e) { setSaveMsg(e instanceof Error ? e.message : "Error al guardar"); }
    finally { setSaving(false); }
  }

  async function saveSchedule() {
    if (!clinic) return;
    setSchedSaving(true); setSchedMsg("");
    try {
      const cfg = { ...(clinic.config as ClinicConfig), schedule: schedForm };
      const updated = await updateClinic(clinic.id, { config: cfg as Record<string, unknown> });
      setClinic(updated); syncSchedForm(updated); setSchedEditing(false);
      setSchedMsg("Guardado"); setTimeout(() => setSchedMsg(""), 3000);
    } catch (e) { setSchedMsg(e instanceof Error ? e.message : "Error"); }
    finally { setSchedSaving(false); }
  }

  async function saveReminders() {
    if (!clinic) return;
    setRemSaving(true); setRemMsg("");
    try {
      const cfg = { ...(clinic.config as ClinicConfig), reminders: remForm };
      const updated = await updateClinic(clinic.id, { config: cfg as Record<string, unknown> });
      setClinic(updated); syncRemForm(updated); setRemEditing(false);
      setRemMsg("Guardado"); setTimeout(() => setRemMsg(""), 3000);
    } catch (e) { setRemMsg(e instanceof Error ? e.message : "Error"); }
    finally { setRemSaving(false); }
  }

  async function saveRecall() {
    if (!clinic) return;
    setRecallSaving(true); setRecallMsg("");
    try {
      const cfg = { ...(clinic.config as ClinicConfig), recallCampaign: recallForm };
      const updated = await updateClinic(clinic.id, { config: cfg as Record<string, unknown> });
      setClinic(updated); syncRecallForm(updated); setRecallEditing(false);
      setRecallMsg("Guardado"); setTimeout(() => setRecallMsg(""), 3000);
    } catch (e) { setRecallMsg(e instanceof Error ? e.message : "Error"); }
    finally { setRecallSaving(false); }
  }

  async function triggerRecall() {
    if (!clinic) return;
    setRecallTriggering(true);
    try {
      const token = getToken();
      const r = await fetch(`${API}/api/clinics/${clinic.id}/recall/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ daysInactive: recallForm.daysInactive, message: recallForm.message }),
      });
      const data = await r.json();
      setRecallMsg(`Enviado a ${data.sent} de ${data.total} pacientes inactivos.`);
      setTimeout(() => setRecallMsg(""), 6000);
    } catch { setRecallMsg("Error al ejecutar campaña"); }
    finally { setRecallTriggering(false); }
  }

  async function saveSurvey() {
    if (!clinic) return;
    setSurveySaving(true); setSurveyMsg("");
    try {
      const cfg = { ...(clinic.config as ClinicConfig), postApptSurvey: surveyForm };
      const updated = await updateClinic(clinic.id, { config: cfg as Record<string, unknown> });
      setClinic(updated); syncSurveyForm(updated); setSurveyEditing(false);
      setSurveyMsg("Guardado"); setTimeout(() => setSurveyMsg(""), 3000);
    } catch (e) { setSurveyMsg(e instanceof Error ? e.message : "Error"); }
    finally { setSurveySaving(false); }
  }

  async function saveDoctors(doctors: DoctorRow[], boxes: number) {
    if (!clinic) return;
    const cfg = { ...(clinic.config as ClinicConfig), doctors, boxes };
    const updated = await updateClinic(clinic.id, { config: cfg as Record<string, unknown> });
    setClinic(updated);
  }

  async function saveServices(services: ServiceRow[]) {
    if (!clinic) return;
    const cfg = { ...(clinic.config as ClinicConfig), services };
    const updated = await updateClinic(clinic.id, { config: cfg as Record<string, unknown> });
    setClinic(updated);
  }

  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERADMIN";
  const cfg = (clinic?.config as ClinicConfig) ?? {};

  if (!loading && user?.role === "USER" && clinic && !forceFull) {
    return <DoctorView user={user} clinic={clinic} onShowFull={() => setForceFull(true)} />;
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 sm:px-8 py-4 border-b border-gray-100 sticky top-0 z-10" style={{ backgroundColor: "#FDFCFB" }}>
        <Link href="/"><Image src="/logo.svg" alt="molari.ai" width={120} height={32} priority /></Link>
        <div className="flex items-center gap-4">
{user && <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 hidden sm:block">{user.name}</span>
            <RoleBadge role={user.role} />
          </div>}
          <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Cerrar sesión</button>
        </div>
      </nav>

      <div className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-8 py-8 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{clinic?.name ?? "Sin clínica"}</h1>
            <p className="text-sm text-gray-500 mt-0.5">Panel de administración · molari.ai</p>
          </div>
          {clinic && (
            <Link href="/partners/preview"
              className="text-sm text-white font-bold px-5 py-2.5 rounded-full shadow-md hover:shadow-lg hover:scale-105 transition-all duration-150 active:scale-95"
              style={{ backgroundColor: "#D95F45" }}>
              Probar asistente
            </Link>
          )}
        </div>

        {!clinic && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6 text-sm text-yellow-800">
            Tu usuario no tiene una clínica asignada. Contacta al equipo de molari.ai.
          </div>
        )}

        {clinic && (() => {
          const cfg = clinic.config as Record<string, unknown>;
          const doctorsArr = Array.isArray(cfg.doctors) ? cfg.doctors : [];
          const onboardingDone = cfg.onboardingDone === true || doctorsArr.length > 0;
          return !onboardingDone ? (
            <div className="flex items-center gap-4 px-5 py-4 rounded-2xl border"
              style={{ backgroundColor: "#FFF8F1", borderColor: "#FDD9A0" }}>
              <span className="text-2xl shrink-0">⚡</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold" style={{ color: "#92400E" }}>Completa la configuración inicial</p>
                <p className="text-xs mt-0.5" style={{ color: "#B45309" }}>
                  Agrega tus doctores, horario y canales para que el asistente funcione correctamente.
                </p>
              </div>
              <Link href="/partners/setup"
                className="shrink-0 px-4 py-2 rounded-xl text-xs font-bold text-white transition hover:opacity-90"
                style={{ backgroundColor: "#D95F45" }}>
                Configurar
              </Link>
            </div>
          ) : null;
        })()}

        {clinic && (
          <>
            {/* Tabs */}
            <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
              <div className="flex border-b border-gray-200 gap-1 min-w-max sm:min-w-0">
                {([["agenda", "Agenda"], ["analytics", "Analítica"], ["patients", "Pacientes"], ["bookings", "Citas"], ["config", "Configuración"]] as [Tab, string][]).map(([tab, label]) => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                      activeTab === tab
                        ? "border-blue-600 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* ══ TAB ANALÍTICA ══════════════════════════════════════════════ */}
            {activeTab === "analytics" && (
              <AnalyticsPanel
                clinic={clinic}
                analytics={analytics}
                loading={analyticsLoading}
                onGoToConfig={() => setActiveTab("config")}
                onRetry={() => fetchAnalytics(clinic.id)}
              />
            )}

            {/* ══ TAB AGENDA ═════════════════════════════════════════════════ */}
            {activeTab === "agenda" && user && (
              <div className="flex flex-col gap-4">
                {/* Canales activos */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                  {/* WhatsApp */}
                  <a
                    href={clinic.whatsapp ? `https://wa.me/${clinic.whatsapp.replace(/\D/g, "")}` : undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl border transition-shadow hover:shadow-md"
                    style={{ backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }}
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "#25D366" }}>
                      <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.099.546 4.07 1.5 5.786L0 24l6.389-1.674A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.65-.51-5.17-1.4L2.5 21.5l.93-4.194A9.944 9.944 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-800">WhatsApp</p>
                      <p className="text-[10px] font-semibold" style={{ color: clinic.whatsapp ? "#16a34a" : "#9ca3af" }}>
                        {clinic.whatsapp ? "Activo" : "Sin configurar"}
                      </p>
                    </div>
                    {clinic.whatsapp && (
                      <span className="ml-auto w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
                    )}
                  </a>

                  {/* Instagram */}
                  <div
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl border"
                    style={{ backgroundColor: "#FDF4FF", borderColor: "#E9D5FF" }}
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: "linear-gradient(135deg, #7C3AED, #EC4899)" }}>
                      <svg viewBox="0 0 24 24" className="w-4.5 h-4.5 fill-white w-5 h-5">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-800">Instagram</p>
                      <p className="text-[10px] font-semibold" style={{ color: clinic.instagram ? "#7c3aed" : "#9ca3af" }}>
                        {clinic.instagram ? `@${clinic.instagram.replace("@","")}` : "Sin configurar"}
                      </p>
                    </div>
                    {clinic.instagram && (
                      <span className="ml-auto w-2 h-2 rounded-full bg-purple-400 animate-pulse shrink-0" />
                    )}
                  </div>

                  {/* Web Widget */}
                  <a
                    href="/partners/preview"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl border transition-shadow hover:shadow-md"
                    style={{ backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }}
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "#1A5C7A" }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.8} className="w-5 h-5">
                        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-800">Web Widget</p>
                      <p className="text-[10px] font-semibold text-blue-600">Probar asistente</p>
                    </div>
                    <span className="ml-auto w-2 h-2 rounded-full bg-blue-400 animate-pulse shrink-0" />
                  </a>
                </div>

                <AgendaTab
                  user={user}
                  boxes={(clinic.config as ClinicConfig).boxes ?? 2}
                  doctors={(clinic.config as ClinicConfig).doctors?.map((d) => d.name) ?? []}
                  scheduleConfig={(clinic.config as ClinicConfig).schedule as Record<string, string> | undefined}
                />
              </div>
            )}

            {/* ══ TAB PACIENTES ══════════════════════════════════════════════ */}
            {activeTab === "patients" && (
              <PatientsTab />
            )}

            {/* ══ TAB CITAS ══════════════════════════════════════════════════ */}
            {activeTab === "bookings" && (
              <BookingsTab clinicId={clinic.id} />
            )}

            {/* ══ TAB CONFIGURACIÓN ══════════════════════════════════════════ */}
            {activeTab === "config" && (
              <div className="flex flex-col gap-6">
                {/* Info básica */}
                <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="font-semibold text-gray-900">Información de la clínica</h2>
                    {canEdit && !editing && <button onClick={() => setEditing(true)} className="text-sm text-blue-600 hover:text-blue-700 font-medium">Editar</button>}
                    {canEdit && editing && (
                      <div className="flex gap-3">
                        <button onClick={() => { setEditing(false); syncForm(clinic); }} className="text-sm text-gray-500">Cancelar</button>
                        <button onClick={saveBasicInfo} disabled={saving}
                          className="text-sm bg-blue-600 text-white font-medium px-4 py-1.5 rounded-full hover:bg-blue-700 disabled:opacity-50 transition-colors">
                          {saving ? "Guardando..." : "Guardar"}
                        </button>
                      </div>
                    )}
                  </div>
                  {saveMsg && <p className={`text-xs mb-4 ${saveMsg === "Guardado" ? "text-green-600" : "text-red-600"}`}>{saveMsg}</p>}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <InfoField label="Nombre de la clínica" value={form.name} editable={editing} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
                    <InfoField label="Nombre del asistente" value={form.assistantName} editable={editing} placeholder="Ej: Gala, Aria..." onChange={(v) => setForm((f) => ({ ...f, assistantName: v }))} />
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Tono del asistente</label>
                      {editing ? (
                        <select value={form.tone} onChange={(e) => setForm((f) => ({ ...f, tone: e.target.value }))}
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition">
                          <option value="">Seleccionar tono...</option>
                          <option value="profesional pero cercano, lenguaje chileno natural">Profesional y cercano (recomendado)</option>
                          <option value="muy amigable y cálido, tutea al paciente, usa expresiones coloquiales chilenas">Amigable y cálido</option>
                          <option value="formal y técnico, trata de usted, lenguaje clínico preciso">Formal y técnico</option>
                          <option value="empático y tranquilizador, prioriza que el paciente se sienta escuchado y sin miedo">Empático y tranquilizador</option>
                        </select>
                      ) : (
                        <p className="text-sm text-gray-800">{form.tone || "—"}</p>
                      )}
                    </div>
                    <InfoField label="Teléfono" value={form.phone} editable={editing} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} />
                    <InfoField label="WhatsApp" value={form.whatsapp} editable={editing} onChange={(v) => setForm((f) => ({ ...f, whatsapp: v }))} />
                    <InfoField label="Instagram" value={form.instagram} editable={editing} onChange={(v) => setForm((f) => ({ ...f, instagram: v }))} />
                    <InfoField label="Ubicación" value={form.location} editable={editing} onChange={(v) => setForm((f) => ({ ...f, location: v }))} />
                    <div>
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Plan</p>
                      <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 capitalize">{clinic.plan}</span>
                    </div>
                  </div>
                </section>

                {/* Horarios */}
                <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-gray-900">Horarios de atención</h2>
                    <div className="flex items-center gap-3">
                      {schedMsg && <span className={`text-xs ${schedMsg === "Guardado" ? "text-green-600" : "text-red-600"}`}>{schedMsg}</span>}
                      {canEdit && !schedEditing && <button onClick={() => setSchedEditing(true)} className="text-sm text-blue-600 hover:text-blue-700 font-medium">Editar</button>}
                      {canEdit && schedEditing && (
                        <div className="flex gap-3">
                          <button onClick={() => { setSchedEditing(false); syncSchedForm(clinic); }} className="text-sm text-gray-500">Cancelar</button>
                          <button onClick={saveSchedule} disabled={schedSaving}
                            className="text-sm bg-blue-600 text-white font-medium px-4 py-1.5 rounded-full hover:bg-blue-700 disabled:opacity-50 transition-colors">
                            {schedSaving ? "Guardando..." : "Guardar"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    {schedEditing ? (
                      <>
                        {[["weekdays", "Lunes a Viernes", "Lunes a Viernes: 10:00 - 18:00"],
                          ["saturday", "Sábado", "Sábado: 10:00 - 14:00"],
                          ["sunday", "Domingo", "Domingo: cerrado"]].map(([key, label, ph]) => (
                          <div key={key}>
                            <label className="block text-xs text-gray-500 mb-1">{label}</label>
                            <input value={schedForm[key as keyof typeof schedForm]}
                              onChange={(e) => setSchedForm((f) => ({ ...f, [key]: e.target.value }))}
                              placeholder={ph}
                              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          </div>
                        ))}
                      </>
                    ) : (
                      <div className="flex flex-col gap-2 text-sm">
                        {schedForm.weekdays && <div className="flex justify-between"><span className="text-gray-500">Semana</span><span className="text-gray-800">{schedForm.weekdays}</span></div>}
                        {schedForm.saturday && <div className="flex justify-between"><span className="text-gray-500">Sábado</span><span className="text-gray-800">{schedForm.saturday}</span></div>}
                        {schedForm.sunday && <div className="flex justify-between"><span className="text-gray-500">Domingo</span><span className="text-gray-800">{schedForm.sunday}</span></div>}
                      </div>
                    )}
                  </div>
                </section>

                <DoctorsEditor doctors={cfg.doctors ?? []} boxes={cfg.boxes ?? 1} canEdit={canEdit} onSave={saveDoctors} />
                <ServicesEditor services={(cfg.services as ServiceRow[]) ?? []} canEdit={canEdit} onSave={saveServices} />

                {/* Recordatorios automáticos */}
                <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-gray-900">Recordatorios automáticos</h2>
                    <div className="flex items-center gap-3">
                      {remMsg && <span className={`text-xs ${remMsg === "Guardado" ? "text-green-600" : "text-red-600"}`}>{remMsg}</span>}
                      {canEdit && !remEditing && <button onClick={() => setRemEditing(true)} className="text-sm text-blue-600 hover:text-blue-700 font-medium">Editar</button>}
                      {canEdit && remEditing && (
                        <div className="flex gap-3">
                          <button onClick={() => { setRemEditing(false); if (clinic) syncRemForm(clinic); }} className="text-sm text-gray-500">Cancelar</button>
                          <button onClick={saveReminders} disabled={remSaving}
                            className="text-sm bg-blue-600 text-white font-medium px-4 py-1.5 rounded-full hover:bg-blue-700 disabled:opacity-50 transition-colors">
                            {remSaving ? "Guardando..." : "Guardar"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mb-4">Se envían por WhatsApp al paciente si tiene número registrado.</p>
                  <div className="flex flex-col gap-3">
                    {/* Parent toggle */}
                    {(() => {
                      const canToggle = remEditing && canEdit;
                      return (
                        <label className={`flex items-center justify-between gap-4 p-3 rounded-xl border transition-colors ${canToggle ? "cursor-pointer hover:bg-gray-50" : "opacity-70 cursor-default"}`}
                          style={{ borderColor: "#f1f5f9" }}>
                          <div>
                            <p className="text-sm font-medium text-gray-800">Recordatorios activos</p>
                            <p className="text-xs text-gray-400">Habilita o deshabilita todos los recordatorios</p>
                          </div>
                          <div onClick={() => canToggle && setRemForm((f) => ({ ...f, enabled: !f.enabled }))}
                            className={`w-10 h-6 rounded-full relative transition-colors ${remForm.enabled ? "bg-blue-600" : "bg-gray-200"}`}>
                            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${remForm.enabled ? "translate-x-5" : "translate-x-1"}`} />
                          </div>
                        </label>
                      );
                    })()}
                    {/* Child toggles — indented and disabled when parent is off */}
                    <div className={`flex flex-col gap-2 pl-4 border-l-2 transition-opacity ${remForm.enabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}
                      style={{ borderColor: "#e2e8f0" }}>
                      {[
                        { key: "dayBefore", label: "Recordatorio día anterior",   desc: "Avisa al paciente la noche antes de su cita" },
                        { key: "twoHours",  label: "Recordatorio 2 horas antes",  desc: "Avisa al paciente 2 horas antes de su cita" },
                      ].map(({ key, label, desc }) => {
                        const canToggle = remEditing && canEdit && remForm.enabled;
                        return (
                          <label key={key} className={`flex items-center justify-between gap-4 p-3 rounded-xl border transition-colors ${canToggle ? "cursor-pointer hover:bg-gray-50" : "cursor-default"}`}
                            style={{ borderColor: "#f1f5f9" }}>
                            <div>
                              <p className="text-sm font-medium text-gray-800">{label}</p>
                              <p className="text-xs text-gray-400">{desc}</p>
                            </div>
                            <div onClick={() => canToggle && setRemForm((f) => ({ ...f, [key]: !f[key as keyof ReminderConfig] }))}
                              className={`w-10 h-6 rounded-full relative transition-colors ${remForm[key as keyof ReminderConfig] ? "bg-blue-600" : "bg-gray-200"}`}>
                              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${remForm[key as keyof ReminderConfig] ? "translate-x-5" : "translate-x-1"}`} />
                            </div>
                          </label>
                        );
                      })}
                      {/* Configurable reminder */}
                      {(() => {
                        const canToggle = remEditing && canEdit && remForm.enabled;
                        return (
                          <div className={`p-3 rounded-xl border transition-colors ${canToggle ? "hover:bg-gray-50" : "cursor-default"}`}
                            style={{ borderColor: "#f1f5f9" }}>
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <p className="text-sm font-medium text-gray-800">Recordatorio configurable</p>
                                <p className="text-xs text-gray-400">Envía un aviso un número específico de horas antes</p>
                              </div>
                              <div onClick={() => canToggle && setRemForm((f) => ({ ...f, customEnabled: !f.customEnabled }))}
                                className={`w-10 h-6 rounded-full relative transition-colors shrink-0 ${remForm.customEnabled ? "bg-blue-600" : "bg-gray-200"} ${canToggle ? "cursor-pointer" : ""}`}>
                                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${remForm.customEnabled ? "translate-x-5" : "translate-x-1"}`} />
                              </div>
                            </div>
                            {remForm.customEnabled && (
                              <div className="mt-3 flex items-center gap-3">
                                <label className="text-xs text-gray-500 shrink-0">Horas antes de la cita</label>
                                <input
                                  type="number" min={1} max={168} value={remForm.customHours}
                                  disabled={!canToggle}
                                  onChange={(e) => setRemForm((f) => ({ ...f, customHours: Math.max(1, Number(e.target.value)) }))}
                                  className="w-24 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                                />
                                <span className="text-xs text-gray-400">
                                  {remForm.customHours === 1 ? "1 hora" : remForm.customHours < 24 ? `${remForm.customHours} horas` : remForm.customHours === 24 ? "1 día" : `${Math.round(remForm.customHours / 24 * 10) / 10} días`}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </section>

                {/* Auto-agendamiento público */}
                {clinic && (
                  <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h2 className="font-semibold text-gray-900 mb-1">Auto-agendamiento público</h2>
                    <p className="text-xs text-gray-400 mb-4">
                      Comparte este link para que tus pacientes agenden directamente — sin llamadas ni WhatsApp.
                      Ponlo en tu bio de Instagram, tu página web o envíalo por mensaje.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="flex-1 bg-gray-50 rounded-xl border border-gray-200 px-4 py-3 text-xs text-gray-700 font-mono break-all select-all">
                        {typeof window !== "undefined" ? window.location.origin : "https://tu-dominio.com"}/book/{clinic.slug}
                      </div>
                      <button
                        onClick={() => {
                          const url = `${window.location.origin}/book/${clinic.slug}`;
                          navigator.clipboard.writeText(url);
                        }}
                        className="text-xs font-semibold px-4 py-2 rounded-xl border transition-colors hover:bg-gray-50"
                        style={{ borderColor: "#E5E0D9", color: "#1A5C7A" }}>
                        Copiar link
                      </button>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <a href={`/book/${clinic.slug}`} target="_blank" rel="noopener noreferrer"
                        className="text-xs font-semibold underline underline-offset-2" style={{ color: "#607281" }}>
                        Ver página
                      </a>
                    </div>
                  </section>
                )}

                {/* Encuesta post-cita */}
                <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h2 className="font-semibold text-gray-900">Encuesta post-cita</h2>
                      <p className="text-xs text-gray-400 mt-0.5">Mensaje automático por WhatsApp tras cada cita completada.</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {surveyMsg && <span className={`text-xs ${surveyMsg === "Guardado" ? "text-green-600" : "text-red-600"}`}>{surveyMsg}</span>}
                      {canEdit && !surveyEditing && <button onClick={() => setSurveyEditing(true)} className="text-sm text-blue-600 hover:text-blue-700 font-medium">Editar</button>}
                      {canEdit && surveyEditing && (
                        <div className="flex gap-3">
                          <button onClick={() => { setSurveyEditing(false); if (clinic) syncSurveyForm(clinic); }} className="text-sm text-gray-500">Cancelar</button>
                          <button onClick={saveSurvey} disabled={surveySaving}
                            className="text-sm bg-blue-600 text-white font-medium px-4 py-1.5 rounded-full hover:bg-blue-700 disabled:opacity-50 transition-colors">
                            {surveySaving ? "Guardando..." : "Guardar"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Widget */}
                  <div className={`flex flex-col gap-4 transition-opacity ${!surveyEditing ? "opacity-70 pointer-events-none" : ""}`}>
                    {/* Activar / desactivar */}
                    <div className="flex items-center justify-between p-3 rounded-xl border" style={{ borderColor: "#f1f5f9" }}>
                      <div>
                        <p className="text-sm font-medium text-gray-800">Encuesta activa</p>
                        <p className="text-xs text-gray-400">Ideal para conseguir reseñas en Google.</p>
                      </div>
                      <div onClick={() => setSurveyForm((f) => ({ ...f, enabled: !f.enabled }))}
                        className={`w-10 h-6 rounded-full relative transition-colors shrink-0 cursor-pointer ${surveyForm.enabled ? "bg-blue-600" : "bg-gray-200"}`}>
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${surveyForm.enabled ? "translate-x-5" : "translate-x-1"}`} />
                      </div>
                    </div>

                    <div className={`flex flex-col gap-4 transition-opacity ${surveyForm.enabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
                      {/* Horas después */}
                      <div className="flex items-center gap-4 p-3 rounded-xl border" style={{ borderColor: "#f1f5f9" }}>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-800">Enviar</p>
                          <p className="text-xs text-gray-400">Horas después de terminada la cita</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="number" min={1} max={72} value={surveyForm.hoursAfter}
                            onChange={(e) => setSurveyForm((f) => ({ ...f, hoursAfter: Math.max(1, Number(e.target.value)) }))}
                            className="w-16 px-2 py-1.5 rounded-lg border border-gray-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          <span className="text-xs text-gray-500">hrs</span>
                        </div>
                      </div>

                      {/* Mensaje */}
                      <div>
                        <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                          Mensaje — usa {"{nombre}"} y {"{clinica}"}
                        </label>
                        <textarea rows={3} value={surveyForm.message}
                          onChange={(e) => setSurveyForm((f) => ({ ...f, message: e.target.value }))}
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                      </div>

                      {/* Preview burbuja WhatsApp */}
                      <div>
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Vista previa</p>
                        <div className="bg-[#ECE5DD] rounded-2xl p-4">
                          <div className="flex justify-end">
                            <div className="bg-[#DCF8C6] rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[85%] shadow-sm">
                              <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                                {surveyForm.message
                                  .replace("{nombre}", "María")
                                  .replace("{clinica}", clinic?.name ?? "Clínica")}
                              </p>
                              <p className="text-[10px] text-gray-400 text-right mt-1">
                                {surveyForm.hoursAfter === 1 ? "1 hr después" : `${surveyForm.hoursAfter} hrs después`}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Campañas de recall */}
                <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="font-semibold text-gray-900">Campañas de recall</h2>
                      <p className="text-xs text-gray-400 mt-0.5">Mensajes automáticos para pacientes que no han vuelto en X días.</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {recallMsg && <span className={`text-xs ${recallMsg.startsWith("Enviado") || recallMsg === "Guardado" ? "text-green-600" : "text-red-600"}`}>{recallMsg}</span>}
                      {canEdit && !recallEditing && <button onClick={() => setRecallEditing(true)} className="text-sm text-blue-600 hover:text-blue-700 font-medium">Editar</button>}
                      {canEdit && recallEditing && (
                        <div className="flex gap-3">
                          <button onClick={() => { setRecallEditing(false); if (clinic) syncRecallForm(clinic); }} className="text-sm text-gray-500">Cancelar</button>
                          <button onClick={saveRecall} disabled={recallSaving}
                            className="text-sm bg-blue-600 text-white font-medium px-4 py-1.5 rounded-full hover:bg-blue-700 disabled:opacity-50 transition-colors">
                            {recallSaving ? "Guardando..." : "Guardar"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-4">
                    <label className={`flex items-center justify-between gap-4 p-3 rounded-xl border transition-colors ${recallEditing && canEdit ? "cursor-pointer hover:bg-gray-50" : "opacity-70 cursor-default"}`}
                      style={{ borderColor: "#f1f5f9" }}>
                      <div>
                        <p className="text-sm font-medium text-gray-800">Recall activado</p>
                        <p className="text-xs text-gray-400">Habilita las campañas de re-contacto por WhatsApp.</p>
                      </div>
                      <div onClick={() => recallEditing && canEdit && setRecallForm((f) => ({ ...f, enabled: !f.enabled }))}
                        className={`w-10 h-6 rounded-full relative transition-colors shrink-0 ${recallForm.enabled ? "bg-blue-600" : "bg-gray-200"}`}>
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${recallForm.enabled ? "translate-x-5" : "translate-x-1"}`} />
                      </div>
                    </label>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
                        Días de inactividad para enviar
                      </label>
                      <input type="number" min={30} max={365} value={recallForm.daysInactive}
                        disabled={!recallEditing || !canEdit}
                        onChange={(e) => setRecallForm((f) => ({ ...f, daysInactive: Number(e.target.value) }))}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-70" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
                        Mensaje — usa {"{nombre}"} y {"{clinica}"}
                      </label>
                      <textarea rows={3} value={recallForm.message}
                        disabled={!recallEditing || !canEdit}
                        onChange={(e) => setRecallForm((f) => ({ ...f, message: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:opacity-70" />
                    </div>
                    {canEdit && !recallEditing && (
                      <button onClick={triggerRecall} disabled={recallTriggering}
                        className="flex items-center gap-2 self-start text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50"
                        style={{ backgroundColor: "#F7F5F1", border: "1.5px solid #E5E0D9", color: "#0C1B26" }}>
                        {recallTriggering ? "Enviando..." : "▶ Ejecutar campaña ahora"}
                      </button>
                    )}
                  </div>
                </section>

                {/* Webhook WhatsApp */}
                <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <h2 className="font-semibold text-gray-900 mb-1">Webhook WhatsApp (inbound)</h2>
                  <p className="text-xs text-gray-400 mb-4">
                    Configura esta URL en tu consola de Twilio para que los mensajes entrantes de WhatsApp lleguen al asistente.
                  </p>
                  <div className="bg-gray-50 rounded-xl border border-gray-200 px-4 py-3 font-mono text-xs text-gray-700 break-all select-all">
                    {typeof window !== "undefined" ? window.location.origin : "https://tu-dominio.com"}/api/webhooks/whatsapp/{clinic.slug}
                  </div>
                  <p className="text-xs text-gray-400 mt-3">
                    En Twilio: <strong>Sandbox Settings → When a message comes in</strong> → pega la URL → método POST.
                  </p>
                </section>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
