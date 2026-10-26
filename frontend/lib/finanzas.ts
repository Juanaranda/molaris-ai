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
