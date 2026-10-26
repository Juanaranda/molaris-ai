import { toLocalDateStr } from "@/lib/dateParser";

export const DAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
export const DAY_FULL  = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
export const MONTHS    = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export const toDateStr = toLocalDateStr;

/** YYYY-MM-DD de cualquier formato ISO (los timestamps completos de Prisma/Fastify). */
export function safeDateStr(s: string | null | undefined): string { return s ? String(s).slice(0, 10) : ""; }

export function formatDate(s: string | null | undefined): string {
  const clean = safeDateStr(s);
  if (!clean || !/^\d{4}-\d{2}-\d{2}$/.test(clean)) return "—";
  const [y, m, d] = clean.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
}

export function getMondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  // Sunday (0) → show the upcoming Monday (forward), not last week
  d.setDate(d.getDate() + (day === 0 ? 1 : 1 - day));
  d.setHours(0, 0, 0, 0);
  return d;
}
