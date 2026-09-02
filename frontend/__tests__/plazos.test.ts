import { describe, it, expect } from "vitest";
import { restanteHasta } from "@/lib/plazos";

/**
 * El reloj va fijo: este cálculo depende del tiempo, y un fixture que use
 * `new Date()` real vuelve al test dependiente de la máquina — ya nos pasó con
 * el autocompletar de pacientes.
 */
const AHORA = new Date("2026-08-26T12:00:00.000Z");
const en = (ms: number) => new Date(AHORA.getTime() + ms).toISOString();

const MIN = 60_000;
const HORA = 60 * MIN;

describe("restanteHasta", () => {
  it("sin plazo no muestra nada", () => {
    expect(restanteHasta(null, AHORA)).toBeNull();
    expect(restanteHasta(undefined, AHORA)).toBeNull();
  });

  it("una fecha inválida no rompe la agenda", () => {
    expect(restanteHasta("cualquier cosa", AHORA)).toBeNull();
  });

  it("cuenta en minutos bajo la hora", () => {
    expect(restanteHasta(en(40 * MIN), AHORA)?.texto).toBe("en 40 min");
  });

  it("no dice 'en 0 min' en el último minuto", () => {
    // Redondea hacia arriba: quedan 30 segundos, pero mostrar 0 parece un error.
    expect(restanteHasta(en(30_000), AHORA)?.texto).toBe("en 1 min");
  });

  it("cuenta en horas sobre la hora, redondeando hacia abajo", () => {
    // 5 h 50 min se muestra como 5 h: prometer menos empuja a responder antes.
    expect(restanteHasta(en(5 * HORA + 50 * MIN), AHORA)?.texto).toBe("en 5 h");
  });

  it("marca urgente bajo las tres horas, y no sobre", () => {
    expect(restanteHasta(en(2 * HORA), AHORA)?.urgente).toBe(true);
    expect(restanteHasta(en(4 * HORA), AHORA)?.urgente).toBe(false);
    // El borde exacto todavía no es urgente.
    expect(restanteHasta(en(3 * HORA), AHORA)?.urgente).toBe(false);
  });

  it("distingue vencida de por vencer", () => {
    const pasada = restanteHasta(en(-MIN), AHORA);
    expect(pasada).toEqual({ texto: "vencida", urgente: true, vencida: true });
    expect(restanteHasta(en(MIN), AHORA)?.vencida).toBe(false);
  });

  it("el plazo base de 24 h se lee como horas, no como un día", () => {
    // calcularPlazo usa 24 h; justo bajo el límite debe seguir en horas.
    expect(restanteHasta(en(23 * HORA + 59 * MIN), AHORA)?.texto).toBe("en 23 h");
  });
});
