"use client";

import { useEffect, useState, useCallback } from "react";
import { getToken } from "@/lib/auth";
import type { AuthUser } from "@/lib/auth";
import { invalidatePatientsCache } from "@/lib/patients";
import { minutosDesdeInicioDeGrilla } from "@/lib/agendaTime";
import { choquesDeBox } from "@/lib/agendaVista";
import { cx } from "@/lib/cx";
import { esperaConfirmacion } from "@/lib/solicitudes";
import { Button } from "@/components/ui";
import { BookingModal, QuickQuoteModal } from "./agenda/DetalleCita";
import { DiaPorBox } from "./agenda/DiaPorBox";
import { DAY_FULL, DAY_SHORT, MONTHS, getMondayOf, safeDateStr, toDateStr } from "./agenda/fechas";
import { DoctorAgenda } from "./agenda/MiDia";
import { NewBookingModal, type NuevaCitaDatos } from "./agenda/NuevaCita";
import { PorResponder } from "./agenda/PorResponder";
import { Profesionales } from "./agenda/Profesionales";
import { Semana } from "./agenda/Semana";
import type { Ahora, Booking, BookingConDia, DayData } from "./agenda/tipos";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// Default work hours fallback (used when clinic has no schedule config)
const DEFAULT_WORK_HOURS: Record<number, { start: number; end: number } | null> = {
  0: null, 1: { start: 9, end: 18 }, 2: { start: 9, end: 18 },
  3: { start: 9, end: 18 }, 4: { start: 9, end: 18 }, 5: { start: 9, end: 18 }, 6: null,
};

// Parse clinic schedule config (e.g. { monday: "Lunes: 09:00 - 18:00", saturday: "Sábado: cerrado" })
const DAY_KEY_TO_JS: Record<string, number> = {
  monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 0,
};
function parseWorkHours(cfg?: Record<string, string>): Record<number, { start: number; end: number } | null> {
  if (!cfg || Object.keys(cfg).length === 0) return DEFAULT_WORK_HOURS;
  const result: Record<number, { start: number; end: number } | null> = {
    0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null,
  };
  for (const [key, val] of Object.entries(cfg)) {
    const jsDay = DAY_KEY_TO_JS[key];
    if (jsDay == null) continue;
    if (!val || val.includes("cerrado")) { result[jsDay] = null; continue; }
    const m = val.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
    if (m) result[jsDay] = { start: parseInt(m[1]), end: parseInt(m[3]) };
  }
  return result;
}

// Half-hour slots from 09:00 to 18:30 (grid rows)
const GRID_SLOTS = Array.from({ length: 21 }, (_, i) => {
  const totalMins = 9 * 60 + i * 30;
  return `${String(Math.floor(totalMins / 60)).padStart(2, "0")}:${totalMins % 60 === 0 ? "00" : "30"}`;
});

/** Un solo lee-el-reloj para la línea de "ahora": posición y etiqueta juntas. */
function leerAhora(): Ahora {
  const d = new Date();
  return {
    mins: minutosDesdeInicioDeGrilla(GRID_SLOTS, d),
    label: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
    // La usa la cuenta regresiva de las horas por confirmar. Va acá y no en un
    // estado aparte para que ambas cosas latan con el mismo tick.
    fecha: d,
  };
}

function getWorkHours(dateStr: string, workHours: Record<number, { start: number; end: number } | null>) {
  const dow = new Date(dateStr + "T12:00:00").getDay();
  return workHours[dow] ?? null;
}

function isInWorkHours(slot: string, wh: { start: number; end: number } | null): boolean {
  if (!wh) return false;
  const [h, m] = slot.split(":").map(Number);
  const mins = h * 60 + m;
  return mins >= wh.start * 60 && mins < wh.end * 60;
}

/* ── Agenda de la clínica (admin y recepción) ──────────────────────────
   Opción A, "escalera coral": a la izquierda el día por box; a la derecha
   lo que espera respuesta, más coral mientras menos falta para que venza,
   y el filtro por profesional. */
function AdminAgenda({
  boxes,
  doctors: doctorNames = [],
  sedes = [],
  scheduleConfig,
  openNewBookingOnMount = false,
}: {
  boxes: number;
  doctors?: string[];
  sedes?: string[];
  scheduleConfig?: Record<string, string>;
  openNewBookingOnMount?: boolean;
}) {
  const workHours = parseWorkHours(scheduleConfig);
  const [weekStart, setWeekStart]     = useState(() => getMondayOf(new Date()));
  const [days, setDays]               = useState<DayData[]>([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(false);
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()));
  const [doctorFilter, setDoctorFilter] = useState<string | null>(null);
  // Filtro por sede (#69): la agenda es una sola aunque el doctor atienda en
  // varios lugares; esto la acota al lugar donde está hoy.
  const [sedeFilter, setSedeFilter] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showNew, setShowNew]         = useState(openNewBookingOnMount);
  const [quotePatient, setQuotePatient] = useState<{ name: string; rut: string | null } | null>(null);

  const fetchWeek = useCallback(async (start: Date, signal?: AbortSignal) => {
    const token = getToken(); if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/agenda/week?start=${toDateStr(start)}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      // Con error se vacía: dejar la semana anterior a la vista bajo el nombre
      // de la nueva haría creer que esas son las citas.
      if (res.ok) { const d = await res.json(); setDays(d.days ?? []); setError(false); }
      else { setDays([]); setError(true); }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setDays([]); setError(true);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchWeek(weekStart, controller.signal);
    return () => controller.abort();
  }, [weekStart, fetchWeek]);

  const todayStr = toDateStr(new Date());
  const weekEnd  = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 5);

  const weekLabel = (() => {
    const ws = weekStart; const we = weekEnd;
    const sm = MONTHS[ws.getMonth()]; const em = MONTHS[we.getMonth()];
    return ws.getMonth() === we.getMonth()
      ? `${ws.getDate()} al ${we.getDate()} de ${sm}`
      : `${ws.getDate()} de ${sm} al ${we.getDate()} de ${em}`;
  })();

  // Se recalcula cada minuto: una línea de "ahora" que se queda congelada
  // miente, y en una agenda eso es peor que no tenerla.
  // Posición y etiqueta salen del mismo tick: si la etiqueta llamara a
  // new Date() en el render, podría mostrar una hora distinta a la de la línea
  // —y además leer el reloj durante el render arriesga desajustes de hidratación.
  const [ahora, setAhora] = useState<Ahora>(() => leerAhora());
  useEffect(() => {
    const id = setInterval(() => setAhora(leerAhora()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Arranca en "día" en todos los anchos: el trabajo de recepción es el día
  // de hoy (quién está en cada box y qué espera respuesta). La semana sigue a
  // un toque, y en el celular sus 6 columnas en 375px no se leen.
  const [viewMode, setViewMode] = useState<"week" | "day">("day");

  // Un booking pasa los filtros activos (doctor y/o sede).
  const matchesFilters = (b: Booking) =>
    (!doctorFilter || b.doctor === doctorFilter) && (!sedeFilter || b.sede === sedeFilter);

  const selectedDay = days.find((d) => safeDateStr(d.date) === selectedDate);
  const dayAll = selectedDay?.bookings ?? [];
  const dayBookings = dayAll.filter(matchesFilters).sort((a, b) => a.time.localeCompare(b.time));
  // Los choques se buscan con todo el día, no con lo filtrado: si se filtra por
  // un doctor, igual hay que ver que su hora cae sobre la de otro en el box.
  const choquesDelDia = choquesDeBox(dayAll);
  const choquesPorDia = new Map(days.map((d) => [safeDateStr(d.date), choquesDeBox(d.bookings)]));

  function activeCnt(day: DayData) {
    return day.bookings.filter((b) => b.status !== "cancelled" && matchesFilters(b)).length;
  }

  async function handleSave(id: string, patch: {
    status: string; notes: string;
    paymentStatus: string; amountTotal: string; amountPaid: string; paymentMethod: string;
  }) {
    const token = getToken();
    const body: Record<string, unknown> = {
      status: patch.status,
      notes: patch.notes,
      paymentStatus: patch.paymentStatus,
      paymentMethod: patch.paymentMethod,
    };
    if (patch.amountTotal !== "") body.amountTotal = Number(patch.amountTotal);
    if (patch.amountPaid  !== "") body.amountPaid  = Number(patch.amountPaid);
    const res = await fetch(`${API}/api/agenda/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("Error al guardar");
    await fetchWeek(weekStart);
  }

  async function handleCancel(id: string) {
    const token = getToken();
    const res = await fetch(`${API}/api/agenda/bookings/${id}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Error al cancelar");
    await fetchWeek(weekStart);
  }

  async function handleCreate(data: NuevaCitaDatos) {
    const token = getToken();
    const res = await fetch(`${API}/api/agenda/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error ?? "Error"); }
    // Si era un paciente nuevo, tiene que salir en las sugerencias de la
    // próxima cita — si no, se vuelve a tipear igual y el autocompletar no sirve.
    invalidatePatientsCache();
    // Navigate to the week that contains the new booking
    const bookingWeekStart = getMondayOf(new Date(data.date + "T12:00:00"));
    if (toDateStr(bookingWeekStart) !== toDateStr(weekStart)) {
      setWeekStart(bookingWeekStart);
      // useEffect will trigger fetchWeek for the new weekStart
    } else {
      await fetchWeek(weekStart);
    }
    setSelectedDate(data.date);
  }

  const selectedLabel = (() => {
    const d = new Date(selectedDate + "T12:00:00");
    return `${DAY_FULL[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
  })();

  // Solicitudes del agente esperando decisión en la semana visible. Van en su
  // propia cola: si hay que buscarlas dentro de la grilla, se quedan sin
  // responder y caducan solas. Ordenadas por plazo: la primera es la que menos aguanta.
  const porConfirmar: BookingConDia[] = days
    .flatMap((d) => d.bookings.map((b) => ({ ...b, dateStr: safeDateStr(d.date) })))
    .filter(esperaConfirmacion)
    .sort((a, b) => (a.confirmDeadline ?? "").localeCompare(b.confirmDeadline ?? ""));

  const wh = getWorkHours(selectedDate, workHours);
  const activasDia = dayBookings.filter((b) => b.status !== "cancelled").length;
  const semanaActivas = days.reduce((s, d) => s + activeCnt(d), 0);
  const irAHoy = () => { setWeekStart(getMondayOf(new Date())); setSelectedDate(todayStr); };
  // El día elegido se mueve con la semana: si no, el título nombraría un día
  // que no está en la semana que se ve.
  const moverSemana = (dias: number) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + dias); setWeekStart(d);
    const s = new Date(selectedDate + "T12:00:00"); s.setDate(s.getDate() + dias); setSelectedDate(toDateStr(s));
  };

  // Conteo por profesional para el filtro: lo que se está viendo (el día o la semana).
  const enVista = viewMode === "day" ? dayAll : days.flatMap((d) => d.bookings);
  const conteo = (n: string | null) =>
    enVista.filter((b) => b.status !== "cancelled" && (!n || b.doctor === n) && (!sedeFilter || b.sede === sedeFilter)).length;

  const filtroProps = {
    nombres: doctorNames, conteo, filtro: doctorFilter, onFiltro: setDoctorFilter,
    etiquetaConteo: viewMode === "day" ? (selectedDate === todayStr ? "hoy" : "este día") : "esta semana",
  };

  const ctrl = "grid min-h-11 min-w-11 place-items-center px-3 text-sm font-semibold text-ink transition-colors hover:bg-ground focus-visible:outline-2 focus-visible:outline-brand sm:min-h-10";

  return (
    <div className="flex flex-col gap-5">
      {/* Título: el día que se mira y lo que espera respuesta, en una línea. */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-brand-strong">Agenda</h2>
          <p className="text-sm text-ink-muted tabular-nums">
            {viewMode === "day" ? selectedLabel : `Semana del ${weekLabel}`}
            {!error && !loading && (viewMode === "day"
              ? ` · ${activasDia} ${activasDia === 1 ? "cita" : "citas"}`
              : ` · ${semanaActivas} citas`)}
            {porConfirmar.length > 0 && (
              <> · <strong className="font-bold text-accent-ink">
                {porConfirmar.length === 1 ? "1 espera tu respuesta" : `${porConfirmar.length} esperan tu respuesta`}
              </strong></>
            )}
          </p>
        </div>
        {/* En el celular va junto al título: en la fila de controles no cabe. */}
        <Button className="shrink-0 sm:hidden" onClick={() => setShowNew(true)}>+ Nueva cita</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-stretch overflow-hidden rounded-control border border-line bg-surface">
            <button type="button" onClick={() => moverSemana(-7)} aria-label="Semana anterior" className={ctrl}>‹</button>
            <button type="button" onClick={irAHoy} className={cx(ctrl, "border-x border-line")}>Hoy</button>
            <button type="button" onClick={() => moverSemana(7)} aria-label="Semana siguiente" className={ctrl}>›</button>
          </div>
          <div role="group" aria-label="Vista" className="flex rounded-control bg-line-soft p-0.5">
            {(["day", "week"] as const).map((m) => (
              <button key={m} type="button" aria-pressed={viewMode === m} onClick={() => setViewMode(m)}
                className={cx("min-h-11 rounded-lg border px-3.5 text-[13px] sm:min-h-10 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-brand",
                  viewMode === m ? "border-line bg-surface text-ink" : "border-transparent text-ink-muted hover:text-ink")}>
                {m === "day" ? "Día" : "Semana"}
              </button>
            ))}
          </div>
          <Button size="sm" className="max-sm:hidden" onClick={() => setShowNew(true)}>+ Nueva cita</Button>
        </div>
      </div>

      {/* Días de la semana: solo en la vista día. */}
      {viewMode === "day" && (
        <div className="grid grid-cols-6 gap-1 sm:gap-2" role="group" aria-label={`Semana del ${weekLabel}`}>
          {loading && days.length === 0 ? Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 rounded-control bg-gray-100" />
          )) : days.map((day) => {
            const fecha = safeDateStr(day.date);
            const d = new Date(fecha + "T12:00:00");
            const isToday    = fecha === todayStr;
            const isSelected = fecha === selectedDate;
            const cnt = activeCnt(day);
            const espera = day.bookings.some((b) => esperaConfirmacion(b) && matchesFilters(b));
            return (
              <button key={day.date} type="button" aria-pressed={isSelected} onClick={() => setSelectedDate(fecha)}
                className={cx(
                  "flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-control border px-0.5 py-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-brand",
                  isSelected ? "border-brand bg-brand-soft" : "border-line bg-surface hover:border-brand",
                )}>
                <span className={cx("text-xs", isToday ? "font-bold text-brand-ink" : "text-ink-muted")}>{isToday ? "Hoy" : DAY_SHORT[d.getDay()]}</span>
                <span className="text-lg font-bold leading-none text-ink tabular-nums">{d.getDate()}</span>
                <span className="flex items-center gap-1 text-xs text-ink-muted tabular-nums">
                  {espera && <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-label="Hay horas por confirmar" />}
                  {cnt > 0 ? cnt : "—"}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Filtro por sede: solo si el doctor configuró más de un lugar */}
      {sedes.length > 1 && (
        <div role="group" aria-label="Sede" className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 sm:-mx-8 sm:px-8" style={{ scrollbarWidth: "none" }}>
          {[null, ...sedes].map((s) => (
            <button key={s ?? "todas"} type="button" aria-pressed={sedeFilter === s} onClick={() => setSedeFilter(sedeFilter === s ? null : s)}
              className={cx("min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-brand",
                sedeFilter === s ? "border-brand bg-brand-soft text-brand-ink" : "border-line bg-surface text-ink")}>
              {s ?? "Todas las sedes"}
            </button>
          ))}
        </div>
      )}

      {/* Día: el día y, a la derecha, la cola y el filtro. Semana: la grilla a lo
          ancho (seis días no caben con una columna al lado) y la cola abajo. */}
      <div className={cx("grid items-start gap-5", viewMode === "day" && "lg:grid-cols-[minmax(0,1fr)_300px]")}>
        <div className="order-2 flex min-w-0 flex-col gap-4 lg:order-1">
          <Profesionales variante="chips" soloCelular={viewMode === "day"} {...filtroProps} />
          {viewMode === "day" ? (
            <DiaPorBox
              citas={dayBookings}
              boxes={boxes}
              grilla={GRID_SLOTS}
              enHorario={(t) => isInWorkHours(t, wh)}
              esHoy={selectedDate === todayStr}
              ahora={ahora}
              choques={choquesDelDia}
              filtrandoDoctor={Boolean(doctorFilter)}
              loading={loading && days.length === 0}
              error={error}
              onRetry={() => fetchWeek(weekStart)}
              onOpen={setSelectedBooking}
              onNueva={() => setShowNew(true)}
            />
          ) : (
            <Semana
              days={days}
              grilla={GRID_SLOTS}
              todayStr={todayStr}
              filtra={matchesFilters}
              loading={loading && days.length === 0}
              error={error}
              onRetry={() => fetchWeek(weekStart)}
              onDia={(fecha) => { setSelectedDate(fecha); setViewMode("day"); }}
              onOpen={setSelectedBooking}
              onNueva={(fecha) => { setSelectedDate(fecha); setShowNew(true); }}
            />
          )}
        </div>
        <div className={cx("flex flex-col gap-5", viewMode === "day" ? "order-1 lg:order-2" : "order-3")}>
          <PorResponder
            items={porConfirmar}
            ahora={ahora.fecha}
            todayStr={todayStr}
            chocaCon={(b) => choquesPorDia.get(b.dateStr)?.get(b.id)}
            loading={loading && days.length === 0}
            error={error}
            onOpen={setSelectedBooking}
            enFila={viewMode === "week"}
          />
          {viewMode === "day" && <Profesionales variante="lista" {...filtroProps} />}
        </div>
      </div>

      {selectedBooking && (
        <BookingModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onSave={async (id, patch) => { await handleSave(id, patch); setSelectedBooking(null); }}
          onCancel={async (id) => { await handleCancel(id); setSelectedBooking(null); }}
          onDecided={() => { setSelectedBooking(null); fetchWeek(weekStart); }}
          onNewQuote={(p) => setQuotePatient(p)}
        />
      )}
      {quotePatient && (
        <QuickQuoteModal patient={quotePatient} onClose={() => setQuotePatient(null)} />
      )}
      {showNew && (
        <NewBookingModal
          doctors={doctorNames}
          initialDate={selectedDate}
          boxes={boxes}
          sedes={sedes}
          onClose={() => setShowNew(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}

/* ── Main export ─────────────────────────────────────────────────────── */
export function AgendaTab({
  user,
  boxes = 2,
  doctors,
  sedes,
  scheduleConfig,
  openNewBookingOnMount = false,
}: {
  user: AuthUser;
  boxes?: number;
  doctors?: string[];
  sedes?: string[];
  scheduleConfig?: Record<string, string>;
  openNewBookingOnMount?: boolean;
}) {
  const isAdmin = user.role === "ADMIN" || user.role === "SUPERADMIN";
  return isAdmin
    ? <AdminAgenda boxes={boxes} doctors={doctors} sedes={sedes} scheduleConfig={scheduleConfig} openNewBookingOnMount={openNewBookingOnMount} />
    : <DoctorAgenda user={user} />;
}
