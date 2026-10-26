import { describe, it, expect } from "vitest";
import { validarEncuesta, validarCampanaInactivos } from "../lib/mensajesAutomaticos";

/**
 * Lo que Configuración guarda de la encuesta y de la campaña a pacientes que
 * no han vuelto: la forma del formulario y nada más.
 */
describe("validarEncuesta", () => {
  const buena = { enabled: true, hoursAfter: 2, message: "Hola {nombre}, ¿cómo fue tu visita a {clinica}?" };

  it("acepta lo que manda el formulario", () => {
    expect(validarEncuesta(buena)).toEqual({ ok: true, valor: buena });
  });

  it("acepta el formato antiguo (solo prendida o apagada)", () => {
    expect(validarEncuesta(true)).toEqual({ ok: true, valor: true });
    expect(validarEncuesta(false)).toEqual({ ok: true, valor: false });
  });

  it("guarda solo los campos conocidos, con el mensaje sin espacios de sobra", () => {
    const r = validarEncuesta({ ...buena, message: "  Hola  ", extra: "<script>" });
    expect(r).toEqual({ ok: true, valor: { enabled: true, hoursAfter: 2, message: "Hola" } });
  });

  it.each([
    ["sin horas", { ...buena, hoursAfter: undefined }],
    ["horas vacías (NaN llega como null)", { ...buena, hoursAfter: null }],
    ["0 horas", { ...buena, hoursAfter: 0 }],
    ["más de 72 horas", { ...buena, hoursAfter: 73 }],
    ["horas con decimales", { ...buena, hoursAfter: 1.5 }],
    ["mensaje vacío", { ...buena, message: "   " }],
    ["mensaje de más de 1000 caracteres", { ...buena, message: "a".repeat(1001) }],
    ["enabled que no es booleano", { ...buena, enabled: "sí" }],
    ["un texto", "prendida"],
  ])("rechaza %s", (_, v) => {
    expect(validarEncuesta(v).ok).toBe(false);
  });
});

describe("validarCampanaInactivos", () => {
  const buena = { enabled: false, daysInactive: 90, message: "Hola {nombre}, te echamos de menos en {clinica}." };

  it("acepta lo que manda el formulario", () => {
    expect(validarCampanaInactivos(buena)).toEqual({ ok: true, valor: buena });
  });

  it.each([
    ["menos de 30 días", { ...buena, daysInactive: 29 }],
    ["más de 365 días", { ...buena, daysInactive: 366 }],
    ["días vacíos", { ...buena, daysInactive: null }],
    ["mensaje vacío", { ...buena, message: "" }],
    ["sin enabled", { daysInactive: 90, message: "Hola" }],
    ["el formato booleano (la campaña nunca lo tuvo)", true],
  ])("rechaza %s", (_, v) => {
    expect(validarCampanaInactivos(v).ok).toBe(false);
  });
});
