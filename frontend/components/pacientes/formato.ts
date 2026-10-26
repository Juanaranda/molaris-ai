/** Datos y formatos de la pantalla de pacientes. */

export interface Patient {
  key: string; name: string; rut: string | null; phone: string | null; email: string | null;
  visits: number; lastVisit: string; lastDoctor: string; services: string[];
  totalCharged: number; totalPaid: number; pendingCount: number;
}

export interface HistoryEntry {
  id: string; doctor: string; date: string; time: string;
  service: string | null; status: string; notes: string | null;
  paymentStatus: string | null; amountTotal: number | null;
  amountPaid: number | null; paymentMethod: string | null; paidAt: string | null;
}

export interface TreatmentPlan {
  id: string;
  patientRut: string | null;
  patientName: string;
  doctor: string | null;
  title: string;
  description: string | null;
  totalAmount: number | null;
  amountPaid: number;
  sessions: number;
  sessionsCompleted: number;
  status: string;
  startDate: string;
  endDate: string | null;
  notes: string | null;
  createdAt: string;
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Pesos chilenos completos: "$30.000". Antes se redondeaba a miles ("$30k"),
 * y en una cuenta que se cobra en recepción eso no sirve para decir cuánto falta.
 */
const CLP = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
export const fmtCLP = (n: number) => CLP.format(n);

export const METODO_PAGO: Record<string, string> = { cash: "Efectivo", transfer: "Transferencia", card: "Tarjeta", other: "Otro" };

export type EstadoPago = "sin-datos" | "pagado" | "abonado" | "pendiente";

/**
 * Estado de pago de un paciente.
 *
 * "sin-datos" NO es lo mismo que "debe": las citas importadas de otro sistema
 * vienen sin montos, y mostrarlas como deuda hacía que los 2.183 pacientes
 * figuraran debiendo. Un contador que marca todo igual no informa nada.
 */
export function estadoPago(p: { totalCharged: number; totalPaid: number }): {
  estado: EstadoPago; saldo: number; porcentaje: number;
} {
  const saldo = p.totalCharged - p.totalPaid;
  if (p.totalCharged <= 0) return { estado: "sin-datos", saldo: 0, porcentaje: 0 };
  const porcentaje = Math.round((p.totalPaid / p.totalCharged) * 100);
  if (saldo <= 0)        return { estado: "pagado",    saldo: 0, porcentaje: 100 };
  if (p.totalPaid > 0)   return { estado: "abonado",   saldo, porcentaje };
  return { estado: "pendiente", saldo, porcentaje: 0 };
}

export const iniciales = (nombre: string) =>
  nombre.replace(/^Dra?\.\s*/, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

/* ── Búsqueda de pacientes ─────────────────────────────────────────────────
 * Dos cosas que fallaban y son el 90% de las búsquedas reales en una clínica
 * chilena: nadie escribe las tildes ("garces" no encontraba a "Garcés"), y el
 * RUT se escribe con puntos y guion mientras que en la base va sin nada
 * ("20.283.625-9" no encontraba a "202836259").
 */
export function normalizar(s: string): string {
  // ̀-ͯ = marcas diacriticas combinantes (NFD las separa de la letra).
  // Escapadas a proposito: como caracteres literales serian invisibles en el editor.
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Deja el RUT comparable: sin puntos, guion ni espacios, en minúscula (por la K). */
export function soloRut(s: string): string {
  return s.replace(/[.\-\s]/g, "").toLowerCase();
}

export function coincide(p: Patient, query: string): boolean {
  const q = normalizar(query.trim());
  if (!q) return true;
  if (normalizar(p.name).includes(q)) return true;
  const qRut = soloRut(query);
  if (qRut && soloRut(p.rut ?? "").includes(qRut)) return true;
  const qTel = query.replace(/\D/g, "");
  if (qTel && (p.phone ?? "").replace(/\D/g, "").includes(qTel)) return true;
  return false;
}

/**
 * Normaliza sin descomponer: cada carácter a su versión sin tilde, manteniendo
 * 1 a 1 la posición, para poder recortar el texto ORIGINAL con los índices.
 */
export function sinTildes1a1(s: string): string {
  return s
    .toLowerCase()
    .split("")
    .map((ch) => ch.normalize("NFD").replace(/[̀-ͯ]/g, "") || ch)
    .join("");
}
