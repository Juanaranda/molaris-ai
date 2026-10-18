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
