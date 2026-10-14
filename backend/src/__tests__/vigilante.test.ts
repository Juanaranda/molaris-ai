import { describe, it, expect, vi } from "vitest";

vi.mock("../config/prisma", () => ({ default: {} }));

const {
  evaluarVigilancia, ESTADO_INICIAL, FALLAS_PARA_ALERTAR, UMBRAL_ERRORES,
  registrarRespuesta, erroresRecientes, VENTANA_ERRORES_MS, _resetVigilante,
} = await import("../services/alerts/vigilante");

/**
 * Cuándo el vigilante avisa y cuándo se queda callado (MOL-42). El caso que lo
 * motivó: la base de beta caída una semana (29/9) sin que nadie se enterara.
 */

const SANA = { dbOk: true, schedulers: [{ name: "reminder", ok: true }], errores5xx: 0 };
const SIN_BASE = { ...SANA, dbOk: false };

function correr(lecturas: (typeof SANA)[]) {
  let estado = ESTADO_INICIAL;
  const todas: string[][] = [];
  for (const l of lecturas) {
    const r = evaluarVigilancia(estado, l);
    estado = r.estado;
    todas.push(r.alertas.map((a) => a.kind));
  }
  return todas;
}

describe("base de datos", () => {
  it("un corte de una sola vuelta no es alerta", () => {
    expect(correr([SIN_BASE, SANA]).flat()).toEqual([]);
  });

  it(`avisa a la ${FALLAS_PARA_ALERTAR}ª falla seguida, una sola vez mientras dure`, () => {
    const r = correr([SIN_BASE, SIN_BASE, SIN_BASE, SIN_BASE]);
    expect(r).toEqual([[], ["db_unreachable"], [], []]);
  });

  it("avisa cuando vuelve", () => {
    const r = correr([SIN_BASE, SIN_BASE, SANA, SANA]);
    expect(r).toEqual([[], ["db_unreachable"], ["db_recovered"], []]);
  });

  it("la alerta dice qué deja de funcionar", () => {
    const { alertas } = evaluarVigilancia({ ...ESTADO_INICIAL, fallasDb: FALLAS_PARA_ALERTAR - 1 }, SIN_BASE);
    expect(alertas[0].severity).toBe("critical");
    expect(alertas[0].message).toMatch(/agenda/);
  });
});

describe("schedulers", () => {
  const pegado = { ...SANA, schedulers: [{ name: "reminder", ok: false }] };

  it("avisa cuando uno se pega y cuando vuelve, sin repetir", () => {
    expect(correr([SANA, pegado, pegado, SANA])).toEqual([[], ["scheduler_stalled"], [], ["scheduler_recovered"]]);
  });

  it("el mensaje nombra el scheduler", () => {
    const { alertas } = evaluarVigilancia(ESTADO_INICIAL, pegado);
    expect(alertas[0].message).toContain('"reminder"');
  });
});

describe("racha de errores", () => {
  it("bajo el umbral no avisa; en el umbral sí", () => {
    expect(evaluarVigilancia(ESTADO_INICIAL, { ...SANA, errores5xx: UMBRAL_ERRORES - 1 }).alertas).toEqual([]);
    expect(evaluarVigilancia(ESTADO_INICIAL, { ...SANA, errores5xx: UMBRAL_ERRORES }).alertas[0].kind).toBe("error_spike");
  });

  it("con la base caída no suma ruido: la causa ya está avisada", () => {
    const caida = { ...ESTADO_INICIAL, dbCaida: true, fallasDb: 5 };
    const { alertas } = evaluarVigilancia(caida, { ...SIN_BASE, errores5xx: 200 });
    expect(alertas).toEqual([]);
  });

  it("cuenta solo los 5xx dentro de la ventana", () => {
    _resetVigilante();
    const t0 = 1_000_000;
    registrarRespuesta(200, t0);
    registrarRespuesta(404, t0);
    registrarRespuesta(500, t0);
    registrarRespuesta(503, t0 + 1000);
    expect(erroresRecientes(t0 + 2000)).toBe(2);
    expect(erroresRecientes(t0 + VENTANA_ERRORES_MS + 1500)).toBe(0);
  });
});
