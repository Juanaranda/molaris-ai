import { describe, it, expect } from "vitest";
import { ALLOWED_CONFIG_KEYS } from "../routes/clinics";

/**
 * El PATCH /clinics/:id rechaza el body COMPLETO si config trae una clave fuera
 * de la allowlist. Si el onboarding escribe una clave no permitida, el doctor
 * termina los 4 pasos y no se guarda nada (pasó con "onboardingDone").
 *
 * Este test fija el contrato: las claves que el setup manda al finalizar deben
 * estar permitidas. Si alguien agrega una clave nueva en el front sin sumarla
 * a la allowlist, esto falla acá y no en la cara del usuario.
 */
describe("Clinic.config — allowlist vs. lo que escribe el onboarding", () => {
  // Payload que arma app/partners/setup/page.tsx en finish()
  const CLAVES_QUE_ESCRIBE_EL_SETUP = [
    "tone",
    "schedule",
    "doctors",
    "services",
    "boxes",
    "onboardingDone",
  ];

  // Claves que el seed deja en Clinic.config. Importan porque ClinicProfileTab
  // guarda con { ...clinic.config, doctores } — reenvía la config completa, así
  // que una clave sembrada y no permitida rompe TODA edición del perfil.
  const CLAVES_QUE_SIEMBRA_EL_SEED = [
    "tone",
    "assistantName",
    "schedule",
    "doctors",
    "boxes",
    "services",
  ];

  // Claves que escribe components/ClinicProfileTab.tsx
  const CLAVES_QUE_ESCRIBE_EL_PERFIL = [
    "assistantName",
    "tone",
    "logoUrl",
    "doctors",
    "services",
    "boxes",
    "schedule",
  ];

  it("permite 'sedes' — las escribe Mi consulta en modo doctor independiente (#69)", () => {
    expect(ALLOWED_CONFIG_KEYS.has("sedes")).toBe(true);
  });

  it.each(CLAVES_QUE_SIEMBRA_EL_SEED)("permite '%s' (la siembra el seed)", (key) => {
    expect(ALLOWED_CONFIG_KEYS.has(key)).toBe(true);
  });

  it.each(CLAVES_QUE_ESCRIBE_EL_PERFIL)("permite '%s' (la escribe ClinicProfileTab)", (key) => {
    expect(ALLOWED_CONFIG_KEYS.has(key)).toBe(true);
  });

  it.each(CLAVES_QUE_ESCRIBE_EL_SETUP)("permite '%s' (la escribe el setup)", (key) => {
    expect(ALLOWED_CONFIG_KEYS.has(key)).toBe(true);
  });

  it("permite 'onboardingDone' — el dashboard la lee para saber si el setup terminó", () => {
    expect(ALLOWED_CONFIG_KEYS.has("onboardingDone")).toBe(true);
  });

  it("sigue rechazando claves arbitrarias (la allowlist no es un colador)", () => {
    for (const key of ["__proto__", "apiKey", "plan", "cualquierCosa"]) {
      expect(ALLOWED_CONFIG_KEYS.has(key)).toBe(false);
    }
  });
});
