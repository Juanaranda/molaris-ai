import { describe, it, expect } from "vitest";
import { queFaltaEn, type DatosOnboarding } from "@/lib/onboardingValidation";

/**
 * Reglas mínimas del onboarding.
 *
 * Nace de un bug que reportó Juan: el asistente dejaba avanzar sin llenar nada
 * y terminaba creando una clínica que el agente no podía usar. Cada regla acá
 * corresponde a algo que el agente necesita para funcionar, no a un campo
 * obligatorio por gusto.
 */

const COMPLETO: DatosOnboarding = {
  esSolo: false,
  nombreClinica: "Clínica Dental Aurora",
  telefono: "+56 2 2345 6789",
  ubicacion: "Providencia, Santiago",
  doctores: [{ name: "Dr. Ivonne Poblete", days: ["monday", "wednesday"], phone: "+56 9 8765 4321" }],
  horario: [
    { open: true,  from: "09:00", to: "18:00" },
    { open: false, from: "09:00", to: "13:00" },
  ],
};

describe("paso 2 — datos de la clínica", () => {
  it("deja pasar cuando está completo", () => {
    expect(queFaltaEn(2, COMPLETO)).toBeNull();
  });

  it("exige nombre, porque el asistente lo usa para presentarse", () => {
    expect(queFaltaEn(2, { ...COMPLETO, nombreClinica: "   " })).toMatch(/nombre/i);
  });

  it("al doctor independiente no le exige nombre de consulta: se usa el suyo", () => {
    expect(queFaltaEn(2, { ...COMPLETO, esSolo: true, nombreClinica: "" })).toBeNull();
  });

  it("exige teléfono y ubicación también al doctor independiente", () => {
    expect(queFaltaEn(2, { ...COMPLETO, esSolo: true, nombreClinica: "", telefono: "" })).toMatch(/teléfono/i);
    expect(queFaltaEn(2, { ...COMPLETO, esSolo: true, nombreClinica: "", ubicacion: "" })).toMatch(/ciudad|comuna/i);
  });
});

describe("paso 3 — equipo (todo opcional, MOL-54)", () => {
  it("pide al menos un profesional, con nombre o con correo", () => {
    expect(queFaltaEn(3, { ...COMPLETO, doctores: [] })).toMatch(/al menos un profesional/i);
    // Una fila en blanco no cuenta como profesional.
    expect(queFaltaEn(3, { ...COMPLETO, doctores: [{ name: "  ", days: ["monday"], email: " " }] })).toMatch(/al menos un profesional/i);
  });

  it("basta el correo: el resto lo completa el profesional con su invitación", () => {
    expect(queFaltaEn(3, { ...COMPLETO, doctores: [{ name: "", days: [], email: "rojas@clinica.cl" }] })).toBeNull();
  });

  it("basta el nombre: el WhatsApp y los días los puede poner él después", () => {
    expect(queFaltaEn(3, { ...COMPLETO, doctores: [{ name: "Camila Soto", days: [] }] })).toBeNull();
  });

  it("si ponen un correo, tiene que ser válido", () => {
    expect(queFaltaEn(3, { ...COMPLETO, doctores: [{ name: "Ana", days: ["monday"], email: "ana@" }] })).toMatch(/no es válido/);
  });

  it("ignora las filas vacías si hay al menos una con datos", () => {
    expect(queFaltaEn(3, {
      ...COMPLETO,
      doctores: [{ name: "Dr. Rojas", days: ["monday"] }, { name: "", days: [] }],
    })).toBeNull();
  });
});

describe("paso 4 — horario", () => {
  it("exige al menos un día abierto", () => {
    const cerrado = COMPLETO.horario.map((d) => ({ ...d, open: false }));
    expect(queFaltaEn(4, { ...COMPLETO, horario: cerrado })).toMatch(/al menos un día/i);
  });

  it("no acepta un día que cierra antes de abrir", () => {
    expect(queFaltaEn(4, {
      ...COMPLETO,
      horario: [{ open: true, from: "18:00", to: "09:00" }],
    })).toMatch(/cierra antes de abrir/i);
  });

  it("no mira los horarios de los días cerrados", () => {
    // Un día cerrado con horas invertidas no debe frenar: no se usa.
    expect(queFaltaEn(4, {
      ...COMPLETO,
      horario: [{ open: true, from: "09:00", to: "18:00" }, { open: false, from: "18:00", to: "09:00" }],
    })).toBeNull();
  });
});
