import prisma from "../../config/prisma";
import { triggerAlert } from "../alerts/alertService";

/**
 * Salud del agente IA + circuit breaker (Issue #50).
 *
 * Lleva en memoria los fallos CONSECUTIVOS de IA por clínica. Si superan el
 * umbral, auto-pausa el agente de esa clínica (mismo kill switch del #49) y
 * alerta al proveedor. En memoria = se resetea al reiniciar el proceso (OK).
 */

const THRESHOLD = 5; // fallos consecutivos antes de auto-pausar
const consecutiveFails = new Map<string, number>();

/** Llamar tras una respuesta de IA exitosa. */
export function recordAgentSuccess(clinicId: string): void {
  if (consecutiveFails.has(clinicId)) consecutiveFails.delete(clinicId);
}

/** Llamar cuando la IA falló (todos los proveedores caídos o excepción). */
export async function recordAgentFailure(
  clinicId: string,
  detail?: Record<string, unknown>
): Promise<void> {
  const n = (consecutiveFails.get(clinicId) ?? 0) + 1;
  consecutiveFails.set(clinicId, n);

  console.warn(`[agentHealth] Fallo de IA en clínica ${clinicId} (${n}/${THRESHOLD})`);
  if (n < THRESHOLD) return;

  // Llegó al umbral → auto-pausa
  consecutiveFails.delete(clinicId);
  try {
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { name: true, agentEnabled: true },
    });
    if (!clinic || clinic.agentEnabled === false) return; // ya está apagado

    await prisma.clinic.update({
      where: { id: clinicId },
      data: {
        agentEnabled: false,
        agentDisabledAt: new Date(),
        agentDisabledReason: `Auto-pausa: ${THRESHOLD} fallos consecutivos de IA`,
        // Marca que la pausa fue automática → elegible para auto-recuperación.
        agentDisabledBy: "auto",
      },
    });

    await triggerAlert({
      kind: "agent_disabled",
      severity: "critical",
      message: `Agente AUTO-PAUSADO en ${clinic.name} tras ${THRESHOLD} fallos consecutivos de IA`,
      detail: { clinicId, ...detail },
      cooldownMs: 0,
    });
  } catch (e) {
    console.error("[agentHealth] auto-pausa falló:", e instanceof Error ? e.message : e);
  }
}
