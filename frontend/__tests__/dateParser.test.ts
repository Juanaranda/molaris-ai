import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { getMondayOf, getMondayOfCurrentWeek, parsePreferredDate, toLocalDateStr } from "@/lib/dateParser";

/**
 * El navegador del paciente está en Chile. Se fija la TZ para que el test no
 * dependa de la máquina: con `toISOString()` el sábado 17-oct-2026 a las 23:39
 * el widget pidió weekStart=2026-10-13 (un martes), porque en UTC ya era
 * domingo 18 y el "lunes" corría un día.
 */
const tzOriginal = process.env.TZ;
beforeAll(() => { process.env.TZ = "America/Santiago"; });
afterAll(() => { process.env.TZ = tzOriginal; });
afterEach(() => { vi.useRealTimers(); });

const SABADO_NOCHE = new Date("2026-10-17T23:30:00-03:00");

function congelar(instante: Date) {
  vi.useFakeTimers();
  vi.setSystemTime(instante);
}

describe("toLocalDateStr", () => {
  it("da el día de Chile aunque en UTC ya sea el día siguiente", () => {
    expect(toLocalDateStr(SABADO_NOCHE)).toBe("2026-10-17");
  });
});

describe("getMondayOfCurrentWeek", () => {
  it("sábado 23:30 en Santiago → lunes 12-oct, no martes 13", () => {
    congelar(SABADO_NOCHE);
    expect(getMondayOfCurrentWeek()).toBe("2026-10-12");
  });

  it("corre semanas completas con el offset", () => {
    congelar(SABADO_NOCHE);
    expect(getMondayOfCurrentWeek(1)).toBe("2026-10-19");
    expect(getMondayOfCurrentWeek(-1)).toBe("2026-10-05");
  });

  it("domingo en la noche sigue en la semana del lunes anterior", () => {
    congelar(new Date("2026-10-18T22:00:00-03:00"));
    expect(getMondayOfCurrentWeek()).toBe("2026-10-12");
  });

  it("en horario de invierno (UTC-4) también", () => {
    congelar(new Date("2026-07-04T23:30:00-04:00"));
    expect(getMondayOfCurrentWeek()).toBe("2026-06-29");
  });
});

describe("getMondayOf", () => {
  it("devuelve el lunes de la fecha dada", () => {
    expect(getMondayOf("2026-10-17")).toBe("2026-10-12");
    expect(getMondayOf("2026-10-12")).toBe("2026-10-12");
  });
});

describe("parsePreferredDate", () => {
  it("'hoy' a las 23:30 es hoy, no mañana", () => {
    congelar(SABADO_NOCHE);
    expect(parsePreferredDate("quiero hora para hoy")).toBe("2026-10-17");
  });

  it("un día de la semana se resuelve en hora local", () => {
    congelar(SABADO_NOCHE);
    expect(parsePreferredDate("el lunes")).toBe("2026-10-19");
  });

  it("'pasado mañana' son dos días, no uno", () => {
    congelar(SABADO_NOCHE);
    expect(parsePreferredDate("¿tienen hora pasado mañana?")).toBe("2026-10-19");
    expect(parsePreferredDate("y mañana?")).toBe("2026-10-18");
  });
});
