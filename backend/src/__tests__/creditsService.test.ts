import { describe, it, expect } from "vitest";
import { parseCreditsResponse, LOW_CREDIT_THRESHOLD_USD } from "../services/ai/creditsService";

/**
 * El parseo del saldo de OpenRouter. Importa distinguir "no pude leer" (null)
 * de "saldo 0": si un cambio de formato o un error de red se leyera como cero,
 * se dispararían alertas de saldo agotado con la cuenta llena.
 */
describe("creditsService — parseo del saldo", () => {
  it("calcula el restante a partir de créditos y uso", () => {
    const info = parseCreditsResponse({ data: { total_credits: 10, total_usage: 3.5 } })!;
    expect(info.totalCredits).toBe(10);
    expect(info.totalUsage).toBe(3.5);
    expect(info.remaining).toBe(6.5);
    expect(info.low).toBe(false);
  });

  it("marca saldo bajo al llegar al umbral", () => {
    const info = parseCreditsResponse({ data: { total_credits: 10, total_usage: 8 } })!;
    expect(info.remaining).toBe(LOW_CREDIT_THRESHOLD_USD);
    expect(info.low).toBe(true);
  });

  it("un saldo agotado o negativo cuenta como bajo", () => {
    expect(parseCreditsResponse({ data: { total_credits: 5, total_usage: 5 } })!.low).toBe(true);
    expect(parseCreditsResponse({ data: { total_credits: 5, total_usage: 7 } })!.remaining).toBe(-2);
  });

  it("devuelve null si el formato no es el esperado (≠ saldo cero)", () => {
    expect(parseCreditsResponse(null)).toBeNull();
    expect(parseCreditsResponse({})).toBeNull();
    expect(parseCreditsResponse({ data: {} })).toBeNull();
    expect(parseCreditsResponse({ data: { total_credits: "n/a", total_usage: 1 } })).toBeNull();
    // formato nuevo hipotético: no se adivina, se reporta desconocido
    expect(parseCreditsResponse({ credits: 10 })).toBeNull();
  });
});
