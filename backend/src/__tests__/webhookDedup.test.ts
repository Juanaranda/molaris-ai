import { describe, it, expect, beforeEach } from "vitest";
import { markSeen, _resetWebhookDedup } from "../lib/webhookDedup";

// Se testea markSeen (lógica pura, sin el bypass de test env de
// isDuplicateWebhookEvent).
describe("webhookDedup", () => {
  beforeEach(() => _resetWebhookDedup());

  it("un id nuevo no es duplicado; el mismo id repetido sí", () => {
    expect(markSeen("meta", "wamid-1")).toBe(false);
    expect(markSeen("meta", "wamid-1")).toBe(true);
    expect(markSeen("meta", "wamid-1")).toBe(true);
  });

  it("los namespaces son independientes (meta vs twilio)", () => {
    expect(markSeen("meta", "X")).toBe(false);
    // mismo id en otro namespace no colisiona
    expect(markSeen("twilio", "X")).toBe(false);
    // y cada uno recuerda el suyo
    expect(markSeen("meta", "X")).toBe(true);
    expect(markSeen("twilio", "X")).toBe(true);
  });

  it("id vacío nunca se considera duplicado (no hay id que deduplicar)", () => {
    expect(markSeen("twilio", "")).toBe(false);
    expect(markSeen("twilio", "")).toBe(false);
  });

  it("_reset limpia el estado entre corridas", () => {
    expect(markSeen("meta", "a")).toBe(false);
    expect(markSeen("meta", "a")).toBe(true);
    _resetWebhookDedup();
    expect(markSeen("meta", "a")).toBe(false);
  });
});
