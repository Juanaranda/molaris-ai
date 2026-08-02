/**
 * Auto-recuperación del agente (#58, nivel 2).
 *
 * El circuit breaker (#50) auto-pausa el agente tras N fallos consecutivos de
 * IA. Hasta ahora reactivarlo era manual: si el proveedor se caía de
 * madrugada, la clínica amanecía sin agente aunque el problema ya no existía.
 *
 * REGLA CRÍTICA: solo se reactivan las pausas AUTOMÁTICAS
 * (agentDisabledBy === "auto"). Un apagado manual es una decisión del dueño de
 * la clínica — reactivarlo solo sería desobedecerla y poner al agente a hablar
 * con pacientes sin permiso.
 */

import prisma from "../../config/prisma";
import { config } from "../../config/env";
import { triggerAlert } from "../alerts/alertService";
import { registerScheduler, markSchedulerRun } from "../notifications/schedulerHealth";

const CHECK_INTERVAL_MS = 10 * 60 * 1000; // cada 10 min

/**
 * Prueba si el proveedor de IA volvió, con una llamada mínima y barata.
 * Devuelve false ante cualquier problema — el costo de un falso negativo es
 * esperar 10 minutos más; el de un falso positivo, reactivar un agente que
 * sigue roto y dejar pacientes sin respuesta otra vez.
 */
export async function probeAIProvider(): Promise<boolean> {
  if (!config.openRouter.apiKey) return false;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.openRouter.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.openRouter.models.fast,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
      }),
      signal: AbortSignal.timeout(15000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Reactiva los agentes auto-pausados si el proveedor volvió.
 *
 * `probe` se inyecta para poder testear la lógica sin llamar a OpenRouter de
 * verdad (un test que pega a la API real cobra, es lento y falla sin red).
 */
export async function runRecoveryCheck(
  probe: () => Promise<boolean> = probeAIProvider,
): Promise<{ candidates: number; recovered: number }> {
  markSchedulerRun("agentRecovery");

  const paused = await prisma.clinic.findMany({
    where: { agentEnabled: false, agentDisabledBy: "auto", active: true },
    select: { id: true, name: true },
  });
  if (paused.length === 0) return { candidates: 0, recovered: 0 };

  // Se prueba UNA vez por corrida, no una por clínica: el proveedor es el
  // mismo para todas y así no se multiplican llamadas.
  const healthy = await probe();
  if (!healthy) {
    console.info(`[agentRecovery] ${paused.length} agente(s) en pausa — proveedor aún caído`);
    return { candidates: paused.length, recovered: 0 };
  }

  let recovered = 0;
  for (const clinic of paused) {
    try {
      // Se vuelve a condicionar por agentDisabledBy en el propio update: si
      // alguien apagó el agente a mano entre la consulta y este punto, el
      // update no matchea y se respeta su decisión.
      const res = await prisma.clinic.updateMany({
        where: { id: clinic.id, agentEnabled: false, agentDisabledBy: "auto" },
        data: { agentEnabled: true, agentDisabledAt: null, agentDisabledReason: null, agentDisabledBy: null },
      });
      if (res.count === 0) continue;
      recovered++;

      await triggerAlert({
        kind: "agent_enabled",
        severity: "info",
        message: `Agente REACTIVADO automáticamente en ${clinic.name} — el proveedor de IA volvió`,
        detail: { clinicId: clinic.id, recoveredBy: "auto" },
        cooldownMs: 0,
      });
    } catch (e) {
      console.error(`[agentRecovery] no se pudo reactivar ${clinic.id}:`, e instanceof Error ? e.message : e);
    }
  }

  console.info(`[agentRecovery] ${recovered}/${paused.length} agente(s) reactivado(s)`);
  return { candidates: paused.length, recovered };
}

export function startRecoveryScheduler(): void {
  registerScheduler("agentRecovery", CHECK_INTERVAL_MS);
  setInterval(() => {
    runRecoveryCheck().catch((e) => console.error("[agentRecovery] error en check:", e));
  }, CHECK_INTERVAL_MS);
  console.info("[agentRecovery] Scheduler activo — revisa agentes auto-pausados cada 10 min");
}
