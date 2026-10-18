import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { fechaEnChile, lunesDeLaSemanaEnChile } from "../lib/fechaChile";

/* El servidor corre en UTC. Se fuerza esa TZ para que el test no pase solo
   porque la máquina de desarrollo está en Chile. */
const tzOriginal = process.env.TZ;
beforeAll(() => { process.env.TZ = "UTC"; });
afterAll(() => { process.env.TZ = tzOriginal; });

describe("fechaEnChile", () => {
  it("sábado 23:30 en Santiago sigue siendo sábado aunque en UTC ya sea domingo", () => {
    expect(fechaEnChile(new Date("2026-10-17T23:30:00-03:00"))).toBe("2026-10-17");
  });
});

describe("lunesDeLaSemanaEnChile", () => {
  it("sábado 17-oct-2026 23:30 en Santiago → lunes 12, no martes 13", () => {
    expect(lunesDeLaSemanaEnChile(new Date("2026-10-17T23:30:00-03:00"))).toBe("2026-10-12");
  });

  it("domingo en la noche todavía es la semana que empezó el lunes anterior", () => {
    expect(lunesDeLaSemanaEnChile(new Date("2026-10-18T22:00:00-03:00"))).toBe("2026-10-12");
  });

  it("lunes 00:30 en Santiago ya es la semana nueva", () => {
    expect(lunesDeLaSemanaEnChile(new Date("2026-10-19T00:30:00-03:00"))).toBe("2026-10-19");
  });

  it("funciona en horario de invierno (UTC-4)", () => {
    expect(lunesDeLaSemanaEnChile(new Date("2026-07-04T23:30:00-04:00"))).toBe("2026-06-29");
  });
});
