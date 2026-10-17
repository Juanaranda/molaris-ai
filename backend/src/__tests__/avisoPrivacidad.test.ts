import { describe, it, expect, vi } from "vitest";

vi.mock("../config/prisma", () => ({ default: {} }));
vi.mock("../services/ai/claudeService", () => ({ getAIResponse: vi.fn() }));

const { avisoPrivacidadWhatsApp } = await import("../lib/avisoPrivacidad");
const { twiml } = await import("../routes/webhooks");

/**
 * Aviso al paciente antes de conversar con el asistente (MOL-11, borrador
 * pendiente de revisión legal).
 */
describe("avisoPrivacidadWhatsApp", () => {
  const aviso = avisoPrivacidadWhatsApp("Galana Clínica Dental", "https://molari-beta.vercel.app/");

  it("dice que responde una IA, de qué clínica, y que se procesa fuera de Chile", () => {
    expect(aviso).toContain("asistente de inteligencia artificial de Galana Clínica Dental");
    expect(aviso).toContain("fuera de Chile");
  });

  it("enlaza la política de privacidad, sin doble barra, y dice que es borrador", () => {
    expect(aviso).toContain("Política de privacidad (borrador): https://molari-beta.vercel.app/legal/privacidad");
  });
});

describe("twiml", () => {
  it("una conversación nueva manda el aviso y después la respuesta, en ese orden", () => {
    const xml = twiml("Aviso", "Respuesta");
    expect(xml.indexOf("<Message>Aviso</Message>")).toBeLessThan(xml.indexOf("<Message>Respuesta</Message>"));
  });

  it("escapa lo que rompería el XML (el texto viene de la IA y del nombre de la clínica)", () => {
    expect(twiml("Rojas & Cía <clínica>")).toContain("<Message>Rojas &amp; Cía &lt;clínica&gt;</Message>");
  });
});
