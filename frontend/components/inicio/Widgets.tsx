import { cx } from "@/lib/cx";
import { nombreCorto } from "@/lib/agendaVista";
import { StatusPill } from "../dashboard/widgets";

/* ─── Tipos ─────────────────────────────────────────────────────────────── */
export interface Analytics {
  totals?: { sessions: number; leads: number; readyToBook: number; slotBooked: number; bookings: number; avgScore: number };
  conversionRate?: number;
  bookingRate?: number;
  payments?: {
    thisMonth: { income: number; count: number };
    lastMonth: { income: number; count: number };
    byStatus: { status: string | null; count: number; totalCharged: number; totalPaid: number }[];
    incomeByMonth?: { month: string; income: number; count: number }[];
  };
  doctors?: { doctor: string; bookings: number; cancelled: number; income: number }[];
  operations?: { cancellationRate: number; avgTicket: number; paidBookings: number };
  patients?: { total: number; newThisMonth: number; retentionRate: number };
  services?: { service: string; count: number; income: number }[];
  channels?: { channel: string; sessions: number; leads: number; booked: number; conversionRate: number }[];
}

export interface TodayBooking {
  id: string; time: string; patientName: string | null;
  doctor: string; service: string | null; status: string;
  requestedVia?: string | null;
}

/** Pesos completos ("$85.000"): antes "$85k", y un mes sin ingresos decía "$0k". */
const CLP = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
export const fmtCLP = (n: number) => CLP.format(n);
const num = (n: number) => n.toLocaleString("es-CL");

const CANAL: Record<string, string> = { web: "Web", whatsapp: "WhatsApp", instagram: "Instagram", sandbox: "Pruebas" };

/* ─── Piezas ───────────────────────────────────────────────────────────── */

/** Barra de proporción en el único tono del dato (azul petróleo), sin arcoíris. */
// Decorativa: el número exacto ya está escrito al lado, así que el lector de
// pantalla no la lee (un "100%" relativo al mayor confundía más que ayudaba).
function Barra({ value, max, tenue }: { value: number; max: number; tenue?: boolean }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-line-soft" aria-hidden>
      <div className={cx("h-full rounded-full", tenue ? "bg-ink-muted/35" : "bg-brand")} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Un número con su etiqueta. `cambio` dice si subir es bueno o malo. */
export function Kpi({ label, value, sub, cambio, grande = false }: {
  label: string; value: string; sub?: string;
  cambio?: { texto: string; bueno: boolean | null };
  grande?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[13px] text-ink-muted">{label}</p>
      <p className={cx("font-semibold leading-tight text-ink tabular-nums", grande ? "text-[28px]" : "text-2xl")}>{value}</p>
      {cambio && (
        <p className={cx("text-[13px] font-semibold tabular-nums", cambio.bueno === null ? "text-ink-muted" : cambio.bueno ? "text-ok" : "text-danger")}>
          {cambio.texto}
        </p>
      )}
      {sub && <p className="text-[13px] text-ink-muted">{sub}</p>}
    </div>
  );
}

const Vacio = ({ texto }: { texto: string }) => (
  <p className="rounded-control border border-dashed border-line px-4 py-3 text-sm text-ink-muted">{texto}</p>
);

/* ─── Widgets ──────────────────────────────────────────────────────────── */
export function TodayWidget({ bookings, onVerAgenda }: { bookings: TodayBooking[]; onVerAgenda?: () => void }) {
  const active = bookings.filter((b) => b.status !== "cancelled");
  return (
    <div className="flex h-full flex-col">
      {active.length === 0 ? (
        <Vacio texto="No hay citas agendadas para hoy." />
      ) : (
        <ul>
          {active.slice(0, 6).map((b) => (
            <li key={b.id} className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3 border-t border-line-soft py-2.5 first:border-t-0">
              <span className="text-sm font-semibold text-ink tabular-nums">{b.time}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-ink">{b.patientName ?? "Sin nombre"}</span>
                <span className="block truncate text-[13px] text-ink-muted">{[nombreCorto(b.doctor), b.service].filter(Boolean).join(" · ")}</span>
              </span>
              {/* Solo se marca lo que no es una cita confirmada normal. */}
              {b.status !== "confirmed" ? <StatusPill status={b.status} requestedVia={b.requestedVia} /> : <span />}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-auto flex items-center justify-between gap-3 pt-3 text-[13px] text-ink-muted">
        <span className="tabular-nums">
          {active.length > 6 ? `Y ${active.length - 6} más · ` : ""}{active.length} {active.length === 1 ? "cita" : "citas"} hoy
        </span>
        {onVerAgenda && (
          <button type="button" onClick={onVerAgenda}
            className="min-h-11 font-semibold text-brand hover:underline focus-visible:outline-2 focus-visible:outline-brand sm:min-h-8">
            Ver agenda ›
          </button>
        )}
      </div>
    </div>
  );
}

export function RevenueWidget({ analytics }: { analytics: Analytics | null }) {
  const thisMonth = analytics?.payments?.thisMonth;
  const lastMonth = analytics?.payments?.lastMonth;
  const diff = thisMonth && lastMonth && lastMonth.income > 0 ? thisMonth.income - lastMonth.income : null;
  const pct = diff != null && lastMonth ? Math.round((diff / lastMonth.income) * 100) : null;
  return (
    <div className="flex flex-col gap-4">
      <Kpi grande label="Cobrado este mes" value={thisMonth ? fmtCLP(thisMonth.income) : "—"}
        cambio={pct != null ? { texto: `${pct > 0 ? "+" : ""}${pct}% frente al mes pasado`, bueno: pct === 0 ? null : pct > 0 } : undefined} />
      <dl className="grid grid-cols-2 gap-3">
        <div><dt className="text-[13px] text-ink-muted">Citas cobradas</dt><dd className="text-lg font-semibold text-ink tabular-nums">{thisMonth ? num(thisMonth.count) : "—"}</dd></div>
        <div><dt className="text-[13px] text-ink-muted">Ticket promedio</dt><dd className="text-lg font-semibold text-ink tabular-nums">{analytics?.operations?.avgTicket ? fmtCLP(analytics.operations.avgTicket) : "—"}</dd></div>
      </dl>
      {lastMonth && (
        <p className="text-[13px] text-ink-muted tabular-nums">Mes pasado: {fmtCLP(lastMonth.income)} en {num(lastMonth.count)} {lastMonth.count === 1 ? "cita" : "citas"}</p>
      )}
    </div>
  );
}

export function PatientsWidget({ analytics }: { analytics: Analytics | null }) {
  const p = analytics?.patients;
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-3">
        <div><dt className="text-[13px] text-ink-muted">En total</dt><dd className="text-2xl font-semibold text-ink tabular-nums">{p ? num(p.total) : "—"}</dd></div>
        <div>
          <dt className="text-[13px] text-ink-muted">Nuevos este mes</dt>
          <dd className="text-2xl font-semibold text-ink tabular-nums">{p ? num(p.newThisMonth) : "—"}</dd>
        </div>
      </dl>
      {p && (
        <div>
          <div className="mb-1 flex items-baseline justify-between text-[13px]">
            <span className="text-ink-muted">Vuelven a atenderse</span>
            <span className="font-semibold text-ink tabular-nums">{p.retentionRate}%</span>
          </div>
          <Barra value={p.retentionRate} max={100} />
        </div>
      )}
    </div>
  );
}

export function PendingWidget({ analytics }: { analytics: Analytics | null }) {
  const byStatus = analytics?.payments?.byStatus ?? [];
  const pending = byStatus.find((s) => !s.status || s.status === "pending");
  const partial = byStatus.find((s) => s.status === "partial");
  const pendingAmount = (pending?.totalCharged ?? 0) - (pending?.totalPaid ?? 0);
  const partialAmount = (partial?.totalCharged ?? 0) - (partial?.totalPaid ?? 0);
  const total = pendingAmount + partialAmount;
  const count = (pending?.count ?? 0) + (partial?.count ?? 0);
  return (
    <div className="flex flex-col gap-4">
      <Kpi grande label="Saldo pendiente" value={fmtCLP(total)}
        sub={count === 0 ? "No hay citas con saldo." : `${num(count)} ${count === 1 ? "cita con saldo" : "citas con saldo"}`} />
      {count > 0 && (
        <dl className="text-[13px]">
          {pending && pending.count > 0 && (
            <div className="flex justify-between gap-3 border-t border-line-soft py-1.5">
              <dt className="text-ink-muted">Sin ningún pago ({num(pending.count)})</dt>
              <dd className="font-semibold text-ink tabular-nums">{fmtCLP(pendingAmount)}</dd>
            </div>
          )}
          {partial && partial.count > 0 && (
            <div className="flex justify-between gap-3 border-t border-line-soft py-1.5">
              <dt className="text-ink-muted">Pagaron una parte ({num(partial.count)})</dt>
              <dd className="font-semibold text-ink tabular-nums">{fmtCLP(partialAmount)}</dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
}

export function DoctorsWidget({ analytics }: { analytics: Analytics | null }) {
  // "Sin asignar" va al final y no fija la escala: si no, sus citas antiguas
  // dejan a todos los profesionales con una barra casi vacía.
  const sinAsignar = (d: { doctor: string }) => !d.doctor || d.doctor === "Sin asignar";
  const docs = [...(analytics?.doctors ?? [])].sort((a, b) => Number(sinAsignar(a)) - Number(sinAsignar(b)));
  const conNombre = docs.filter((d) => !sinAsignar(d));
  const maxBookings = Math.max(...(conNombre.length ? conNombre : docs).map((d) => d.bookings), 1);
  const cancel = analytics?.operations?.cancellationRate;
  if (docs.length === 0) return <Vacio texto="Todavía no hay citas para mostrar por profesional." />;
  return (
    <div className="flex flex-col gap-4">
      {cancel != null && (
        <p className="text-[13px] text-ink-muted">
          Cancelaciones e inasistencias: <span className={cx("font-semibold tabular-nums", cancel > 20 ? "text-danger" : "text-ink")}>{cancel}%</span> de las citas
        </p>
      )}
      <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
        {docs.map((d) => (
          <li key={d.doctor}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
              <span className={cx("truncate font-semibold", sinAsignar(d) ? "text-ink-muted" : "text-ink")}>{sinAsignar(d) ? "Sin profesional asignado" : nombreCorto(d.doctor)}</span>
              <span className="shrink-0 text-ink-muted tabular-nums">
                {num(d.bookings)} {d.bookings === 1 ? "cita" : "citas"}{d.income > 0 ? ` · ${fmtCLP(d.income)}` : ""}
              </span>
            </div>
            <Barra value={d.bookings} max={maxBookings} tenue={sinAsignar(d)} />
            {d.cancelled > 0 && (
              <p className="mt-0.5 text-xs text-ink-muted tabular-nums">{d.cancelled} {d.cancelled === 1 ? "cancelada" : "canceladas"}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function IncomeChartWidget({ analytics }: { analytics: Analytics | null }) {
  const data = analytics?.payments?.incomeByMonth ?? [];
  if (data.length === 0 || data.every((d) => d.income === 0)) {
    return <Vacio texto="Todavía no hay pagos registrados en los últimos 6 meses." />;
  }
  const max = Math.max(...data.map((d) => d.income), 1);
  const total = data.reduce((s, d) => s + d.income, 0);
  return (
    <div className="flex flex-col gap-3">
      {/* Columnas en un solo tono; el mes en curso en el tono lleno y el resto
          más claro. Antes cada mes tenía otro color, que no significaba nada. */}
      <ul className="flex h-40 items-end gap-2 border-b border-line" aria-label="Cobrado por mes">
        {data.map((d, i) => {
          const actual = i === data.length - 1;
          return (
            <li key={d.month} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <span className="text-xs text-ink-muted tabular-nums">{d.income > 0 ? fmtCLP(d.income) : "$0"}</span>
              <span className={cx("w-full max-w-14 rounded-t", actual ? "bg-brand" : "bg-brand/35")}
                style={{ height: `${Math.max(2, Math.round((d.income / max) * 100))}%` }} aria-hidden />
            </li>
          );
        })}
      </ul>
      <ul className="-mt-1 flex gap-2" aria-hidden>
        {data.map((d) => <li key={d.month} className="flex-1 text-center text-xs text-ink-muted">{MESES[parseInt(d.month.split("-")[1], 10) - 1]}</li>)}
      </ul>
      <p className="text-[13px] text-ink-muted tabular-nums">
        En 6 meses: <span className="font-semibold text-ink">{fmtCLP(total)}</span> en {num(data.reduce((s, d) => s + d.count, 0))} citas cobradas
      </p>
    </div>
  );
}

export function LeadsWidget({ analytics }: { analytics: Analytics | null }) {
  const totals   = analytics?.totals;
  const channels = (analytics?.channels ?? []).filter((c) => c.sessions > 0);
  const sessions = totals?.sessions ?? 0;
  const leads    = totals?.leads ?? 0;
  const booked   = totals?.slotBooked ?? 0;
  const convRate = sessions > 0 ? Math.round((leads / sessions) * 100) : 0;
  const bookRate = leads    > 0 ? Math.round((booked / leads) * 100) : 0;
  const maxCh    = Math.max(...channels.map((c) => c.sessions), 1);

  return (
    <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <dl className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-1">
        <div><dt className="text-[13px] text-ink-muted">Conversaciones</dt><dd className="text-2xl font-semibold text-ink tabular-nums">{num(sessions)}</dd></div>
        <div>
          <dt className="text-[13px] text-ink-muted">Dejaron sus datos</dt>
          <dd className="text-2xl font-semibold text-ink tabular-nums">{num(leads)}</dd>
          {sessions > 0 && <dd className="text-[13px] text-ink-muted">{convRate}% de las conversaciones</dd>}
        </div>
        <div>
          <dt className="text-[13px] text-ink-muted">Pidieron hora en el chat</dt>
          <dd className="text-2xl font-semibold text-ink tabular-nums">{num(booked)}</dd>
          {leads > 0 && <dd className="text-[13px] text-ink-muted">{bookRate}% de quienes dejaron datos</dd>}
        </div>
      </dl>

      <div>
        <p className="mb-2 text-sm font-semibold text-ink">Por canal</p>
        {channels.length === 0 ? (
          <Vacio texto="Todavía no hay conversaciones con el asistente." />
        ) : (
          <ul className="flex flex-col gap-3">
            {channels.map((c) => (
              <li key={c.channel}>
                <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 text-[13px]">
                  <span className="font-semibold text-ink">{CANAL[c.channel] ?? c.channel}</span>
                  <span className="text-ink-muted tabular-nums">
                    {num(c.sessions)} conv. · {num(c.leads)} con datos{c.booked > 0 ? ` · ${num(c.booked)} pidieron hora` : ""}
                  </span>
                </div>
                <Barra value={c.sessions} max={maxCh} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function ServicesWidget({ analytics }: { analytics: Analytics | null }) {
  const svcs = (analytics?.services ?? []).slice(0, 6);
  const maxCount = Math.max(...svcs.map((s) => s.count), 1);
  if (svcs.length === 0) return <Vacio texto="Todavía no hay servicios registrados en las citas." />;
  return (
    <ul className="flex flex-col gap-3">
      {svcs.map((s) => (
        <li key={s.service}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="truncate text-ink">{s.service}</span>
            <span className="shrink-0 text-ink-muted tabular-nums">{num(s.count)} {s.count === 1 ? "vez" : "veces"}</span>
          </div>
          <Barra value={s.count} max={maxCount} />
        </li>
      ))}
    </ul>
  );
}
