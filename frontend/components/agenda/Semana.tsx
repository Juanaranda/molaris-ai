import { cx } from "@/lib/cx";
import { tramoDe } from "@/lib/agendaVista";
import { esperaConfirmacion } from "@/lib/solicitudes";
import { DAY_SHORT, safeDateStr } from "./fechas";
import type { Booking, DayData } from "./tipos";

/**
 * Vista semana: seis días por media hora. Con la misma escalera que el día:
 * lo que espera respuesta va con borde punteado coral, lo cancelado tachado.
 */
export function Semana({ days, grilla, todayStr, filtra, loading, error, onRetry, onDia, onOpen, onNueva }: {
  days: DayData[];
  grilla: string[];
  todayStr: string;
  filtra: (b: Booking) => boolean;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onDia: (fecha: string) => void;
  onOpen: (b: Booking) => void;
  onNueva: (fecha: string) => void;
}) {
  const cols = "grid-cols-[52px_repeat(6,minmax(0,1fr))]";
  return (
    <section aria-label="Semana" className="overflow-hidden rounded-card border border-line bg-surface">
      {error ? (
        <p className="px-5 py-4 text-sm text-ink">
          No pudimos cargar la agenda de esta semana.{" "}
          <button type="button" onClick={onRetry} className="min-h-11 font-semibold text-brand underline underline-offset-2">Reintentar</button>
        </p>
      ) : loading ? (
        <div className="flex flex-col gap-2 p-5" aria-hidden>
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-11 rounded-control bg-gray-100" />)}
        </div>
      ) : (
        <div className="max-h-[560px] overflow-auto">
          <div className="min-w-[620px]">
            <div className={cx("sticky top-0 z-10 grid border-b border-line bg-surface", cols)}>
              <div />
              {days.map((day) => {
                const fecha = safeDateStr(day.date);
                const d = new Date(fecha + "T12:00:00");
                const hoy = fecha === todayStr;
                const cnt = day.bookings.filter((b) => b.status !== "cancelled" && filtra(b)).length;
                const espera = day.bookings.some((b) => esperaConfirmacion(b) && filtra(b));
                return (
                  <button key={day.date} type="button" onClick={() => onDia(fecha)}
                    className={cx("flex min-h-14 flex-col items-center justify-center border-l border-line-soft py-1.5 transition-colors hover:bg-ground focus-visible:outline-2 focus-visible:outline-brand",
                      hoy && "bg-brand-soft")}>
                    <span className={cx("text-xs", hoy ? "font-semibold text-brand-ink" : "text-ink-muted")}>{hoy ? "Hoy" : DAY_SHORT[d.getDay()]}</span>
                    <span className="text-base font-bold leading-tight text-ink tabular-nums">{d.getDate()}</span>
                    <span className="flex items-center gap-1 text-xs text-ink-muted tabular-nums">
                      {espera && <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-label="Hay horas por confirmar" />}
                      {cnt > 0 ? `${cnt} citas` : "—"}
                    </span>
                  </button>
                );
              })}
            </div>
            {grilla.map((slot) => (
              <div key={slot} className={cx("grid min-h-10 border-b", cols, slot.endsWith(":00") ? "border-line-soft" : "border-line-soft/60")}>
                <div className={cx("pt-1.5 pr-2 text-right text-xs tabular-nums", slot.endsWith(":00") ? "font-semibold text-ink" : "text-ink-muted")}>
                  {slot.endsWith(":00") ? slot : ""}
                </div>
                {days.map((day) => {
                  const fecha = safeDateStr(day.date);
                  const cell = day.bookings.filter((b) => filtra(b) && tramoDe(b.time) === slot);
                  return (
                    <div key={day.date} className={cx("flex min-w-0 flex-col gap-0.5 border-l border-line-soft p-0.5", fecha === todayStr && "bg-brand-soft/40")}>
                      {cell.map((b) => {
                        const solicitud = esperaConfirmacion(b);
                        const cancelada = b.status === "cancelled";
                        return (
                          <button key={b.id} type="button" onClick={() => onOpen(b)}
                            className={cx("flex min-w-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-left text-xs transition-colors hover:border-brand focus-visible:outline-2 focus-visible:outline-brand",
                              solicitud ? "border-dashed border-accent bg-accent-soft text-accent-ink" : "border-line bg-surface text-ink")}>
                            <span className="shrink-0 font-semibold tabular-nums">{b.time}</span>
                            <span className={cx("truncate", cancelada && "text-ink-muted line-through")}>{b.patientName ?? "Sin nombre"}</span>
                          </button>
                        );
                      })}
                      {cell.length === 0 && (
                        <button type="button" onClick={() => onNueva(fecha)} aria-label={`Nueva cita el ${fecha} a las ${slot}`}
                          className="h-full min-h-8 w-full rounded-md text-xs text-transparent hover:bg-ground hover:text-brand focus-visible:text-brand focus-visible:outline-2 focus-visible:outline-brand">
                          +
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
