// Heartbeat de los schedulers in-process (recordatorios y recalls).
// Cada scheduler marca cuándo corrió; /health lo lee para detectar si el loop
// se murió (el proceso sigue vivo pero el setInterval dejó de disparar). Sin
// esto, un scheduler colgado es invisible hasta que un paciente reclama que no
// le llegó el recordatorio. Ver issue #58 (soporte autónomo, nivel 1).

interface SchedulerState {
  lastRunAt: number | null;
  intervalMs: number | null;
}

const state: Record<string, SchedulerState> = {};

/** Declara un scheduler y su intervalo esperado (para calcular si está atrasado). */
export function registerScheduler(name: string, intervalMs: number): void {
  state[name] = { lastRunAt: state[name]?.lastRunAt ?? null, intervalMs };
}

/** Marca que el scheduler acaba de disparar. Llamar al inicio de cada corrida. */
export function markSchedulerRun(name: string): void {
  const prev = state[name];
  state[name] = { lastRunAt: Date.now(), intervalMs: prev?.intervalMs ?? null };
}

export interface SchedulerReport {
  name: string;
  ok: boolean;
  lastRunAt: string | null;
  ageSec: number | null;
}

/**
 * Estado de cada scheduler. `ok` es false solo si ya corrió alguna vez y lleva
 * más de 2× su intervalo sin volver a disparar (margen para no dar falsos
 * positivos por una corrida lenta). Recién arrancado, sin correr aún, es ok.
 */
export function getSchedulerHealth(): SchedulerReport[] {
  const now = Date.now();
  return Object.entries(state).map(([name, s]) => {
    const ageSec = s.lastRunAt ? Math.round((now - s.lastRunAt) / 1000) : null;
    const staleAfterSec = s.intervalMs ? (s.intervalMs * 2) / 1000 : null;
    const ok =
      s.lastRunAt === null || staleAfterSec === null
        ? true
        : ageSec! <= staleAfterSec;
    return { name, ok, lastRunAt: s.lastRunAt ? new Date(s.lastRunAt).toISOString() : null, ageSec };
  });
}
