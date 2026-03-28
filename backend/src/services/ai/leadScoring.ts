import type { PatientContextUpdate } from "./claudeService";

/**
 * Scoring determinista — no depende del LLM para el número final.
 * El AI extrae las señales (intent, urgency, service, name).
 * Nosotros calculamos el score de forma consistente y predecible.
 *
 * Escala 0–100:
 *   Intención  → peso mayor (60 pts máx)
 *   Urgencia   → señal de valor (25 pts máx)
 *   Nombre     → muestra compromiso real (10 pts)
 *   Servicio   → especificidad = intención clara (5 pts)
 */

const INTENT_SCORE: Record<string, number> = {
  ready_to_book: 60,
  evaluating:    30,
  just_browsing: 10,
};

const URGENCY_BONUS: Record<string, number> = {
  high:   25,
  medium: 15,
  low:     5,
};

export function computeScore(ctx: PatientContextUpdate): number {
  const intent  = INTENT_SCORE[ctx.intent  ?? "just_browsing"] ?? 10;
  const urgency = URGENCY_BONUS[ctx.urgency ?? "low"]          ?? 5;
  const hasName    = ctx.patientName    && ctx.patientName.trim().length > 1 ? 10 : 0;
  const hasService = ctx.serviceInterest && ctx.serviceInterest.trim().length > 1 ? 5  : 0;

  return Math.min(100, intent + urgency + hasName + hasService);
}
