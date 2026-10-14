import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * El canal de Telegram (MOL-42): las alertas tienen que llegar aunque la
 * cuenta de Meta no esté configurada, que era lo que las dejaba solo en el log.
 */

const { mockSendMeta, alertsConfig } = vi.hoisted(() => ({
  mockSendMeta: vi.fn().mockResolvedValue(undefined),
  alertsConfig: {
    adminPhoneId: "", adminToken: "", adminPhone: "",            // sin WhatsApp
    telegramToken: "123:ABC", telegramChatId: "999", ambiente: "beta",
  },
}));
vi.mock("../services/whatsapp/metaService", () => ({ sendMetaMessage: mockSendMeta }));
vi.mock("../config/env", () => ({ config: { frontendUrl: "https://beta.molari.ai", alerts: alertsConfig } }));

const { triggerAlert, _resetAlertCooldowns } = await import("../services/alerts/alertService");

const fetchMock = vi.fn();

describe("alertas por Telegram", () => {
  beforeEach(() => {
    _resetAlertCooldowns();
    fetchMock.mockReset().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    alertsConfig.telegramToken = "123:ABC";
  });

  it("llega por Telegram aunque WhatsApp no esté configurado", async () => {
    await triggerAlert({ kind: "db_unreachable", severity: "critical", message: "La base no responde" });
    expect(mockSendMeta).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.telegram.org/bot123:ABC/sendMessage");
    const body = JSON.parse(init.body);
    expect(body.chat_id).toBe("999");
  });

  it("dice de qué ambiente viene y trae el paso siguiente", async () => {
    await triggerAlert({ kind: "db_unreachable", severity: "critical", message: "La base no responde" });
    const { text } = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(text).toContain("[molari.ai · beta] CRITICAL");
    expect(text).toContain("console.neon.tech");
  });

  it("sin token no intenta nada", async () => {
    alertsConfig.telegramToken = "";
    await triggerAlert({ kind: "error_spike", severity: "warn", message: "x" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("si Telegram falla, la alerta no revienta a quien la disparó", async () => {
    fetchMock.mockRejectedValue(new Error("sin red"));
    await expect(triggerAlert({ kind: "error_spike", severity: "warn", message: "x" })).resolves.toBeUndefined();
  });
});
