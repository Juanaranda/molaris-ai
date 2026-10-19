/**
 * Fechas de calendario en hora de Chile.
 *
 * El servidor corre en UTC (Railway no fija TZ), así que ni la hora local del
 * proceso ni `toISOString()` sirven para saber "qué día es hoy" para la
 * clínica: después de las 21:00 en Chile ya sería el día siguiente.
 */

const ZONA_CHILE = "America/Santiago";

// en-CA formatea como YYYY-MM-DD.
const formatoFecha = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA_CHILE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** YYYY-MM-DD del día en Chile para ese instante. */
export function fechaEnChile(instante: Date = new Date()): string {
  return formatoFecha.format(instante);
}

/** Lunes (YYYY-MM-DD) de la semana en curso en Chile; el domingo cierra la semana. */
export function lunesDeLaSemanaEnChile(instante: Date = new Date()): string {
  // Mediodía UTC del día chileno: getUTCDay y setUTCDate no dependen de la TZ del proceso.
  const d = new Date(fechaEnChile(instante) + "T12:00:00Z");
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (dow === 0 ? -6 : 1 - dow));
  return d.toISOString().slice(0, 10);
}

const formatoPartes = new Intl.DateTimeFormat("en-US", {
  timeZone: ZONA_CHILE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Minutos que Chile va adelantado respecto de UTC en ese instante (-180 o -240). */
function desfaseChileMin(instante: Date): number {
  const p: Record<string, string> = {};
  for (const parte of formatoPartes.formatToParts(instante)) p[parte.type] = parte.value;
  const relojChileComoUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((relojChileComoUTC - instante.getTime()) / 60000);
}

/**
 * Instante real de una fecha + hora "HH:MM" dichas en Chile.
 * Sirve para comparar con `Date.now()` sin depender de la TZ del proceso.
 */
export function instanteEnChile(fecha: string, hhmm: string): Date {
  const [y, mo, d] = fecha.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const comoUTC = Date.UTC(y, mo - 1, d, h, mi);
  // Dos pasadas: el desfase se corrige si la hora cae al otro lado de un cambio de horario.
  const desfase = desfaseChileMin(new Date(comoUTC));
  const t = comoUTC - desfase * 60000;
  const desfaseReal = desfaseChileMin(new Date(t));
  return new Date(desfaseReal === desfase ? t : comoUTC - desfaseReal * 60000);
}

/** Suma días a una fecha YYYY-MM-DD (aritmética de calendario, sin TZ). */
export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(fecha + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Día de la semana de una fecha YYYY-MM-DD (0 = domingo). */
export function diaDeSemana(fecha: string): number {
  return new Date(fecha + "T12:00:00Z").getUTCDay();
}
