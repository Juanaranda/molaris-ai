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
  return target.toISOString().slice(0, 10);
}

/** Detecta referencias temporales en español y retorna YYYY-MM-DD o null */
export function parsePreferredDate(text: string): string | null {
  const lower = text.toLowerCase();
  const now   = new Date();

  if (/mañana/.test(lower)) {
    const d = new Date(now); d.setDate(now.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }
  if (/pasado mañana|pasado manana/.test(lower)) {
    const d = new Date(now); d.setDate(now.getDate() + 2);
    return d.toISOString().slice(0, 10);
  }
  if (/hoy/.test(lower)) {
    return now.toISOString().slice(0, 10);
  }

  for (const [name, dow] of Object.entries(DAY_MAP)) {
    if (lower.includes(name)) return nextWeekday(dow);
  }

  return null;
}

/** Retorna el lunes de la semana que contiene la fecha dada */
export function getMondayOf(dateStr: string): string {
  const d   = new Date(dateStr + "T12:00:00");
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}
