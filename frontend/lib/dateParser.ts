/**
 * YYYY-MM-DD del día local. No usar `toISOString()` para esto: pasa a UTC y
 * en Chile (UTC-3/-4) después de las 21:00 la fecha sale corrida al día
 * siguiente.
 */
export function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const DAY_MAP: Record<string, number> = {
  lunes: 1, martes: 2, miércoles: 3, miercoles: 3,
  jueves: 4, viernes: 5, sábado: 6, sabado: 6, domingo: 0,
};

function nextWeekday(dow: number): string {
  const now = new Date();
  const current = now.getDay();
  let diff = dow - current;
  if (diff <= 0) diff += 7;
  const target = new Date(now);
  target.setDate(now.getDate() + diff);
  return toLocalDateStr(target);
}

/** Detecta referencias temporales en español y retorna YYYY-MM-DD o null */
export function parsePreferredDate(text: string): string | null {
  const lower = text.toLowerCase();
  const now   = new Date();

  if (/mañana/.test(lower)) {
    const d = new Date(now); d.setDate(now.getDate() + 1);
    return toLocalDateStr(d);
  }
  if (/pasado mañana|pasado manana/.test(lower)) {
    const d = new Date(now); d.setDate(now.getDate() + 2);
    return toLocalDateStr(d);
  }
  if (/hoy/.test(lower)) {
    return toLocalDateStr(now);
  }

  for (const [name, dow] of Object.entries(DAY_MAP)) {
    if (lower.includes(name)) return nextWeekday(dow);
  }

  return null;
}

/** Retorna el lunes de la semana que contiene la fecha dada */
export function getMondayOf(dateStr: string, offset = 0): string {
  const d   = new Date(dateStr + "T12:00:00");
  const dow = d.getDay();
  const diff = (dow === 0 ? -6 : 1 - dow) + offset * 7;
  d.setDate(d.getDate() + diff);
  return toLocalDateStr(d);
}

/** Lunes de la semana actual (domingo cuenta como fin de semana), corrido `offset` semanas */
export function getMondayOfCurrentWeek(offset = 0, now = new Date()): string {
  return getMondayOf(toLocalDateStr(now), offset);
}
