import { describe, it, expect } from "vitest";
import { calcularPlazo, PLAZO_BASE_HORAS } from "../services/booking/confirmation";

/**
 * Plazo para confirmar una hora pedida por el agente.
 *
 * El caso que obliga a que esto no sea "24 horas y ya": si el paciente pide
 * hora para mañana a las 9, un plazo de 24h vencería DESPUÉS de la propia
 * cita, y el paciente llegaría a una hora que nadie confirmó ni canceló.
 */
const HORA = 3_600_000;

describe("calcularPlazo", () => {
  const ahora = new Date("2026-08-21T10:00:00");

  it("con la cita lejana usa el plazo base", () => {
    const dentroDeUnMes = new Date("2026-09-21T10:00:00");
    const plazo = calcularPlazo(dentroDeUnMes, ahora);
    expect(plazo.getTime()).toBe(ahora.getTime() + PLAZO_BASE_HORAS * HORA);
  });

  it("nunca vence después de la cita", () => {
    // Cita mañana a las 09:00 → faltan 23h, menos que el plazo base de 24h.
    const manana = new Date("2026-08-22T09:00:00");
    const plazo = calcularPlazo(manana, ahora);
    expect(plazo.getTime()).toBeLessThan(manana.getTime());
  });

  it("con la cita cerca deja la mitad del tiempo que falta", () => {
    // Faltan 10 horas → el plazo son 5.
    const enDiezHoras = new Date(ahora.getTime() + 10 * HORA);
    const plazo = calcularPlazo(enDiezHoras, ahora);
    expect(plazo.getTime()).toBe(ahora.getTime() + 5 * HORA);
  });

  it("con la cita inminente da un minuto, no un plazo negativo", () => {
    const yaPaso = new Date(ahora.getTime() - HORA);
    const plazo = calcularPlazo(yaPaso, ahora);
    expect(plazo.getTime()).toBe(ahora.getTime() + 60_000);
    expect(plazo.getTime()).toBeGreaterThan(ahora.getTime());
  });

  it("el plazo siempre deja margen para avisarle al paciente", () => {
    // Sea cual sea la distancia, entre el vencimiento y la cita queda tiempo.
    for (const horas of [1, 3, 12, 23, 25, 100]) {
      const cita = new Date(ahora.getTime() + horas * HORA);
      const plazo = calcularPlazo(cita, ahora);
      expect(plazo.getTime()).toBeLessThan(cita.getTime());
    }
  });
});
