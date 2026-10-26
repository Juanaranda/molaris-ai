import { useEffect, useState } from "react";
import { getToken, type AuthUser } from "@/lib/auth";
import { cx } from "@/lib/cx";
import { tramoDe } from "@/lib/agendaVista";
import { peldanoDeUrgencia } from "@/lib/plazos";
import { esperaConfirmacion } from "@/lib/solicitudes";
import { DAY_SHORT, getMondayOf, toDateStr } from "./fechas";
import { MarcaEstado, TINTE } from "./Marcas";
import type { BookingConDia, DayData } from "./tipos";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const aMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

function Fila({ b, ahora, conDia = false, pasada = false }: { b: BookingConDia; ahora: Date; conDia?: boolean; pasada?: boolean }) {
  const solicitud = esperaConfirmacion(b);
  return (
    <li className={cx(
      "grid min-h-14 grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2",
      solicitud ? cx("rounded-control", TINTE[peldanoDeUrgencia(b.confirmDeadline, ahora) ?? 1]) : "border-t border-line-soft first:border-t-0",
    )}>
      <span className={cx("text-sm font-semibold tabular-nums", pasada ? "text-ink-muted" : "text-ink")}>
        {conDia && <span className="block text-xs font-medium text-ink-muted">{DAY_SHORT[new Date(b.dateStr + "T12:00:00").getDay()]}</span>}
        {b.time}
      </span>
      <span className="min-w-0">
        <span className={cx("block truncate text-sm", pasada ? "font-medium text-ink-muted" : "font-semibold text-ink")}>{b.patientName ?? "Sin nombre"}</span>
        <span className={cx("block truncate text-[13px]", solicitud ? "text-ink" : "text-ink-muted")}>
          {[b.service, b.box ? `Box ${b.box}` : null].filter(Boolean).join(" · ") || "—"}
        </span>
        {/* El plazo es largo: en su propia línea para no cortar el nombre. */}
        {solicitud && <span className="mt-0.5 block"><MarcaEstado b={b} ahora={ahora} /></span>}
      </span>
      {!solicitud && <MarcaEstado b={b} ahora={ahora} />}
    </li>
  );
}

function Bloque({ id, titulo, meta, children }: { id: string; titulo: string; meta?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-card border border-line bg-surface">
      <div className="flex items-baseline justify-between gap-3 px-5 pt-4 pb-2">
        <h3 id={id} className="text-base font-bold text-brand-strong">{titulo}</h3>
        {meta && <span className="text-xs text-ink-muted tabular-nums">{meta}</span>}
      </div>
      <div className="px-2 pb-2">{children}</div>
    </section>
  );
}

const Vacio = ({ texto }: { texto: string }) => (
  <p className="mx-3 mb-2 rounded-control border border-dashed border-line px-4 py-3 text-sm text-ink-muted">{texto}</p>
);

/**
 * Vista del profesional (rol USER): su día. Arriba quién está en el box ahora
 * (o quién sigue), después lo que queda, lo que ya pasó y el resto de la semana.
 */
export function DoctorAgenda({ user }: { user: AuthUser }) {
  const [days, setDays]       = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  const [intento, setIntento] = useState(0);
  const [ahora, setAhora]     = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const token = getToken(); if (!token) return;
    const controller = new AbortController();
    fetch(`${API}/api/agenda/week?start=${toDateStr(getMondayOf(new Date()))}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error("non-200");
        return r.json();
      })
      .then((d) => setDays(d.days ?? []))
      .catch((err) => { if (err.name !== "AbortError") { setDays([]); setError(true); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [intento]);

  const todayStr = toDateStr(ahora);
  const allBookings: BookingConDia[] = days.flatMap((d) => d.bookings.map((b) => ({ ...b, dateStr: d.date })));
  const mine = allBookings.filter((b) => b.doctor === user.name && b.status !== "cancelled");
  const todayMine    = mine.filter((b) => b.dateStr === todayStr).sort((a, b) => a.time.localeCompare(b.time));
  const upcomingMine = mine.filter((b) => b.dateStr > todayStr).sort((a, b) =>
    a.dateStr === b.dateStr ? a.time.localeCompare(b.time) : a.dateStr.localeCompare(b.dateStr)
  );

  const nowMin = ahora.getHours() * 60 + ahora.getMinutes();
  const tramoAhora = tramoDe(`${Math.floor(nowMin / 60)}:${nowMin % 60}`);
  const enBox = todayMine.find((b) => tramoDe(b.time) === tramoAhora && !esperaConfirmacion(b));
  const pasadas = todayMine.filter((b) => b !== enBox && aMin(tramoDe(b.time)) + 30 <= nowMin);
  const siguen = todayMine.filter((b) => b !== enBox && !pasadas.includes(b));
  const lead = enBox ?? siguen.find((b) => !esperaConfirmacion(b));
  const resto = siguen.filter((b) => b !== lead);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-2xl font-bold text-brand-strong">Mi día</h2>
        <p className="text-sm text-ink-muted tabular-nums">
          {user.name} · {todayMine.length} {todayMine.length === 1 ? "cita" : "citas"} hoy
          {upcomingMine.length > 0 && ` · ${upcomingMine.length} más esta semana`}
        </p>
      </div>

      {error ? (
        <p className="rounded-card border border-line bg-surface px-5 py-4 text-sm text-ink">
          No pudimos cargar tu agenda.{" "}
          <button type="button" onClick={() => { setError(false); setLoading(true); setIntento((n) => n + 1); }} className="min-h-11 font-semibold text-brand underline underline-offset-2">Reintentar</button>
        </p>
      ) : loading ? (
        <div className="flex flex-col gap-3" aria-hidden>
          <div className="h-28 rounded-card bg-gray-100" />
          <div className="h-40 rounded-card bg-gray-100" />
        </div>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-5">
            {lead ? (
              <section aria-labelledby="mi-dia-lead" className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 rounded-card border border-line bg-surface p-5">
                <p id="mi-dia-lead" className="text-xs font-bold text-brand-ink">{lead === enBox ? "En el box ahora" : "Tu siguiente paciente"}</p>
                <p className="col-start-1 text-xl font-bold text-brand-strong">{lead.patientName ?? "Sin nombre"}</p>
                <p className="col-start-1 text-sm text-ink-muted">
                  {[lead.service, lead.box ? `Box ${lead.box}` : null].filter(Boolean).join(" · ")}
                </p>
                <p className="col-start-2 row-span-3 row-start-1 self-center text-xl font-bold text-ink tabular-nums">{lead.time}</p>
              </section>
            ) : (
              <Vacio texto={todayMine.length ? "No te quedan más citas hoy." : "No tienes citas para hoy."} />
            )}

            {resto.length > 0 && (
              <Bloque id="mi-dia-sigue" titulo="Lo que sigue hoy">
                <ul>{resto.map((b) => <Fila key={b.id} b={b} ahora={ahora} />)}</ul>
                {resto.some(esperaConfirmacion) && (
                  <p className="px-3 pt-1 pb-2 text-xs text-ink-muted">
                    Las marcadas en coral las pidió un paciente por el asistente: todavía no están confirmadas.
                  </p>
                )}
              </Bloque>
            )}

            <Bloque id="mi-dia-semana" titulo="Próximas citas esta semana">
              {upcomingMine.length ? <ul>{upcomingMine.map((b) => <Fila key={b.id} b={b} ahora={ahora} conDia />)}</ul> : <Vacio texto="Sin citas próximas esta semana." />}
            </Bloque>
          </div>

          {pasadas.length > 0 && (
            <Bloque id="mi-dia-antes" titulo="Más temprano" meta={pasadas.length === 1 ? "1 ya pasó" : `${pasadas.length} ya pasaron`}>
              <ul>{pasadas.map((b) => <Fila key={b.id} b={b} ahora={ahora} pasada />)}</ul>
            </Bloque>
          )}
        </div>
      )}
    </div>
  );
}
