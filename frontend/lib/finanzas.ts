import { getToken } from "./auth";

/**
 * Finanzas de la clínica (MOL-58): por ahora, la producción de un período.
 */
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface Cifras {
  atendidas: number;
  cobrado: number;
  pagado: number;
  porCobrar: number;
  /** Atenciones sin monto registrado: los totales no las incluyen. */
  sinMonto: number;
}

export interface FilaProfesional extends Cifras {
  id: string | null;
  nombre: string;
  /** false: ya no está en el equipo. */
  activo: boolean;
}

export interface Produccion {
  desde: string;
  hasta: string;
  clinica?: Cifras & { otrosAbonos: number };
  profesionales: FilaProfesional[];
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** Primer y último día del mes, en AAAA-MM-DD. `mes` va de 0 a 11. */
export function rangoDelMes(anio: number, mes: number): { desde: string; hasta: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const ultimo = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  return { desde: `${anio}-${pad(mes + 1)}-01`, hasta: `${anio}-${pad(mes + 1)}-${pad(ultimo)}` };
}

export function nombreDelMes(anio: number, mes: number): string {
  const n = MESES[mes];
  return `${n[0].toUpperCase()}${n.slice(1)} ${anio}`;
}

/** Mueve un mes (anio, mes 0-11) hacia adelante o atrás. */
export function moverMes(anio: number, mes: number, delta: number): { anio: number; mes: number } {
  const total = anio * 12 + mes + delta;
  return { anio: Math.floor(total / 12), mes: ((total % 12) + 12) % 12 };
}

/** Qué tan completos están los montos: porcentaje de atenciones con monto. */
export function coberturaDeMontos(c: Pick<Cifras, "atendidas" | "sinMonto">): number {
  return c.atendidas === 0 ? 100 : Math.round(((c.atendidas - c.sinMonto) / c.atendidas) * 100);
}

export async function getProduccion(desde: string, hasta: string): Promise<Produccion> {
  const res = await fetch(`${API}/api/finanzas/produccion?desde=${desde}&hasta=${hasta}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "No pudimos cargar las finanzas");
  return data;
}

/* ── Caja del día ───────────────────────────────────────────────────────── */

export type Medio = "cash" | "transfer" | "card" | "other" | "mercadopago";
export const MEDIOS: Medio[] = ["cash", "transfer", "card", "mercadopago", "other"];
export const NOMBRE_MEDIO: Record<Medio, string> = {
  cash: "Efectivo", transfer: "Transferencia", card: "Tarjeta", mercadopago: "Mercado Pago", other: "Otro",
};
export const NOMBRE_ORIGEN: Record<string, string> = {
  cita: "Pago en cita", plan: "Abono a plan", abono: "Abono", mercadopago: "Pago en línea",
};

export interface ResumenCaja { porMedio: Record<Medio, number>; total: number; cantidad: number }

export interface MovimientoCaja {
  id: string; fecha: string; monto: number; medio: Medio; origen: string;
  patientName: string | null; patientRut: string | null; doctor: string | null;
  /** null si llegó solo (Mercado Pago). */
  registradoPor: string | null;
  /** La boleta más reciente del pago (MOL-63); null si no se ha emitido. */
  boleta: BoletaDePago | null;
}

export interface BoletaDePago {
  id: string;
  folio: number | null;
  status: "draft" | "issued" | "accepted" | "rejected" | "error";
  errorMessage: string | null;
}

export interface Caja {
  dia: string;
  resumen: ResumenCaja;
  movimientos: MovimientoCaja[];
  /** La clínica emite boletas desde molari (OpenFactura verificado). */
  boletaActiva: boolean;
  /** Pagos del día que necesitan boleta y no la tienen. */
  sinBoleta: number;
  cierre: {
    cerradoEn: string; cerradoPor: string | null; esperado: Record<Medio, number> & { total: number };
    efectivoContado: number; diferencia: number; nota: string | null;
    /** null si la clínica no emitía boletas al cerrar. */
    pagosSinBoleta: number | null;
  } | null;
  despuesDelCierre: ResumenCaja | null;
}

/** "AAAA-MM-DD" del día local (el navegador está en Chile). */
export function diaLocal(fecha = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}`;
}

/** Mueve un día "AAAA-MM-DD" hacia adelante o atrás. */
export function moverDia(dia: string, delta: number): string {
  const [a, m, d] = dia.split("-").map(Number);
  return diaLocal(new Date(a, m - 1, d + delta));
}

export function nombreDelDia(dia: string): string {
  const [a, m, d] = dia.split("-").map(Number);
  const t = new Date(a, m - 1, d).toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });
  return t[0].toUpperCase() + t.slice(1);
}

/** "Faltan $2.000" / "Sobran $500" / "Cuadra" para la diferencia del cierre. */
export function textoDiferencia(diferencia: number, fmt: (n: number) => string): string {
  if (diferencia === 0) return "Cuadra";
  return diferencia < 0 ? `Faltan ${fmt(-diferencia)}` : `Sobran ${fmt(diferencia)}`;
}

export async function getCaja(dia: string): Promise<Caja> {
  const res = await fetch(`${API}/api/finanzas/caja?dia=${dia}`, { headers: { Authorization: `Bearer ${getToken()}` } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "No pudimos cargar la caja");
  return data;
}

export async function cerrarCaja(dia: string, efectivoContado: number, nota: string): Promise<void> {
  const res = await fetch(`${API}/api/finanzas/caja/cierre`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify({ dia, efectivoContado, nota }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "No pudimos cerrar la caja");
}

/** La boleta cuenta como hecha cuando OpenFactura la recibió o el SII la aceptó. */
export const boletaEmitida = (b: BoletaDePago | null) => b?.status === "issued" || b?.status === "accepted";

export async function emitirBoleta(movimientoId: string): Promise<BoletaDePago> {
  const res = await fetch(`${API}/api/finanzas/caja/movimientos/${movimientoId}/boleta`, {
    method: "POST", headers: { Authorization: `Bearer ${getToken()}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "No pudimos emitir la boleta");
  return data.boleta;
}

/**
 * Abre el PDF de una boleta en otra pestaña. La pestaña se abre antes de
 * pedirlo (si no, el navegador la bloquea por no venir de un clic) y el PDF
 * se pide con la sesión, porque no es un link público.
 */
export async function abrirPdfBoleta(boletaId: string): Promise<void> {
  const ventana = window.open("", "_blank");
  try {
    const res = await fetch(`${API}/api/finanzas/boletas/${boletaId}/pdf`, { headers: { Authorization: `Bearer ${getToken()}` } });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "No pudimos abrir el PDF");
    const url = URL.createObjectURL(await res.blob());
    if (ventana) ventana.location.href = url; else window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    ventana?.close();
    throw e;
  }
}
