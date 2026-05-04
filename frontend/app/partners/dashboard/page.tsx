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
}

interface ClinicConfig {
  tone?: string;
  assistantName?: string;
  doctors?: DoctorRow[];
  services?: ServiceRow[];
  boxes?: number;
  schedule?: { weekdays?: string; saturday?: string; sunday?: string };
  reminders?: ReminderConfig;
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

/* ─── Dashboard principal ──────────────────────────────────────────────────── */
export default function PartnersDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [clinic, setClinic] = useState<ClinicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("agenda");

  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

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
  const [remForm, setRemForm] = useState<ReminderConfig>({ enabled: true, dayBefore: true, twoHours: true });
  const [remSaving, setRemSaving] = useState(false);
  const [remMsg, setRemMsg] = useState("");

  useEffect(() => {
    getMe().then((data) => {
      if (!data) { router.push("/login"); return; }
      setUser(data.user);
      setClinic(data.clinic);
      if (data.clinic) { syncForm(data.clinic); syncSchedForm(data.clinic); syncRemForm(data.clinic); }
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
    setRemForm({ enabled: cfg.reminders?.enabled !== false, dayBefore: cfg.reminders?.dayBefore !== false, twoHours: cfg.reminders?.twoHours !== false });
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
      setClinic(updated); syncRemForm(updated);
      setRemMsg("Guardado"); setTimeout(() => setRemMsg(""), 3000);
    } catch (e) { setRemMsg(e instanceof Error ? e.message : "Error"); }
    finally { setRemSaving(false); }
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

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 sm:px-8 py-4 bg-white border-b border-gray-100 sticky top-0 z-10">
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
            <Link href={`/demo/${clinic.slug}`}
              className="text-sm bg-blue-600 text-white font-semibold px-4 py-2 rounded-full hover:bg-blue-700 transition-colors">
              Ver demo →
            </Link>
          )}
        </div>

        {!clinic && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6 text-sm text-yellow-800">
            Tu usuario no tiene una clínica asignada. Contacta al equipo de molari.ai.
          </div>
        )}

        {clinic && (
          <>
            {/* Tabs */}
            <div className="flex border-b border-gray-200 gap-1">
              {([["agenda", "Agenda"], ["analytics", "Analítica"], ["patients", "Pacientes"], ["bookings", "Citas"], ["config", "Configuración"]] as [Tab, string][]).map(([tab, label]) => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                    activeTab === tab
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}>
                  {label}
                </button>
              ))}
            </div>

            {/* ══ TAB ANALÍTICA ══════════════════════════════════════════════ */}
            {activeTab === "analytics" && (
              <div className="flex flex-col gap-6">
                <SetupChecklist clinic={clinic} onGoToConfig={() => setActiveTab("config")} />
                {analyticsLoading && (
                  <div className="flex items-center justify-center py-16">
                    <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}

                {!analyticsLoading && analytics && (
                  <>
                    {/* Stat cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <StatCard label="Conversaciones" value={analytics.totals.sessions} />
                      <StatCard label="Leads captados" value={analytics.totals.leads}
                        sub={analytics.totals.sessions > 0 ? `${Math.round(analytics.totals.leads / analytics.totals.sessions * 100)}% del total` : undefined} />
                      <StatCard label="Quieren agendar" value={`${analytics.conversionRate}%`}
                        sub={`${analytics.totals.readyToBook} leads`} accent />
                      <StatCard label="Citas agendadas" value={analytics.totals.bookings}
                        sub={analytics.totals.leads > 0 ? `${analytics.bookingRate}% conversión` : undefined} />
                    </div>

                    {/* ── Sección financiera ─────────────────────────────────── */}
                    {(() => {
                      const pay = analytics.payments;
                      const fmtCLP = (n: number) =>
                        n >= 1_000_000
                          ? `$${(n / 1_000_000).toFixed(1)}M`
                          : `$${(n / 1_000).toFixed(0)}k`;
                      const pctChange = pay && pay.lastMonth.income > 0
                        ? Math.round(((pay.thisMonth.income - pay.lastMonth.income) / pay.lastMonth.income) * 100)
                        : null;
                      const maxIncome = pay ? Math.max(...pay.incomeByMonth.map((r) => r.income), 1) : 1;
                      const MONTH_LABELS: Record<string, string> = {
                        "01":"Ene","02":"Feb","03":"Mar","04":"Abr","05":"May","06":"Jun",
                        "07":"Jul","08":"Ago","09":"Sep","10":"Oct","11":"Nov","12":"Dic",
                      };

                      return (
                        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                          <div className="flex items-center justify-between mb-5">
                            <h2 className="font-semibold text-gray-900">Ingresos</h2>
                            {pay && pay.thisMonth.count === 0 && (
                              <span className="text-xs text-gray-400">Registra pagos desde la agenda para ver datos</span>
                            )}
                          </div>

                          {/* KPIs */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                            <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 mb-1">Este mes</p>
                              <p className="text-2xl font-black text-emerald-700 leading-none">
                                {pay ? fmtCLP(pay.thisMonth.income) : "—"}
                              </p>
                              {pay && pay.thisMonth.count > 0 && (
                                <p className="text-xs text-emerald-600 mt-1">{pay.thisMonth.count} pago{pay.thisMonth.count !== 1 ? "s" : ""}</p>
                              )}
                              {pctChange !== null && (
                                <p className={`text-xs font-semibold mt-1 ${pctChange >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                                  {pctChange >= 0 ? "+" : ""}{pctChange}% vs mes anterior
                                </p>
                              )}
                            </div>
                            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Mes anterior</p>
                              <p className="text-2xl font-black text-gray-700 leading-none">
                                {pay ? fmtCLP(pay.lastMonth.income) : "—"}
                              </p>
                              {pay && pay.lastMonth.count > 0 && (
                                <p className="text-xs text-gray-500 mt-1">{pay.lastMonth.count} pago{pay.lastMonth.count !== 1 ? "s" : ""}</p>
                              )}
                            </div>
                            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 sm:block hidden">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Estado pagos</p>
                              <div className="flex flex-col gap-1.5">
                                {[
                                  { key: "paid",    label: "Pagado",    color: "#10B981" },
                                  { key: "partial", label: "Parcial",   color: "#F59E0B" },
                                  { key: "pending", label: "Pendiente", color: "#9CA3AF" },
                                  { key: "waived",  label: "Bonificado",color: "#8B5CF6" },
                                ].map(({ key, label, color }) => {
                                  const entry = pay?.byStatus.find((s) => s.status === key);
                                  if (!entry) return null;
                                  return (
                                    <div key={key} className="flex items-center gap-1.5 text-xs">
                                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                                      <span className="text-gray-500 flex-1">{label}</span>
                                      <span className="font-bold text-gray-700">{entry.count}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>

                          {/* Income by month bar chart */}
                          {pay && pay.incomeByMonth.length > 0 && (
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3">Últimos 6 meses</p>
                              <div className="flex items-end gap-2 h-20">
                                {pay.incomeByMonth.map((r) => {
                                  const pct = Math.round((r.income / maxIncome) * 100);
                                  const [, mm] = r.month.split("-");
                                  return (
                                    <div key={r.month} className="flex-1 flex flex-col items-center gap-1 group">
                                      <span className="text-[9px] text-gray-400 opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                                        {fmtCLP(r.income)}
                                      </span>
                                      <div className="w-full rounded-t-lg bg-emerald-500 transition-all hover:bg-emerald-400"
                                        style={{ height: `${Math.max(pct, 4)}%`, minHeight: "4px" }} />
                                      <span className="text-[10px] text-gray-400">{MONTH_LABELS[mm] ?? mm}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </section>
                      );
                    })()}

                    {/* Score promedio + embudo */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Score */}
                      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Score promedio</p>
                        <div className="flex items-end gap-2">
                          <span className={`text-5xl font-black leading-none ${
                            analytics.totals.avgScore >= 70 ? "text-green-600" : analytics.totals.avgScore >= 40 ? "text-yellow-500" : "text-gray-400"
                          }`}>{analytics.totals.avgScore}</span>
                          <span className="text-gray-400 text-sm mb-1">/100</span>
                        </div>
                        <div className="mt-3 h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${
                            analytics.totals.avgScore >= 70 ? "bg-green-500" : analytics.totals.avgScore >= 40 ? "bg-yellow-400" : "bg-gray-300"
                          }`} style={{ width: `${analytics.totals.avgScore}%` }} />
                        </div>
                      </div>

                      {/* Urgencia */}
                      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Urgencia</p>
                        <div className="flex flex-col gap-2">
                          {[["high", "Alta", "bg-red-500"], ["medium", "Media", "bg-yellow-400"], ["low", "Baja", "bg-gray-300"]].map(([key, label, color]) => {
                            const count = analytics.urgencyBreakdown.find((u) => u.urgency === key)?.count ?? 0;
                            const total = analytics.urgencyBreakdown.reduce((a, b) => a + b.count, 0) || 1;
                            return (
                              <div key={key} className="flex items-center gap-2 text-sm">
                                <div className={`w-2 h-2 rounded-full shrink-0 ${color}`} />
                                <span className="text-gray-500 flex-1">{label}</span>
                                <span className="font-semibold text-gray-800">{count}</span>
                                <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                  <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.round(count / total * 100)}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Top servicios */}
                      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Top servicios</p>
                        {analytics.topServices.length === 0 ? (
                          <p className="text-sm text-gray-400">Sin datos aún</p>
                        ) : (
                          <div className="flex flex-col gap-2">
                            {analytics.topServices.slice(0, 5).map((s) => {
                              const max = analytics.topServices[0]?.count || 1;
                              return (
                                <div key={s.name} className="flex flex-col gap-0.5">
                                  <div className="flex justify-between text-xs">
                                    <span className="text-gray-700 truncate max-w-[140px]">{s.name}</span>
                                    <span className="text-gray-400 shrink-0 ml-1">{s.count}</span>
                                  </div>
                                  <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                    <div className="h-full rounded-full bg-blue-400" style={{ width: `${Math.round(s.count / max * 100)}%` }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Tabla de leads recientes */}
                    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                      <div className="flex items-center justify-between mb-5">
                        <h2 className="font-semibold text-gray-900">Leads recientes</h2>
                        <span className="text-xs text-gray-400">{analytics.recentLeads.length} conversaciones</span>
                      </div>

                      {analytics.recentLeads.length === 0 ? (
                        <div className="py-10 text-center">
                          <p className="text-sm text-gray-400">Aún no hay conversaciones registradas.</p>
                          <Link href={`/demo/${clinic.slug}`} className="text-sm text-blue-600 mt-2 inline-block hover:underline">
                            Probar el asistente →
                          </Link>
                        </div>
                      ) : (
                        <div className="overflow-x-auto -mx-2">
                          <table className="w-full text-sm min-w-[540px]">
                            <thead>
                              <tr className="border-b border-gray-100">
                                {["Paciente", "Servicio", "Score", "Intención", "Urg.", "Canal", "Fecha"].map((h) => (
                                  <th key={h} className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider pb-3 px-2">{h}</th>
                                ))}
                              </tr>
                            </thead>
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
                    </section>
                  </>
                )}

                {!analyticsLoading && !analytics && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center text-sm text-gray-400">
                    No se pudieron cargar los datos. <button onClick={() => fetchAnalytics(clinic.id)} className="text-blue-600 hover:underline">Reintentar</button>
                  </div>
                )}
              </div>
            )}

            {/* ══ TAB AGENDA ═════════════════════════════════════════════════ */}
            {activeTab === "agenda" && user && (
              <AgendaTab user={user} />
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
                      {canEdit && (
                        <button onClick={saveReminders} disabled={remSaving}
                          className="text-sm bg-blue-600 text-white font-medium px-4 py-1.5 rounded-full hover:bg-blue-700 disabled:opacity-50 transition-colors">
                          {remSaving ? "Guardando..." : "Guardar"}
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mb-4">Se envían por WhatsApp al paciente si tiene número registrado.</p>
                  <div className="flex flex-col gap-3">
                    {[
                      { key: "enabled",   label: "Recordatorios activos",           desc: "Habilita o deshabilita todos los recordatorios" },
                      { key: "dayBefore", label: "Recordatorio día anterior",       desc: "Avisa al paciente la noche antes de su cita" },
                      { key: "twoHours",  label: "Recordatorio 2 horas antes",     desc: "Avisa al paciente 2 horas antes de su cita" },
                    ].map(({ key, label, desc }) => (
                      <label key={key} className={`flex items-center justify-between gap-4 p-3 rounded-xl border transition-colors cursor-pointer ${canEdit ? "hover:bg-gray-50" : "opacity-70 cursor-default"}`}
                        style={{ borderColor: "#f1f5f9" }}>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{label}</p>
                          <p className="text-xs text-gray-400">{desc}</p>
                        </div>
                        <div
                          onClick={() => canEdit && setRemForm((f) => ({ ...f, [key]: !f[key as keyof ReminderConfig] }))}
                          className={`w-10 h-6 rounded-full relative transition-colors ${remForm[key as keyof ReminderConfig] ? "bg-blue-600" : "bg-gray-200"}`}
                        >
                          <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${remForm[key as keyof ReminderConfig] ? "translate-x-5" : "translate-x-1"}`} />
                        </div>
                      </label>
                    ))}
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
