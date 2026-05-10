"use client";

import { useEffect, useState, useCallback } from "react";
import { getToken } from "@/lib/auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface Analytics {
  payments?: {
    thisMonth: { income: number; count: number };
    lastMonth: { income: number; count: number };
    byStatus: { status: string | null; count: number; totalCharged: number; totalPaid: number }[];
  };
  doctors?: { doctor: string; bookings: number; cancelled: number; income: number }[];
  patients?: { total: number; newThisMonth: number; retentionRate: number };
  services?: { service: string; count: number; income: number }[];
}

interface TodayBooking {
  id: string; time: string; patientName: string | null;
  doctor: string; service: string | null; status: string;
}

type WidgetId = "today" | "revenue" | "patients" | "pending" | "doctors" | "services";
type WidgetSize = "half" | "full";

interface WidgetCfg { id: WidgetId; size: WidgetSize; order: number; hidden: boolean; }

const DEFAULT_WIDGETS: WidgetCfg[] = [
  { id: "today",    size: "half", order: 0, hidden: false },
  { id: "revenue",  size: "half", order: 1, hidden: false },
  { id: "patients", size: "half", order: 2, hidden: false },
  { id: "pending",  size: "half", order: 3, hidden: false },
  { id: "doctors",  size: "full", order: 4, hidden: false },
  { id: "services", size: "half", order: 5, hidden: false },
];

const WIDGET_META: Record<WidgetId, { title: string; icon: string }> = {
  today:    { title: "Citas de hoy",          icon: "📅" },
  revenue:  { title: "Ingresos del mes",       icon: "💰" },
  patients: { title: "Pacientes",              icon: "👥" },
  pending:  { title: "Cobros pendientes",      icon: "⏳" },
  doctors:  { title: "Actividad por doctor",   icon: "🩺" },
  services: { title: "Servicios más pedidos",  icon: "📋" },
};

const fmtCLP = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${Math.round(n / 1_000)}k`;

const COLORS = ["#10B981","#3B82F6","#8B5CF6","#F59E0B","#EC4899","#EF4444","#14B8A6","#F97316"];

/* ─── Helpers ─────────────────────────────────────────────────────────── */
function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[10px] text-gray-400 w-8 text-right tabular-nums">{pct}%</span>
    </div>
  );
}

function Kpi({ label, value, sub, trend }: { label: string; value: string; sub?: string; trend?: "up" | "down" | "flat" }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">{label}</p>
      <p className="text-2xl font-black text-gray-900 leading-none">{value}</p>
      {sub && (
        <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
          {trend === "up" && <span className="text-emerald-500">↑</span>}
          {trend === "down" && <span className="text-red-400">↓</span>}
          {sub}
        </p>
      )}
    </div>
  );
}

/* ─── Widget cards ───────────────────────────────────────────────────── */
function TodayWidget({ bookings }: { bookings: TodayBooking[] }) {
  const active = bookings.filter((b) => b.status !== "cancelled");
  return (
    <div className="flex flex-col gap-2">
      {active.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">Sin citas programadas hoy</p>
      ) : (
        <div className="flex flex-col divide-y divide-gray-50">
          {active.slice(0, 6).map((b, i) => (
            <div key={b.id} className="flex items-center gap-3 py-2">
              <span className="text-xs font-black tabular-nums text-gray-700 w-12 shrink-0">{b.time}</span>
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800 truncate">{b.patientName ?? "—"}</p>
                <p className="text-[10px] text-gray-400 truncate">{b.doctor.replace(/Dra?\. /, "")}{b.service ? ` · ${b.service}` : ""}</p>
              </div>
            </div>
          ))}
          {active.length > 6 && (
            <p className="text-[10px] text-gray-400 pt-2 text-center">+{active.length - 6} más</p>
          )}
        </div>
      )}
      <div className="mt-auto pt-2 border-t border-gray-50 flex items-center justify-between">
        <span className="text-[10px] text-gray-400">{active.length} cita{active.length !== 1 ? "s" : ""} activa{active.length !== 1 ? "s" : ""}</span>
        <span className="text-[10px] font-bold text-[#1A5C7A]">{new Date().toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })}</span>
      </div>
    </div>
  );
}

function RevenueWidget({ analytics }: { analytics: Analytics | null }) {
  const thisMonth = analytics?.payments?.thisMonth;
  const lastMonth = analytics?.payments?.lastMonth;
  const trend = thisMonth && lastMonth && lastMonth.income > 0
    ? thisMonth.income >= lastMonth.income ? "up" : "down"
    : undefined;
  const trendPct = thisMonth && lastMonth && lastMonth.income > 0
    ? Math.round(((thisMonth.income - lastMonth.income) / lastMonth.income) * 100)
    : null;
  return (
    <div className="flex flex-col gap-4">
      <Kpi label="Ingresos este mes" value={thisMonth ? fmtCLP(thisMonth.income) : "—"}
        sub={trendPct != null ? `${trendPct > 0 ? "+" : ""}${trendPct}% vs mes anterior` : undefined}
        trend={trend} />
      <Kpi label="Citas cobradas" value={String(thisMonth?.count ?? "—")} />
      {lastMonth && (
        <div className="flex items-center gap-2 text-[10px] text-gray-400 border-t border-gray-50 pt-3">
          <span>Mes anterior:</span>
          <span className="font-bold text-gray-600">{fmtCLP(lastMonth.income)}</span>
          <span>·</span>
          <span>{lastMonth.count} citas</span>
        </div>
      )}
    </div>
  );
}

function PatientsWidget({ analytics }: { analytics: Analytics | null }) {
  const p = analytics?.patients;
  return (
    <div className="flex flex-col gap-4">
      <Kpi label="Pacientes totales" value={String(p?.total ?? "—")} />
      <Kpi label="Nuevos este mes" value={String(p?.newThisMonth ?? "—")}
        sub={p && p.total > 0 ? `${Math.round((p.newThisMonth / p.total) * 100)}% del total` : undefined} />
      {p && (
        <div className="border-t border-gray-50 pt-3">
          <p className="text-[10px] text-gray-400 mb-1">Tasa de retención</p>
          <Bar value={p.retentionRate} max={100} color="#10B981" />
        </div>
      )}
    </div>
  );
}

function PendingWidget({ analytics }: { analytics: Analytics | null }) {
  const byStatus = analytics?.payments?.byStatus ?? [];
  const pending = byStatus.find((s) => !s.status || s.status === "pending");
  const partial = byStatus.find((s) => s.status === "partial");
  const pendingAmount = (pending?.totalCharged ?? 0) - (pending?.totalPaid ?? 0);
  const partialAmount = (partial?.totalCharged ?? 0) - (partial?.totalPaid ?? 0);
  const total = pendingAmount + partialAmount;
  const count = (pending?.count ?? 0) + (partial?.count ?? 0);
  return (
    <div className="flex flex-col gap-4">
      <Kpi label="Monto pendiente" value={total > 0 ? fmtCLP(total) : "$0"} />
      <Kpi label="Citas sin cobrar" value={String(count)} />
      {count > 0 && (
        <div className="space-y-2 border-t border-gray-50 pt-3">
          {pending && pending.count > 0 && (
            <div className="flex justify-between text-[10px]">
              <span className="text-gray-400">Sin pago ({pending.count})</span>
              <span className="font-bold text-red-500">{fmtCLP(pendingAmount)}</span>
            </div>
          )}
          {partial && partial.count > 0 && (
            <div className="flex justify-between text-[10px]">
              <span className="text-gray-400">Parcial ({partial.count})</span>
              <span className="font-bold text-amber-500">{fmtCLP(partialAmount)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DoctorsWidget({ analytics }: { analytics: Analytics | null }) {
  const docs = analytics?.doctors ?? [];
  const maxBookings = Math.max(...docs.map((d) => d.bookings), 1);
  if (docs.length === 0) return <p className="text-sm text-gray-400 text-center py-4">Sin datos</p>;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {docs.map((d, i) => (
        <div key={d.doctor} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700 truncate">{d.doctor.replace(/Dra?\. /, "")}</span>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] text-gray-400">{d.bookings} citas</span>
              {d.income > 0 && <span className="text-[10px] font-bold text-emerald-600">{fmtCLP(d.income)}</span>}
            </div>
          </div>
          <Bar value={d.bookings} max={maxBookings} color={COLORS[i % COLORS.length]} />
          {d.cancelled > 0 && (
            <p className="text-[10px] text-gray-400">{d.cancelled} cancelada{d.cancelled !== 1 ? "s" : ""}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function ServicesWidget({ analytics }: { analytics: Analytics | null }) {
  const svcs = (analytics?.services ?? []).slice(0, 6);
  const maxCount = Math.max(...svcs.map((s) => s.count), 1);
  if (svcs.length === 0) return <p className="text-sm text-gray-400 text-center py-4">Sin datos</p>;
  return (
    <div className="flex flex-col gap-2.5">
      {svcs.map((s, i) => (
        <div key={s.service} className="flex flex-col gap-1">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-700 truncate flex-1 mr-2">{s.service}</span>
            <span className="text-[10px] text-gray-400 shrink-0">{s.count}x</span>
          </div>
          <Bar value={s.count} max={maxCount} color={COLORS[i % COLORS.length]} />
        </div>
      ))}
    </div>
  );
}

/* ─── Widget card wrapper ────────────────────────────────────────────── */
function WidgetCard({ cfg, editMode, onMoveUp, onMoveDown, onToggleSize, onToggleHidden, children }: {
  cfg: WidgetCfg; editMode: boolean;
  onMoveUp: () => void; onMoveDown: () => void;
  onToggleSize: () => void; onToggleHidden: () => void;
  children: React.ReactNode;
}) {
  const meta = WIDGET_META[cfg.id];
  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
      cfg.size === "full" ? "col-span-2" : "col-span-2 sm:col-span-1"
    } ${editMode ? "border-blue-200 ring-1 ring-blue-100" : "border-gray-100"}`}>
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50">
        <div className="flex items-center gap-2">
          <span className="text-base">{meta.icon}</span>
          <h3 className="text-xs font-bold text-gray-700">{meta.title}</h3>
        </div>
        {editMode && (
          <div className="flex items-center gap-1">
            <button onClick={onMoveUp} className="w-6 h-6 rounded text-gray-400 hover:bg-gray-100 text-xs flex items-center justify-center" title="Subir">↑</button>
            <button onClick={onMoveDown} className="w-6 h-6 rounded text-gray-400 hover:bg-gray-100 text-xs flex items-center justify-center" title="Bajar">↓</button>
            <button onClick={onToggleSize}
              className="px-2 py-0.5 rounded text-[10px] font-bold border border-gray-200 text-gray-500 hover:bg-gray-100 transition">
              {cfg.size === "half" ? "Ancho completo" : "Mitad"}
            </button>
            <button onClick={onToggleHidden}
              className="w-6 h-6 rounded text-gray-400 hover:bg-red-50 hover:text-red-400 text-xs flex items-center justify-center" title="Ocultar">✕</button>
          </div>
        )}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────── */
export function DashboardTab({ clinicId }: { clinicId: string }) {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [todayBookings, setTodayBookings] = useState<TodayBooking[]>([]);
  const [editMode, setEditMode] = useState(false);

  const storageKey = `molaris-dashboard-${clinicId}`;

  const [widgets, setWidgets] = useState<WidgetCfg[]>(() => {
    if (typeof window === "undefined") return DEFAULT_WIDGETS;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const saved: WidgetCfg[] = JSON.parse(raw);
        const ids = DEFAULT_WIDGETS.map((w) => w.id);
        const merged = DEFAULT_WIDGETS.map((def) => saved.find((s) => s.id === def.id) ?? def);
        return merged.sort((a, b) => a.order - b.order);
      }
    } catch { /* fallback */ }
    return DEFAULT_WIDGETS;
  });

  function saveWidgets(next: WidgetCfg[]) {
    const ordered = next.map((w, i) => ({ ...w, order: i }));
    setWidgets(ordered);
    try { localStorage.setItem(storageKey, JSON.stringify(ordered)); } catch { /* ignore */ }
  }

  function moveUp(idx: number) {
    if (idx === 0) return;
    const next = [...widgets];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    saveWidgets(next);
  }

  function moveDown(idx: number) {
    if (idx >= widgets.length - 1) return;
    const next = [...widgets];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    saveWidgets(next);
  }

  function toggleSize(idx: number) {
    const next = widgets.map((w, i) => i === idx ? { ...w, size: w.size === "half" ? "full" : "half" as WidgetSize } : w);
    saveWidgets(next);
  }

  function toggleHidden(idx: number) {
    const next = widgets.map((w, i) => i === idx ? { ...w, hidden: !w.hidden } : w);
    saveWidgets(next);
  }

  const fetchData = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    try {
      const [analyticsRes, agendaRes] = await Promise.all([
        fetch(`${API}/api/clinics/${clinicId}/analytics`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/agenda/week?start=${getMondayStr()}`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
      if (agendaRes.ok) {
        const data = await agendaRes.json();
        const todayStr = new Date().toISOString().slice(0, 10);
        const todayDay = (data.days ?? []).find((d: { date: string; bookings: TodayBooking[] }) =>
          String(d.date).slice(0, 10) === todayStr
        );
        setTodayBookings((todayDay?.bookings ?? []).sort((a: TodayBooking, b: TodayBooking) =>
          a.time.localeCompare(b.time)
        ));
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const visible = widgets.filter((w) => !w.hidden);
  const hidden  = widgets.filter((w) => w.hidden);

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-black text-gray-900">Resumen del día</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {new Date().toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {loading && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
          <button
            onClick={() => setEditMode((v) => !v)}
            className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition ${
              editMode ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
            }`}>
            {editMode ? "✓ Listo" : "⊞ Personalizar"}
          </button>
        </div>
      </div>

      {/* Widget grid */}
      <div className="grid grid-cols-2 gap-4">
        {visible.map((cfg, idx) => (
          <WidgetCard key={cfg.id} cfg={cfg} editMode={editMode}
            onMoveUp={() => moveUp(idx)} onMoveDown={() => moveDown(idx)}
            onToggleSize={() => toggleSize(idx)} onToggleHidden={() => toggleHidden(idx)}>
            {cfg.id === "today"    && <TodayWidget bookings={todayBookings} />}
            {cfg.id === "revenue"  && <RevenueWidget analytics={analytics} />}
            {cfg.id === "patients" && <PatientsWidget analytics={analytics} />}
            {cfg.id === "pending"  && <PendingWidget analytics={analytics} />}
            {cfg.id === "doctors"  && <DoctorsWidget analytics={analytics} />}
            {cfg.id === "services" && <ServicesWidget analytics={analytics} />}
          </WidgetCard>
        ))}
      </div>

      {/* Hidden widgets — shown only in edit mode */}
      {editMode && hidden.length > 0 && (
        <div className="border border-dashed border-gray-200 rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3">Widgets ocultos</p>
          <div className="flex flex-wrap gap-2">
            {hidden.map((cfg) => (
              <button key={cfg.id} onClick={() => toggleHidden(widgets.indexOf(cfg))}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-xs text-gray-500 hover:border-blue-300 hover:text-blue-600 transition">
                <span>{WIDGET_META[cfg.id].icon}</span>
                <span>{WIDGET_META[cfg.id].title}</span>
                <span className="text-gray-300">+</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function getMondayStr(): string {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? 1 : 1 - day));
  return d.toISOString().slice(0, 10);
}
