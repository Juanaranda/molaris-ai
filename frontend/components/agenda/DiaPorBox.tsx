import { useState } from "react";
import { cx } from "@/lib/cx";
import { nombreCorto, tramoDe, tramosDelDia } from "@/lib/agendaVista";
import { peldanoDeUrgencia } from "@/lib/plazos";
import { esperaConfirmacion } from "@/lib/solicitudes";
import { MarcaEstado, TINTE, textoPago } from "./Marcas";
import type { Ahora, Booking } from "./tipos";

const aMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
/** Cuándo termina un tramo de media hora: "11:00" → "11:30". */
const finDe = (t: string) => { const m = aMin(t) + 30; return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; };

/** Una cita dentro de la línea de tiempo. Todo el bloque abre su detalle. */
export function BloqueCita({ b, ahora, enCurso, choca, conBox, conDoctor = true, onOpen }: {
  b: Booking; ahora: Date; enCurso: boolean; choca?: Booking;
  /** En la lista del celular no hay columnas de box: el box va en el detalle. */
  conBox: boolean;
  conDoctor?: boolean;
  onOpen: (b: Booking) => void;
}) {
  const solicitud = esperaConfirmacion(b);
  const peldano = solicitud ? peldanoDeUrgencia(b.confirmDeadline, ahora) ?? 1 : null;
  const cancelada = b.status === "cancelled";
  const detalle = [
    b.service,
    conDoctor ? nombreCorto(b.doctor) : null,
    conBox && b.box ? `Box ${b.box}` : null,
    textoPago(b.paymentStatus),
  ].filter(Boolean).join(" · ");
  // Una sola marca roja por choque: va en la solicitud; si ninguna de las dos
  // es solicitud (dos horas cargadas a mano), en las dos.
  const mostrarChoque = choca && (solicitud || !esperaConfirmacion(choca));

  return (
    <button type="button" onClick={() => onOpen(b)}
      className={cx(
        "grid w-full min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-0.5 rounded-control border px-2.5 py-1.5 text-left transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        solicitud ? cx("border-dashed border-accent hover:border-accent-ink", TINTE[peldano!])
          : enCurso && !cancelada ? "border-brand-soft bg-brand-soft hover:border-brand"
          : "border-line bg-surface hover:border-brand",
      )}>
      <span className={cx("min-w-0 text-sm font-semibold text-ink", cancelada ? "line-through font-medium text-ink-muted" : "", conBox ? "" : "truncate")}>
        {b.patientName ?? "Sin nombre"}
      </span>
      {/* El plazo es largo: va en su propia línea para no cortar el nombre.
          Las marcas cortas (Ahora, Cancelada) van a la derecha. */}
      {!solicitud && (
        <span className="row-span-2 flex flex-col items-end gap-0.5 empty:hidden">
          <MarcaEstado b={b} ahora={ahora} enCurso={enCurso} />
        </span>
      )}
      {detalle && (
        <span className={cx("col-start-1 min-w-0 text-[13px] leading-4", solicitud ? "text-ink" : "text-ink-muted", conBox ? "" : "truncate")}>
          {detalle}
        </span>
      )}
      {solicitud && (
        <span className="col-span-2 pt-0.5"><MarcaEstado b={b} ahora={ahora} /></span>
      )}
      {mostrarChoque && (
        <span className="col-span-2 text-xs font-semibold text-danger">
          Choca con {choca.patientName ?? "otra cita"} ({nombreCorto(choca.doctor)}) en Box {b.box}
        </span>
      )}
    </button>
  );
}

/**
 * Vista del día por box (opción A). En escritorio, una columna por box para
 * ver la rotación y los choques; en el celular, una sola lista por hora.
 * Si el día es hoy, lo que ya pasó se junta en una línea que se puede abrir.
 */
export function DiaPorBox({
  citas, boxes, grilla, enHorario, esHoy, ahora, choques, filtrandoDoctor,
  loading, error, onRetry, onOpen, onNueva,
}: {
  citas: Booking[];
  boxes: number;
  grilla: string[];
  /** ¿El tramo cae dentro del horario de atención de ese día? */
  enHorario: (tramo: string) => boolean;
  esHoy: boolean;
  ahora: Ahora;
  choques: Map<string, Booking>;
  filtrandoDoctor: boolean;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onOpen: (b: Booking) => void;
  onNueva: () => void;
}) {
  const [verPasado, setVerPasado] = useState(false);
  const nowMin = ahora.fecha.getHours() * 60 + ahora.fecha.getMinutes();

  // Columnas: los boxes configurados, y "Sin box" solo si hay citas sin uno.
  const lanes = Array.from({ length: Math.max(boxes, 1) }, (_, i) => String(i + 1));
  const sinBox = citas.some((c) => !c.box || !lanes.includes(c.box));
  const columnas = sinBox ? [...lanes, "sin"] : lanes;
  const enColumna = (c: Booking, col: string) => col === "sin" ? (!c.box || !lanes.includes(c.box)) : c.box === col;
  // Con más de tres columnas no caben nombres legibles: se usa la lista.
  const usaColumnas = columnas.length <= 3;

  const porTramo = new Map<string, Booking[]>();
  for (const c of citas) {
    const t = tramoDe(c.time);
    porTramo.set(t, [...(porTramo.get(t) ?? []), c]);
  }
  // Se muestran todos los tramos: el horario configurado no siempre se puede
  // leer (p. ej. "Lunes a Viernes" en una sola clave) y esconder horas por eso
  // dejaría la agenda vacía. Fuera de horario solo se ven más apagadas.
  const filas = tramosDelDia(grilla, citas.map((c) => c.time));
  // Si ese día no tiene horario legible, no se apaga nada (todo quedaría gris).
  const hayHorario = filas.some(enHorario);
  const pasado = (t: string) => esHoy && aMin(t) + 30 <= nowMin;
  const filasPasadas = filas.filter(pasado);
  const citasPasadas = filasPasadas.flatMap((t) => porTramo.get(t) ?? []);
  const visibles = verPasado ? filas : filas.filter((t) => !pasado(t));
  const tramoAhora = esHoy && ahora.mins !== null ? tramoDe(`${Math.floor(nowMin / 60)}:${nowMin % 60}`) : null;
  const activas = citas.filter((c) => c.status !== "cancelled").length;
  const pasadasActivas = citasPasadas.filter((c) => c.status !== "cancelled").length;
  const pasadasCanceladas = citasPasadas.length - pasadasActivas;
  const resumenPasado = [
    pasadasActivas === 1 ? "1 cita ya pasó" : `${pasadasActivas} citas ya pasaron`,
    pasadasCanceladas ? `${pasadasCanceladas} cancelada${pasadasCanceladas > 1 ? "s" : ""}` : null,
  ].filter(Boolean).join(", ");

  const lineaAhora = (t: string) => t === tramoAhora ? (
    <div className="pointer-events-none absolute inset-x-0 z-0 border-t-2 border-brand" aria-hidden
      style={{ top: `${((nowMin - aMin(t)) / 30) * 100}%` }} />
  ) : null;

  // La hora exacta de "ahora" va bajo la del tramo, en la columna de horas:
  // sobre la línea quedaba tapada por las citas.
  const hora = (t: string) => (
    <div className={cx("relative z-[1] pt-2 pr-3 text-right text-xs tabular-nums", t.endsWith(":00") ? "font-semibold text-ink" : "text-ink-muted")}>
      {t}
      {t === tramoAhora && <span className="mt-0.5 block font-bold text-brand-ink">{ahora.label}</span>}
    </div>
  );

  return (
    <section aria-labelledby="agenda-dia" className="rounded-card border border-line bg-surface">
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
        <h3 id="agenda-dia" className="text-base font-bold text-brand-strong">
          {usaColumnas ? "Por box" : "Por hora"}
        </h3>
        <p className="text-xs text-ink-muted tabular-nums">
          {loading ? "Cargando…" : `${activas} ${activas === 1 ? "cita" : "citas"}`}
        </p>
      </div>

      {error ? (
        <div className="mx-5 mb-5 rounded-control border border-line px-4 py-3 text-sm text-ink">
          No pudimos cargar la agenda de esta semana.{" "}
          <button type="button" onClick={onRetry} className="min-h-11 font-semibold text-brand underline underline-offset-2">Reintentar</button>
        </div>
      ) : loading ? (
        <div className="flex flex-col gap-2 px-5 pb-5" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-11 rounded-control bg-gray-100" />)}
        </div>
      ) : (
        <>
          {citas.length === 0 && (
            <p className="mx-5 mb-3 rounded-control border border-dashed border-line px-4 py-3 text-sm text-ink-muted">
              No hay citas este día{filtrandoDoctor ? " para este profesional" : ""}.
            </p>
          )}

          {usaColumnas && (
            <div className="hidden grid-cols-[56px_repeat(var(--cols),minmax(0,1fr))] px-5 pb-1 text-xs text-ink-muted sm:grid"
              style={{ ["--cols" as string]: columnas.length }}>
              <span />
              {columnas.map((c) => <span key={c} className="pl-3">{c === "sin" ? "Sin box" : `Box ${c}`}</span>)}
            </div>
          )}

          {filasPasadas.length > 0 && (
            <div className="mx-5 mb-2 ml-[76px] flex items-center justify-between gap-3 rounded-control border border-dashed border-line px-3 py-1 text-[13px] text-ink-muted max-sm:ml-5">
              <span className="tabular-nums">
                {filasPasadas[0]} a {finDe(filasPasadas[filasPasadas.length - 1])} · {resumenPasado}
              </span>
              <button type="button" onClick={() => setVerPasado((v) => !v)} aria-expanded={verPasado}
                className="min-h-11 shrink-0 font-semibold text-brand">
                {verPasado ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          )}

          <div className="pb-3">
            {visibles.map((t) => {
              const enEste = porTramo.get(t) ?? [];
              const fuera = hayHorario && !enHorario(t);
              return (
                <div key={t}>
                  {/* Escritorio: una columna por box */}
                  {usaColumnas && (
                    <div className={cx("relative hidden min-h-[52px] grid-cols-[56px_repeat(var(--cols),minmax(0,1fr))] border-t border-line-soft pr-5 pl-5 sm:grid", fuera && "bg-ground/60", pasado(t) && "opacity-70")}
                      style={{ ["--cols" as string]: columnas.length }}>
                      {lineaAhora(t)}
                      {hora(t)}
                      {columnas.map((col) => {
                        const cs = enEste.filter((c) => enColumna(c, col));
                        return (
                          <div key={col} className="relative z-[1] flex min-w-0 flex-col gap-1 py-1 pl-3">
                            {cs.map((c) => (
                              <BloqueCita key={c.id} b={c} ahora={ahora.fecha} enCurso={t === tramoAhora}
                                choca={choques.get(c.id)} conBox={false} conDoctor={!filtrandoDoctor} onOpen={onOpen} />
                            ))}
                            {cs.length === 0 && col !== "sin" && (
                              <button type="button" onClick={onNueva} aria-label={`Nueva cita a las ${t}`}
                                className="min-h-11 w-full rounded-control border border-dashed border-transparent px-2.5 text-left text-xs font-semibold text-transparent transition-colors hover:border-line hover:text-brand focus-visible:text-brand focus-visible:outline-2 focus-visible:outline-brand">
                                + Nueva cita
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {/* Celular (o más de tres boxes): una lista por hora */}
                  {enEste.length > 0 && (
                    <div className={cx("relative grid grid-cols-[48px_minmax(0,1fr)] border-t border-line-soft px-4 sm:px-5", usaColumnas && "sm:hidden", pasado(t) && "opacity-70")}>
                      {lineaAhora(t)}
                      {hora(t)}
                      <div className="relative z-[1] flex min-w-0 flex-col gap-1.5 py-1.5">
                        {[...enEste].sort((a, b) => (a.box ?? "").localeCompare(b.box ?? "")).map((c) => (
                          <BloqueCita key={c.id} b={c} ahora={ahora.fecha} enCurso={t === tramoAhora}
                            choca={choques.get(c.id)} conBox conDoctor={!filtrandoDoctor} onOpen={onOpen} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
