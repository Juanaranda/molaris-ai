import prisma from "../../config/prisma";
import { config } from "../../config/env";
import { triggerAlert } from "../alerts/alertService";

/**
 * Presupuesto diario de IA por clínica + anti-abuso del chat público (#59).
 *
 * - checkDailyBudget: suma el costUsd del día (UsageEvent) con cache de 1 min.
 *   Al superar el cap, auto-pausa el agente (mismo kill switch de #49) y alerta.
 *   Fail-open: un error del guard NUNCA bloquea el chat.
 * - allowNewSession / allowMessage: contadores en memoria por IP para que
 *   crear sesiones o spamear mensajes no permita quemar tokens sin techo
 *   (el cap de 30 mensajes es por sesión, pero crear sesiones era gratis).
 */

// ── Presupuesto diario ────────────────────────────────────────────────────────

const CACHE_MS = 60_000;
const spendCache = new Map<string, { spentUsd: number; at: number }>();

/** Gasto del día (desde las 00:00 hora del server) para una clínica, cacheado. */
export async function getDailySpendUsd(clinicId: string): Promise<number> {
  const hit = spendCache.get(clinicId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.spentUsd;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const agg = await prisma.usageEvent.aggregate({
    where: { clinicId, createdAt: { gte: startOfDay } },
    _sum: { costUsd: true },
  });
  const spentUsd = agg._sum.costUsd ?? 0;
  spendCache.set(clinicId, { spentUsd, at: Date.now() });
  return spentUsd;
}

/**
 * true = dentro del presupuesto (o guard deshabilitado / con error).
 * false = cap excedido → el agente ya quedó auto-pausado y alertado.
 * El cap por clínica sale de clinic.config.aiDailyBudgetUsd; si no, del env.
 */
export async function checkDailyBudget(
  clinicId: string,
  clinicName: string,
  capOverrideUsd?: number,
): Promise<boolean> {
  const capUsd = capOverrideUsd ?? config.ai.dailyBudgetUsd;
  if (!Number.isFinite(capUsd) || capUsd <= 0) return true; // 0 = sin límite

  try {
    const spentUsd = await getDailySpendUsd(clinicId);
    if (spentUsd < capUsd) return true;

    await pauseAgentForBudget(clinicId, clinicName, spentUsd, capUsd);
    return false;
  } catch (e) {
    console.error("[budgetGuard]", e instanceof Error ? e.message : e);
    return true; // fail-open
  }
}

async function pauseAgentForBudget(
  clinicId: string,
  clinicName: string,
  spentUsd: number,
  capUsd: number,
): Promise<void> {
  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    select: { agentEnabled: true },
  });
  if (!clinic || clinic.agentEnabled === false) return; // ya está apagado

  await prisma.clinic.update({
    where: { id: clinicId },
    data: {
      agentEnabled: false,
      agentDisabledAt: new Date(),
      agentDisabledReason: `Auto-pausa: presupuesto diario de IA excedido (USD ${spentUsd.toFixed(2)} de ${capUsd.toFixed(2)})`,
      // "budget" ≠ "auto" (#58): esta pausa NO se levanta porque el proveedor
      // de IA vuelva, sino cuando el gasto del día baja del cap — es decir, a
      // la medianoche. Sin distinguirlas, la recuperación por salud del
      // proveedor reactivaría una clínica que se pasó de presupuesto.
      agentDisabledBy: "budget",
    },
  });

  await triggerAlert({
    kind: "ai_budget_exceeded",
    severity: "critical",
    message: `Agente AUTO-PAUSADO en ${clinicName}: gasto de IA del día USD ${spentUsd.toFixed(2)} superó el cap de USD ${capUsd.toFixed(2)}`,
    detail: { clinicId, spentUsd, capUsd },
    cooldownMs: 0,
  });
}

// ── Anti-abuso por IP (en memoria; se resetea al reiniciar, OK) ───────────────

const MAX_NEW_SESSIONS_PER_IP_DAY = Number(process.env.CHAT_MAX_NEW_SESSIONS_PER_IP_DAY ?? 25);
const MAX_MESSAGES_PER_IP_HOUR    = Number(process.env.CHAT_MAX_MESSAGES_PER_IP_HOUR ?? 80);

interface WindowCounter { count: number; windowStart: number }
const sessionCounters = new Map<string, WindowCounter>();
const messageCounters = new Map<string, WindowCounter>();

function bumpWindow(map: Map<string, WindowCounter>, key: string, windowMs: number, max: number): boolean {
  const now = Date.now();
  let c = map.get(key);
  if (!c || now - c.windowStart > windowMs) {
    c = { count: 0, windowStart: now };
    map.set(key, c);
  }
  c.count += 1;
  // Limpieza oportunista para no crecer sin límite
  if (map.size > 10_000) {
    for (const [k, v] of map) if (now - v.windowStart > windowMs) map.delete(k);
  }
  return c.count <= max;
}

/** Límite de sesiones NUEVAS por IP por día. true = permitido. */
export function allowNewSession(ip: string): boolean {
  if (config.nodeEnv === "test") return true;
  return bumpWindow(sessionCounters, ip, 24 * 60 * 60 * 1000, MAX_NEW_SESSIONS_PER_IP_DAY);
}

/** Límite de mensajes por IP por hora. true = permitido. */
export function allowMessage(ip: string): boolean {
  if (config.nodeEnv === "test") return true;
  return bumpWindow(messageCounters, ip, 60 * 60 * 1000, MAX_MESSAGES_PER_IP_HOUR);
}
