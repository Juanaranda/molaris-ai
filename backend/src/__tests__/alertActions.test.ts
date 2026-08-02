import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockSendMeta } = vi.hoisted(() => ({ mockSendMeta: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../services/whatsapp/metaService", () => ({ sendMetaMessage: mockSendMeta }));
vi.mock("../config/env", () => ({
  config: {
    frontendUrl: "https://beta.molari.ai",
    alerts: { adminPhoneId: "PID", adminToken: "TOK", adminPhone: "56900000000" },
  },
}));

const { triggerAlert, _resetAlertCooldowns } = await import("../services/alerts/alertService");

const sentText = () => mockSendMeta.mock.calls.at(-1)?.[3] as string | undefined;

describe("alertas accionables", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetAlertCooldowns();
  });

  it("la alerta de créditos trae el link para recargar", async () => {
    await triggerAlert({ kind: "ai_credits_exhausted", severity: "critical", message: "Sin saldo" });
    expect(sentText()).toContain("https://openrouter.ai/credits");
  });

  it("la de presupuesto explica que se reactiva sola y dónde subir el cap", async () => {
    await triggerAlert({ kind: "ai_budget_exceeded", severity: "critical", message: "Cap excedido" });
    const t = sentText()!;
    expect(t).toContain("medianoche");
    expect(t).toContain("https://beta.molari.ai/partners/dashboard");
  });

  it("las informativas no agregan acción (no hay nada que hacer)", async () => {
    await triggerAlert({ kind: "agent_enabled", severity: "info", message: "Agente encendido" });
    expect(sentText()).not.toContain("→");
  });

  it("el cooldown es por clínica: una no silencia a las otras", async () => {
    await triggerAlert({ kind: "agent_disabled", severity: "warn", message: "A", detail: { clinicId: "c1" } });
    await triggerAlert({ kind: "agent_disabled", severity: "warn", message: "B", detail: { clinicId: "c2" } });
    // Con la clave solo por kind, la segunda clínica quedaba silenciada 1 hora.
    expect(mockSendMeta).toHaveBeenCalledTimes(2);
  });

  it("la misma clínica sí respeta el cooldown", async () => {
    await triggerAlert({ kind: "agent_disabled", severity: "warn", message: "A", detail: { clinicId: "c1" } });
    await triggerAlert({ kind: "agent_disabled", severity: "warn", message: "A otra vez", detail: { clinicId: "c1" } });
    expect(mockSendMeta).toHaveBeenCalledTimes(1);
  });
});
