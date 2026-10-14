/**
 * Vigilante de infraestructura (MOL-42).
 *
 * Cada pocos minutos revisa lo que /health muestra pero nadie mira: si la base
 * responde, si algún scheduler se quedó pegado y si hay una racha de errores
 * del servidor. Si algo cambia, avisa por los canales de alertService, y avisa
 * también cuando se recupera.
 *
 * Caso que lo motivó: el 29/9 la base de beta quedó sin cuota en Neon. El
 * backend seguía arriba respondiendo errores y nadie se enteró en una semana.
 *
 * Lo que no cubre: si se cae el proceso entero, este vigilante cae con él.
 * Eso lo ve el monitor externo de /health (MOL-14).
 */
import prisma from "../../config/prisma";
import { getSchedulerHealth, registerScheduler, markSchedulerRun } from "../notifications/schedulerHealth";
import { triggerAlert, type AlertKind, type AlertSeverity } from "./alertService";

/** Fallas seguidas de la base antes de avisar: un corte de segundos no es alerta. */
export const FALLAS_PARA_ALERTAR = 2;
/** Errores 5xx dentro de la ventana que cuentan como racha. */
export const UMBRAL_ERRORES = 10;
export const VENTANA_ERRORES_MS = 5 * 60_000;
export const INTERVALO_MS = 2 * 60_000;

export interface EstadoVigilancia {
  fallasDb: number;
  dbCaida: boolean;
  schedulersPegados: string[];
}

export interface Lectura {
  dbOk: boolean;
  schedulers: { name: string; ok: boolean }[];
  errores5xx: number;
}

export interface AlertaVigilante { kind: AlertKind; severity: AlertSeverity; message: string }

export const ESTADO_INICIAL: EstadoVigilancia = { fallasDb: 0, dbCaida: false, schedulersPegados: [] };

/**
 * Qué alertas disparar a partir de una lectura y del estado anterior. Solo
 * avisa en los cambios (cae / vuelve), no en cada vuelta mientras dura.
 */
export function evaluarVigilancia(prev: EstadoVigilancia, l: Lectura): { estado: EstadoVigilancia; alertas: AlertaVigilante[] } {
  const alertas: AlertaVigilante[] = [];

  // Base de datos
  let { fallasDb, dbCaida } = prev;
  if (!l.dbOk) {
    fallasDb += 1;
    if (!dbCaida && fallasDb >= FALLAS_PARA_ALERTAR) {
      dbCaida = true;
      alertas.push({
        kind: "db_unreachable", severity: "critical",
        message: "La base de datos no responde. El panel, la agenda y el agente están fallando.",
      });
    }
  } else {
    if (dbCaida) {
      alertas.push({ kind: "db_recovered", severity: "info", message: "La base de datos volvió a responder." });
    }
    fallasDb = 0;
    dbCaida = false;
  }

  // Schedulers
  const pegados = l.schedulers.filter((s) => !s.ok).map((s) => s.name);
  for (const n of pegados) {
    if (!prev.schedulersPegados.includes(n)) {
      alertas.push({ kind: "scheduler_stalled", severity: "warn", message: `El scheduler "${n}" dejó de correr.` });
    }
  }
  for (const n of prev.schedulersPegados) {
    if (!pegados.includes(n)) {
      alertas.push({ kind: "scheduler_recovered", severity: "info", message: `El scheduler "${n}" volvió a correr.` });
    }
  }

  // Racha de errores. Con la base caída cada request falla: esa alerta ya
  // dice la causa, y esta sería ruido.
  if (!dbCaida && l.errores5xx >= UMBRAL_ERRORES) {
    alertas.push({
      kind: "error_spike", severity: "warn",
      message: `${l.errores5xx} errores del servidor en los últimos ${VENTANA_ERRORES_MS / 60_000} minutos.`,
    });
  }

  return { estado: { fallasDb, dbCaida, schedulersPegados: pegados }, alertas };
}

// ── Conteo de errores del servidor ─────────────────────────────────────────

let errores: number[] = [];

/** Lo llama un hook onResponse por cada respuesta. */
export function registrarRespuesta(status: number, ahora = Date.now()): void {
  if (status >= 500) errores.push(ahora);
}

export function erroresRecientes(ahora = Date.now()): number {
  errores = errores.filter((t) => ahora - t <= VENTANA_ERRORES_MS);
  return errores.length;
}

export function _resetVigilante(): void {
  errores = [];
  estado = ESTADO_INICIAL;
}

// ── Vuelta periódica ────────────────────────────────────────────────────────

let estado: EstadoVigilancia = ESTADO_INICIAL;

async function baseResponde(): Promise<boolean> {
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 5000)),
    ]);
    return true;
  } catch {
    return false;
  }
}

export async function vueltaVigilante(): Promise<void> {
  markSchedulerRun("vigilante");
  const lectura: Lectura = {
    dbOk: await baseResponde(),
    // El vigilante no se vigila a sí mismo: si se pega, lo ve el monitor externo.
    schedulers: getSchedulerHealth().filter((s) => s.name !== "vigilante"),
    errores5xx: erroresRecientes(),
  };
  const r = evaluarVigilancia(estado, lectura);
  estado = r.estado;
  for (const a of r.alertas) await triggerAlert(a);
}

export function startVigilante(): void {
  registerScheduler("vigilante", INTERVALO_MS);
  setInterval(() => { vueltaVigilante().catch((e) => console.error("[Vigilante]", e)); }, INTERVALO_MS);
}
