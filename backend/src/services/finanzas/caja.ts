/**
 * Caja del día y su cierre (MOL-58, fase 0).
 *
 * La caja lee el libro de movimientos (MovimientoCaja): cada peso que entra,
 * con su medio de pago, quién lo registró y cuándo. El día es el de Chile,
 * no el UTC del servidor: un pago de las 22:00 del lunes es del lunes.
 */

export const MEDIOS = ["cash", "transfer", "card", "other", "mercadopago"] as const;
export type Medio = (typeof MEDIOS)[number];
export type Origen = "cita" | "plan" | "abono" | "mercadopago";

const ZONA = "America/Santiago";

/** "cash", "transfer"… tal cual; cualquier otra cosa cuenta como "other". */
export function medioDePago(m: unknown): Medio {
  return typeof m === "string" && (MEDIOS as readonly string[]).includes(m) ? (m as Medio) : "other";
}

/** El día en Chile ("AAAA-MM-DD") de un instante. */
export function diaChile(fecha: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" }).format(fecha);
}

/** Minutos de diferencia entre la hora de Chile y UTC en un instante (-180 o -240). */
function desfaseChile(fecha: Date): number {
  const texto = new Intl.DateTimeFormat("en-US", { timeZone: ZONA, timeZoneName: "longOffset" })
    .formatToParts(fecha).find((p) => p.type === "timeZoneName")?.value ?? "GMT-03:00";
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(texto);
  if (!m) return -180;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
}

/** El primer instante de un día de Chile, en UTC. */
function inicioDelDia(dia: string): Date {
  const [a, mes, d] = dia.split("-").map(Number);
  const mediodia = new Date(Date.UTC(a, mes - 1, d, 12));
  return new Date(Date.UTC(a, mes - 1, d) - desfaseChile(mediodia) * 60_000);
}

/** Desde y hasta (exclusivo) de un día de Chile, en UTC. Respeta el cambio de hora. */
export function rangoDiaChile(dia: string): { desde: Date; hasta: Date } {
  const [a, mes, d] = dia.split("-").map(Number);
  const siguiente = new Date(Date.UTC(a, mes - 1, d + 1)).toISOString().slice(0, 10);
  return { desde: inicioDelDia(dia), hasta: inicioDelDia(siguiente) };
}

/**
 * Cuánto entró al cambiar lo pagado de una cita o un plan. Positivo si se
 * pagó más; negativo si se corrigió hacia abajo; 0 si no cambió.
 */
export function diferenciaDePago(antes: number | null | undefined, despues: number | null | undefined): number {
  if (despues == null) return 0;
  return despues - (antes ?? 0);
}

export interface Resumen {
  porMedio: Record<Medio, number>;
  total: number;
  cantidad: number;
}

export function resumirCaja(movimientos: { monto: number; medio: string }[]): Resumen {
  const porMedio = Object.fromEntries(MEDIOS.map((m) => [m, 0])) as Record<Medio, number>;
  for (const mv of movimientos) porMedio[medioDePago(mv.medio)] += mv.monto;
  return { porMedio, total: Object.values(porMedio).reduce((s, n) => s + n, 0), cantidad: movimientos.length };
}

/** La boleta cuenta como hecha cuando OpenFactura la recibió o el SII la aceptó. */
export const tieneBoleta = (b: { status: string } | null | undefined) => b?.status === "issued" || b?.status === "accepted";

/** Pagos que necesitan boleta y no la tienen. Las correcciones (montos negativos) no llevan. */
export function pagosSinBoleta(movimientos: { monto: number; boleta: { status: string } | null }[]): number {
  return movimientos.filter((m) => m.monto > 0 && !tieneBoleta(m.boleta)).length;
}
