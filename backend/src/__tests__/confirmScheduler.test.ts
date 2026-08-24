import { describe, it, expect } from "vitest";
import { recordatoriosQueTocan } from "../services/booking/confirmScheduler";
import { RECORDATORIOS_HORAS } from "../services/booking/confirmation";

/**
 * Escalonado de recordatorios al profesional.
 *
 * El scheduler corre cada 15 minutos, así que una solicitud cruza la marca de
 * las 2h en cualquier punto de ese intervalo. Lo que hay que garantizar es que
 * no mande el mismo aviso dos veces ni se salte uno — de ahí que la cuenta sea
 * "cuántos corresponden a esta altura" y no "manda uno ahora".
 */
describe("recordatoriosQueTocan", () => {
  it("no molesta al profesional apenas llega la solicitud", () => {
    expect(recordatoriosQueTocan(0)).toBe(0);
    expect(recordatoriosQueTocan(1.9)).toBe(0);
  });

  it("manda el primero al cruzar las 2 horas", () => {
    expect(recordatoriosQueTocan(2)).toBe(1);
    expect(recordatoriosQueTocan(5.9)).toBe(1);
  });

  it("manda el segundo al cruzar las 6 horas", () => {
    expect(recordatoriosQueTocan(6)).toBe(2);
  });

  it("no sigue mandando después del último: se escala, no se insiste", () => {
    expect(recordatoriosQueTocan(12)).toBe(RECORDATORIOS_HORAS.length);
    expect(recordatoriosQueTocan(48)).toBe(RECORDATORIOS_HORAS.length);
  });

  it("la cuenta nunca baja al pasar el tiempo", () => {
    let previo = 0;
    for (const h of [0, 1, 2, 3, 6, 7, 24]) {
      const n = recordatoriosQueTocan(h);
      expect(n).toBeGreaterThanOrEqual(previo);
      previo = n;
    }
  });
});
