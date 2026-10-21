import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";

const prisma = vi.hoisted(() => ({
  clinic: { findUnique: vi.fn() },
  booking: { findMany: vi.fn() },
}));
vi.mock("../config/prisma", () => ({ default: prisma }));
vi.mock("../services/notifications/whatsappService", () => ({ sendBookingNotification: vi.fn() }));
vi.mock("../services/booking/notifyProfessional", () => ({ avisarProfesional: vi.fn() }));

const { bookRoutes } = await import("../routes/book");

/**
 * `GET /book/:slug/slots` solo entendía `schedule` ("Lun/Mié/Vie"): a los
 * profesionales del onboarding (`days: ["monday", …]`) nunca les daba horas y
 * nadie podía reservar con ellos desde la página pública.
 */
describe("horas disponibles en la página pública", () => {
  const doctors = [
    { name: "Ana Rojas", specialty: "General", days: ["monday", "wednesday"] },
    { name: "Pedro Engel", specialty: "General", schedule: "Mar/Jue/Sáb" },
  ];

  async function pedir(query: string) {
    const app = Fastify();
    await app.register(bookRoutes);
    const res = await app.inject({ url: `/book/aurora/slots?${query}` });
    return res.json() as { slots: { doctor: string; availableSlots: string[] }[] };
  }

  beforeEach(() => {
    prisma.clinic.findUnique.mockResolvedValue({ id: "c1", active: true, config: { doctors } });
    prisma.booking.findMany.mockResolvedValue([]);
  });

  it("da horas a un profesional del onboarding el día que atiende", async () => {
    // 2026-10-19 es lunes.
    const { slots } = await pedir("date=2026-10-19&doctor=Ana%20Rojas");
    expect(slots).toHaveLength(1);
    expect(slots[0].doctor).toBe("Ana Rojas");
    expect(slots[0].availableSlots).toContain("10:00");
  });

  it("no le da horas el día que no atiende", async () => {
    const { slots } = await pedir("date=2026-10-20&doctor=Ana%20Rojas");
    expect(slots).toEqual([]);
  });

  it("sigue funcionando con el formato viejo y mezcla ambos sin doctor elegido", async () => {
    // 2026-10-24 es sábado: solo Pedro; 2026-10-21 es miércoles: solo Ana.
    expect((await pedir("date=2026-10-24")).slots.map((s) => s.doctor)).toEqual(["Pedro Engel"]);
    expect((await pedir("date=2026-10-21")).slots.map((s) => s.doctor)).toEqual(["Ana Rojas"]);
  });

  it("descuenta las horas ya tomadas", async () => {
    prisma.booking.findMany.mockResolvedValue([{ time: "10:00", doctor: "Ana Rojas" }]);
    const { slots } = await pedir("date=2026-10-19&doctor=Ana%20Rojas");
    expect(slots[0].availableSlots).not.toContain("10:00");
    expect(slots[0].availableSlots).toContain("10:30");
  });
});
