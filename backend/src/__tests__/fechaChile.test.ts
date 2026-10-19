import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { fechaEnChile, lunesDeLaSemanaEnChile, instanteEnChile, sumarDias, diaDeSemana } from "../lib/fechaChile";

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

describe("instanteEnChile", () => {
  it("10:00 en Santiago en verano (UTC-3) es 13:00 UTC", () => {
    expect(instanteEnChile("2026-10-19", "10:00").toISOString()).toBe("2026-10-19T13:00:00.000Z");
  });

  it("10:00 en Santiago en invierno (UTC-4) es 14:00 UTC", () => {
    expect(instanteEnChile("2026-08-03", "10:00").toISOString()).toBe("2026-08-03T14:00:00.000Z");
  });

  it("22:30 en Santiago ya es el día siguiente en UTC", () => {
    expect(instanteEnChile("2026-10-17", "22:30").toISOString()).toBe("2026-10-18T01:30:00.000Z");
  });

  it("el día del cambio a horario de verano (6-sep-2026) toma el desfase nuevo", () => {
    expect(instanteEnChile("2026-09-06", "10:00").toISOString()).toBe("2026-09-06T13:00:00.000Z");
  });
});

describe("sumarDias y diaDeSemana", () => {
  it("cruza fin de mes", () => {
    expect(sumarDias("2026-10-30", 3)).toBe("2026-11-02");
  });

  it("2026-10-19 es lunes y 2026-10-18 domingo", () => {
    expect(diaDeSemana("2026-10-19")).toBe(1);
    expect(diaDeSemana("2026-10-18")).toBe(0);
  });
});
