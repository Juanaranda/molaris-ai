import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

const prisma = vi.hoisted(() => ({ booking: { findMany: vi.fn().mockResolvedValue([]) } }));
vi.mock("../config/prisma", () => ({ default: prisma }));
vi.mock("../services/ai/claudeService", () => ({ getAIResponse: vi.fn() }));
vi.mock("../services/notifications/whatsappService", () => ({ sendBookingNotification: vi.fn() }));

const { buildAvailabilityHint } = await import("../controllers/chatController");

/* Lunes 19 de octubre de 2026 en Chile: el agente ve de martes 20 a sábado 24. */
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-19T10:00:00-03:00")); });
afterAll(() => { vi.useRealTimers(); });

/**
 * El agente recibe las horas libres de los próximos días. Solo leía
 * `schedule`: a los profesionales del onboarding (`days: ["monday", …]`) nunca
 * los ofrecía, y con una clínica configurada así el agente no tenía horas.
 */
describe("disponibilidad que ve el agente", () => {
  const cfg = {
    doctors: [
      { name: "Ana Rojas", specialty: "General", days: ["wednesday", "friday"] },
      { name: "Pedro Soto", specialty: "Endodoncia", schedule: "Mar/Jue/Sáb" },
    ],
  };

  /** Profesionales que aparecen bajo cada día del hint. */
  async function porDia() {
    const hint = await buildAvailabilityHint("c1", cfg);
    const dias: Record<string, string[]> = {};
    let actual = "";
    for (const linea of hint.split("\n")) {
      const dia = /^(\S+) \d+\/\d+:$/.exec(linea);
      if (dia) { actual = dia[1]; dias[actual] = []; continue; }
      const doc = /^ {2}(.+?) \(/.exec(linea);
      if (doc && actual) dias[actual].push(doc[1]);
    }
    return dias;
  }

  it("ofrece a los profesionales del onboarding los días que atienden", async () => {
    const dias = await porDia();
    expect(dias["Miércoles"]).toEqual(["Ana Rojas"]);
    expect(dias["Viernes"]).toEqual(["Ana Rojas"]);
  });

  it("sigue ofreciendo a los del formato viejo", async () => {
    const dias = await porDia();
    expect(dias["Martes"]).toEqual(["Pedro Soto"]);
    expect(dias["Jueves"]).toEqual(["Pedro Soto"]);
    expect(dias["Sábado"]).toEqual(["Pedro Soto"]);
  });
});
