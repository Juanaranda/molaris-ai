import { Badge } from "@/components/ui";
import { cx } from "@/lib/cx";
import { nombreCorto } from "@/lib/agendaVista";
import { peldanoDeUrgencia } from "@/lib/plazos";
import { Plazo, TINTE } from "./Marcas";
import type { Booking, BookingConDia } from "./tipos";

const DIA_CORTO = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MAXIMO = 5;

/**
 * La cola de solicitudes del asistente (opción A). Es el trabajo que más se
 * pierde: si nadie responde antes del plazo, la hora se libera sola. Por eso
 * va aparte, ordenada por plazo, y más coral mientras menos tiempo queda.
 * Cada fila abre el detalle de la cita, donde se confirma o se rechaza.
 */
export function PorResponder({ items, ahora, todayStr, chocaCon, loading, error = false, onOpen, enFila = false }: {
  /** Ya ordenadas por plazo: la primera es la que menos aguanta. */
  items: BookingConDia[];
  ahora: Date;
  todayStr: string;
  chocaCon: (b: BookingConDia) => Booking | undefined;
  loading: boolean;
  /** Si la semana no cargó, no se puede decir que no hay nada esperando. */
  error?: boolean;
  onOpen: (b: Booking) => void;
  /** A lo ancho (vista semana): las solicitudes en columnas, no en una lista larga. */
  enFila?: boolean;
}) {
  const dia = (d: string) => d === todayStr ? "Hoy" : `${DIA_CORTO[new Date(d + "T12:00:00").getDay()]} ${Number(d.slice(8, 10))}`;
  const horaDe = (iso: string) => new Date(iso).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false });

  return (
    <section aria-labelledby="por-responder" className="rounded-card border border-line bg-surface">
      <div className="flex items-center gap-2 px-5 pt-4 pb-3">
        <h3 id="por-responder" className="text-base font-bold text-brand-strong">Por responder</h3>
        {items.length > 0 && <Badge tone="accent">{items.length}</Badge>}
      </div>

      {loading ? (
        <div className="flex flex-col gap-2 px-3 pb-3" aria-hidden>
          {[0, 1].map((i) => <div key={i} className="h-24 rounded-control bg-gray-100" />)}
        </div>
      ) : error ? (
        <p className="mx-3 mb-3 rounded-control border border-line px-4 py-3 text-sm text-ink">
          No pudimos cargar las solicitudes de esta semana.
        </p>
      ) : items.length === 0 ? (
        <p className="mx-3 mb-3 rounded-control border border-dashed border-line px-4 py-3 text-sm text-ink-muted">
          Nada esperando respuesta esta semana.
        </p>
      ) : (
        <ul className={cx("gap-2 px-3 pb-3", enFila ? "grid sm:grid-cols-2 lg:grid-cols-3" : "flex flex-col")}>
          {items.slice(0, MAXIMO).map((b) => {
            const peldano = peldanoDeUrgencia(b.confirmDeadline, ahora) ?? 1;
            const otra = chocaCon(b);
            return (
              <li key={b.id} className="flex">
                <button type="button" onClick={() => onOpen(b)}
                  className={cx(
                    "flex h-full w-full flex-col gap-0.5 rounded-control px-3.5 py-3 text-left transition-colors",
                    "outline outline-1 outline-transparent hover:outline-accent focus-visible:outline-2 focus-visible:outline-brand",
                    TINTE[peldano],
                  )}>
                  <span className="flex flex-wrap items-center gap-x-1.5">
                    <Plazo deadline={b.confirmDeadline} ahora={ahora} />
                    {b.confirmDeadline && (
                      <span className="text-xs font-semibold text-accent-ink tabular-nums">· a las {horaDe(b.confirmDeadline)}</span>
                    )}
                  </span>
                  <span className="mt-1 text-[15px] font-bold text-ink">{b.patientName ?? "Sin nombre"}</span>
                  <span className="text-[13px] text-ink tabular-nums">
                    {[`${dia(b.dateStr)} ${b.time}`, b.service, nombreCorto(b.doctor), b.box ? `Box ${b.box}` : null].filter(Boolean).join(" · ")}
                  </span>
                  {otra && (
                    <span className="mt-1.5 rounded-lg bg-surface px-2 py-1.5 text-xs font-semibold text-danger">
                      El Box {b.box} ya tiene a {otra.patientName ?? "otro paciente"} ({nombreCorto(otra.doctor)}) a esa hora.
                    </span>
                  )}
                  <span className="mt-auto pt-2 text-sm font-semibold text-brand-strong">Revisar y responder ›</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {!loading && items.length > 0 && (
        <p className="px-5 pb-4 text-xs text-ink-muted">
          {items.length > MAXIMO && <>Y {items.length - MAXIMO} más esta semana: en la agenda llevan borde punteado. </>}
          Las pidieron pacientes por el asistente. Si nadie responde antes del plazo, la hora se libera sola.
        </p>
      )}
    </section>
  );
}
