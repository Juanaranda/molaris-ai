/**
 * Saldo de OpenRouter (#58, nivel 1).
 *
 * Hoy los créditos agotados se detectan de forma reactiva: una llamada falla
 * con 402/429 y recién ahí se alerta — o sea, el primer paciente que escribe
 * después de que se acabó el saldo no recibe respuesta. Consultar el saldo
 * permite avisar ANTES de quedarse sin agente.
 */

import { config } from "../../config/env";

const CREDITS_URL = "https://openrouter.ai/api/v1/credits";

// Umbral bajo el cual se considera saldo crítico (USD).
export const LOW_CREDIT_THRESHOLD_USD = 2;

export interface CreditsInfo {
  totalCredits: number;
  totalUsage: number;
  remaining: number;
  low: boolean;
  checkedAt: string;
}

/**
 * Cache en memoria. /health es público y lo pollea el monitoreo externo cada
 * minuto: sin cache serían ~1.400 llamadas diarias a OpenRouter y un riesgo
 * real de rate limit. El saldo no se mueve tan rápido como para necesitar
 * frescura de segundos.
 */
const TTL_MS = 5 * 60 * 1000;
let cache: { at: number; value: CreditsInfo | null } | null = null;

export function _resetCreditsCache(): void { cache = null; }

/** Normaliza la respuesta de OpenRouter. Devuelve null si no se puede leer. */
export function parseCreditsResponse(json: unknown): CreditsInfo | null {
  const data = (json as { data?: Record<string, unknown> })?.data;
  if (!data) return null;
  const totalCredits = Number(data.total_credits);
  const totalUsage = Number(data.total_usage);
  if (!isFinite(totalCredits) || !isFinite(totalUsage)) return null;
  const remaining = totalCredits - totalUsage;
  return {
    totalCredits,
    totalUsage,
    remaining,
    low: remaining <= LOW_CREDIT_THRESHOLD_USD,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Saldo actual. Devuelve null si no hay API key, si OpenRouter no responde o
 * si cambia el formato — el que llama debe tratar "no sé" como distinto de
 * "sin saldo", para no alertar por un problema de red.
 */
export async function getOpenRouterCredits(force = false): Promise<CreditsInfo | null> {
  if (!config.openRouter.apiKey) return null;
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.value;

  let value: CreditsInfo | null = null;
  try {
    const res = await fetch(CREDITS_URL, {
      headers: { Authorization: `Bearer ${config.openRouter.apiKey}` },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) value = parseCreditsResponse(await res.json());
    else console.warn(`[Credits] OpenRouter respondió ${res.status}`);
  } catch (e) {
    console.warn("[Credits] No se pudo consultar el saldo:", e instanceof Error ? e.message : e);
  }

  cache = { at: Date.now(), value };
  return value;
}
