"use client";

import { useEffect, useState, useCallback } from "react";
import { getToken } from "@/lib/auth";
import { toLocalDateStr } from "@/lib/dateParser";
import { cx } from "@/lib/cx";
import { peldanoDeUrgencia, restanteHasta } from "@/lib/plazos";
import { esperaConfirmacion } from "@/lib/solicitudes";
import { DentalQuoteTab } from "./DentalQuoteTab";
import { PatientAutocomplete } from "./PatientAutocomplete";
import { BotonCerrar, Button, CLASE_CAMPO, CLASE_ETIQUETA, Field, useDialogo } from "./ui";
import {
  DoctorsWidget, IncomeChartWidget, LeadsWidget, PatientsWidget, PendingWidget, RevenueWidget,
  ServicesWidget, TodayWidget, type Analytics, type TodayBooking,
} from "./inicio/Widgets";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type WidgetId = "today" | "revenue" | "patients" | "pending" | "doctors" | "services" | "income-chart" | "leads";
type WidgetSize = "half" | "full";

interface WidgetCfg { id: WidgetId; size: WidgetSize; order: number; hidden: boolean; }

const DEFAULT_WIDGETS: WidgetCfg[] = [
  { id: "today",        size: "half", order: 0, hidden: false },
  { id: "revenue",      size: "half", order: 1, hidden: false },
  { id: "leads",        size: "full", order: 2, hidden: false },
  { id: "income-chart", size: "full", order: 3, hidden: false },
  { id: "patients",     size: "half", order: 4, hidden: false },
  { id: "pending",      size: "half", order: 5, hidden: false },
  { id: "doctors",      size: "full", order: 6, hidden: false },
  { id: "services",     size: "half", order: 7, hidden: false },
];

const WIDGET_TITULO: Record<WidgetId, string> = {
  today:          "Citas de hoy",
  revenue:        "Ingresos del mes",
  leads:          "Asistente de IA",
  "income-chart": "Cobrado en los últimos 6 meses",
  patients:       "Pacientes",
  pending:        "Por cobrar",
  doctors:        "Citas por profesional",
  services:       "Servicios más pedidos",
};

/* ─── Tarjeta de un widget, con sus controles al personalizar ──────────── */
function WidgetCard({ cfg, editMode, primero, ultimo, onMoveUp, onMoveDown, onToggleSize, onToggleHidden, loading, children }: {
  cfg: WidgetCfg; editMode: boolean; primero: boolean; ultimo: boolean;
  onMoveUp: () => void; onMoveDown: () => void;
  onToggleSize: () => void; onToggleHidden: () => void;
  loading: boolean;
  children: React.ReactNode;
}) {
  const titulo = WIDGET_TITULO[cfg.id];
  const ctrl = "min-h-11 rounded-control border border-line px-2.5 text-[13px] font-semibold text-ink transition-colors hover:border-brand focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-40 sm:min-h-8";
  return (
    <section aria-label={titulo}
      className={cx("flex flex-col rounded-card border bg-surface", cfg.size === "full" ? "col-span-2" : "col-span-2 sm:col-span-1",
        editMode ? "border-brand border-dashed" : "border-line")}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4 pb-2">
        <h3 className="text-base font-bold text-brand-strong">{titulo}</h3>
        {editMode && (
          <div className="flex flex-wrap items-center gap-1">
            <button type="button" onClick={onMoveUp} disabled={primero} aria-label={`Subir ${titulo}`} className={ctrl}>↑</button>
            <button type="button" onClick={onMoveDown} disabled={ultimo} aria-label={`Bajar ${titulo}`} className={ctrl}>↓</button>
            <button type="button" onClick={onToggleSize} className={cx(ctrl, "max-sm:hidden")}>{cfg.size === "half" ? "Ancho completo" : "Media columna"}</button>
            <button type="button" onClick={onToggleHidden} className={ctrl}>Ocultar</button>
          </div>
        )}
      </div>
      <div className="flex-1 px-5 pb-5">
        {loading ? (
          <div className="flex flex-col gap-2" aria-hidden>
            <div className="h-8 w-1/2 rounded-control bg-gray-100" /><div className="h-4 rounded-control bg-gray-100" /><div className="h-4 w-3/4 rounded-control bg-gray-100" />
          </div>
        ) : children}
      </div>
    </section>
  );
}

/* ─── Presupuesto rápido ─────────────────────────────────────────────── */
function QuickQuoteModal({ onClose }: { onClose: () => void }) {
  const ref = useDialogo(onClose);
  const [step, setStep] = useState<"form" | "quote">("form");
  const [name, setName] = useState("");
  const [rut,  setRut]  = useState("");
  // Acá el autocompletar no es solo comodidad: el presupuesto se enlaza a la
  // ficha por RUT, así que uno tipeado distinto (o en blanco) deja el
  // presupuesto colgando de nadie en vez de sumarse al historial del paciente.
  const [pacienteExistente, setPacienteExistente] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setStep("quote");
  }

  return (
    <div ref={ref} tabIndex={-1} className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-surface outline-none" role="dialog" aria-modal="true" aria-label="Nuevo presupuesto">
      <div className="flex shrink-0 items-center justify-between border-b border-line py-2 pr-2 pl-5">
        <h2 className="text-lg font-bold text-brand-strong">{step === "form" ? "Nuevo presupuesto" : name}</h2>
        <BotonCerrar onClick={onClose} />
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain p-4">
        {step === "form" ? (
          <form onSubmit={submit} className="mx-auto mt-6 flex max-w-sm flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <span className={CLASE_ETIQUETA}>Nombre del paciente</span>
              <PatientAutocomplete
                value={name}
                seleccionado={pacienteExistente}
                inputClassName={CLASE_CAMPO}
                autoFocus
                onChange={setName}
                onSelect={(p) => { setName(p.name); setRut(p.rut ?? ""); setPacienteExistente(true); }}
                onClear={() => { setName(""); setRut(""); setPacienteExistente(false); }}
              />
            </div>
            <Field label="RUT (opcional)" value={rut} onChange={(e) => setRut(e.target.value)} placeholder="12.345.678-9"
              readOnly={pacienteExistente} autoComplete="off" spellCheck={false}
              className={pacienteExistente ? "bg-ground text-ink-muted" : undefined}
              hint={pacienteExistente && !rut ? "Este paciente no tiene RUT guardado: el presupuesto no va a quedar enlazado a su ficha." : undefined} />
            <Button type="submit" block disabled={!name.trim()}>Continuar</Button>
          </form>
        ) : (
          <DentalQuoteTab patient={{ name: name.trim(), rut: rut.trim() || null }} />
        )}
      </div>
    </div>
  );
}

/* ─── Inicio ─────────────────────────────────────────────────────────── */
export function DashboardTab({
  clinicId,
  onNewBooking,
  onNewPatient,
  onVerAgenda,
}: {
  clinicId: string;
  onNewBooking?: () => void;
  onNewPatient?: () => void;
  /** Lleva a la agenda (para responder lo que espera confirmación). */
  onVerAgenda?: () => void;
}) {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [todayBookings, setTodayBookings] = useState<TodayBooking[]>([]);
  const [porConfirmar, setPorConfirmar] = useState<{ deadline: string | null }[]>([]);
  // Sin esto, una agenda que no cargó se leía como "0 citas hoy".
  const [agendaCargada, setAgendaCargada] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [showQuote, setShowQuote] = useState(false);

  const storageKey = `molaris-dashboard-${clinicId}`;

  const [widgets, setWidgets] = useState<WidgetCfg[]>(() => {
    if (typeof window === "undefined") return DEFAULT_WIDGETS;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const saved: WidgetCfg[] = JSON.parse(raw);
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

  // Mover entre los visibles: con widgets ocultos de por medio, "subir" no
  // debe intercambiar con uno que no se ve.
  function mover(id: WidgetId, paso: -1 | 1) {
    const vis = widgets.filter((w) => !w.hidden);
    const i = vis.findIndex((w) => w.id === id);
    const otro = vis[i + paso];
    if (!otro) return;
    const a = widgets.findIndex((w) => w.id === id), b = widgets.findIndex((w) => w.id === otro.id);
    const next = [...widgets];
    [next[a], next[b]] = [next[b], next[a]];
    saveWidgets(next);
  }

  function toggleSize(id: WidgetId) {
    saveWidgets(widgets.map((w) => w.id === id ? { ...w, size: w.size === "half" ? "full" : "half" as WidgetSize } : w));
  }

  function toggleHidden(id: WidgetId) {
    saveWidgets(widgets.map((w) => w.id === id ? { ...w, hidden: !w.hidden } : w));
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
        const todayStr = toLocalDateStr(new Date());
        const days: { date: string; bookings: (TodayBooking & { confirmDeadline?: string | null })[] }[] = data.days ?? [];
        const todayDay = days.find((d) => String(d.date).slice(0, 10) === todayStr);
        setTodayBookings((todayDay?.bookings ?? []).sort((a, b) => a.time.localeCompare(b.time)));
        // Lo que el asistente dejó pedido esta semana y nadie ha respondido.
        setPorConfirmar(days.flatMap((d) => d.bookings).filter((b) => esperaConfirmacion({ status: b.status, requestedVia: b.requestedVia }))
          .map((b) => ({ deadline: b.confirmDeadline ?? null }))
          .sort((a, b) => (a.deadline ?? "").localeCompare(b.deadline ?? "")));
        setAgendaCargada(true);
      }
      setError(!analyticsRes.ok && !agendaRes.ok);
    } catch {
      setError(true);
    } finally { setLoading(false); }
  }, [clinicId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const visible = widgets.filter((w) => !w.hidden);
  const hidden  = widgets.filter((w) => w.hidden);
  const hoy = new Date().toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });
  const citasHoy = todayBookings.filter((b) => b.status !== "cancelled").length;
  const masApurada = porConfirmar[0];
  const queda = masApurada ? restanteHasta(masApurada.deadline) : null;
  const peldano = masApurada ? peldanoDeUrgencia(masApurada.deadline) ?? 1 : 1;
  const sinDatos = loading && !analytics;

  return (
    <div className="flex flex-col gap-5">
      {/* Qué día es y qué hay, con las acciones del día al lado */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-brand-strong">Hoy</h2>
          <p className="text-sm text-ink-muted tabular-nums">
            {hoy.charAt(0).toUpperCase() + hoy.slice(1)}{agendaCargada && ` · ${citasHoy} ${citasHoy === 1 ? "cita" : "citas"}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" className="max-sm:min-h-11" onClick={onNewBooking} disabled={!onNewBooking}>+ Agendar hora</Button>
          <Button size="sm" variant="secondary" className="max-sm:min-h-11" onClick={onNewPatient} disabled={!onNewPatient}>Registrar paciente</Button>
          <Button size="sm" variant="secondary" className="max-sm:min-h-11" onClick={() => setShowQuote(true)}>Hacer presupuesto</Button>
        </div>
      </div>

      {/* Lo que espera respuesta va primero: si nadie responde, se libera solo. */}
      {porConfirmar.length > 0 && (
        <div role="status" className={cx("flex flex-wrap items-center justify-between gap-3 rounded-card border border-dashed border-accent px-5 py-3",
          peldano === 3 ? "bg-accent-200" : peldano === 2 ? "bg-accent-soft" : "bg-accent-50")}>
          <p className="text-sm text-ink">
            <span className="inline-flex items-center gap-1.5 font-bold text-accent-ink">
              <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
              {porConfirmar.length === 1 ? "1 hora espera tu respuesta" : `${porConfirmar.length} horas esperan tu respuesta`}
            </span>
            {queda && <> · {queda.vencida ? "la primera ya venció" : <>la más apurada vence {queda.texto}</>}</>}
          </p>
          {onVerAgenda && <Button size="sm" variant="secondary" className="max-sm:min-h-11" onClick={onVerAgenda}>Responder en la agenda</Button>}
        </div>
      )}

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-surface px-5 py-4 text-sm text-ink">
          <p className="font-semibold">No pudimos cargar el resumen. Revisa tu conexión e inténtalo de nuevo.</p>
          <Button size="sm" variant="secondary" className="max-sm:min-h-11" loading={loading} onClick={fetchData}>Reintentar</Button>
        </div>
      )}

      {/* Si no llegó nada, no se muestran ceros que parecen datos reales. */}
      {!(error && !analytics && !agendaCargada) && <>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-brand-strong">Resumen</h2>
        <Button size="sm" variant={editMode ? "primary" : "ghost"} className="max-sm:min-h-11" onClick={() => setEditMode((v) => !v)}>
          {editMode ? "Listo" : "Personalizar"}
        </Button>
      </div>
      {editMode && <p className="-mt-3 text-[13px] text-ink-muted">Ordena, agranda u oculta cada bloque. Se guarda en este navegador.</p>}

      <div className="grid grid-cols-2 gap-4">
        {visible.map((cfg, idx) => (
          <WidgetCard key={cfg.id} cfg={cfg} editMode={editMode} primero={idx === 0} ultimo={idx === visible.length - 1}
            loading={sinDatos}
            onMoveUp={() => mover(cfg.id, -1)} onMoveDown={() => mover(cfg.id, 1)}
            onToggleSize={() => toggleSize(cfg.id)} onToggleHidden={() => toggleHidden(cfg.id)}>
            {cfg.id === "today"        && (agendaCargada || sinDatos
              ? <TodayWidget bookings={todayBookings} onVerAgenda={onVerAgenda} />
              : <p className="text-sm text-ink-muted">No pudimos cargar las citas de hoy.</p>)}
            {cfg.id === "revenue"      && <RevenueWidget analytics={analytics} />}
            {cfg.id === "leads"        && <LeadsWidget analytics={analytics} />}
            {cfg.id === "patients"     && <PatientsWidget analytics={analytics} />}
            {cfg.id === "pending"      && <PendingWidget analytics={analytics} />}
            {cfg.id === "doctors"      && <DoctorsWidget analytics={analytics} />}
            {cfg.id === "services"     && <ServicesWidget analytics={analytics} />}
            {cfg.id === "income-chart" && <IncomeChartWidget analytics={analytics} />}
          </WidgetCard>
        ))}
      </div>

      {editMode && hidden.length > 0 && (
        <div className="rounded-card border border-dashed border-line p-4">
          <p className="mb-3 text-sm font-semibold text-ink">Bloques ocultos</p>
          <div className="flex flex-wrap gap-2">
            {hidden.map((cfg) => (
              <Button key={cfg.id} size="sm" variant="secondary" className="max-sm:min-h-11" onClick={() => toggleHidden(cfg.id)}>
                + {WIDGET_TITULO[cfg.id]}
              </Button>
            ))}
          </div>
        </div>
      )}
      </>}

      {showQuote && <QuickQuoteModal onClose={() => setShowQuote(false)} />}
    </div>
  );
}

function getMondayStr(): string {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? 1 : 1 - day));
  return toLocalDateStr(d);
}
