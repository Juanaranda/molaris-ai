import { describe, it, expect } from "vitest";
import { MAX_SOLO_DOCTORS } from "../routes/clinics";

/**
 * Cap de profesionales del plan Solo (#69).
 *
 * Es el límite que protege el pricing: sin él, una clínica de 3 dentistas se
 * registra en el plan barato y carga a todo el equipo. El issue lo lista como
 * la mitigación de canibalización, así que si alguien lo sube "temporalmente"
 * conviene que falle un test y no la facturación.
 */
describe("plan Solo — tope de profesionales", () => {
  it("el tope es exactamente 1 profesional", () => {
    expect(MAX_SOLO_DOCTORS).toBe(1);
  });

  it("una cuenta solo con 2 doctores excede el tope", () => {
    const doctors = [{ name: "Dr. A" }, { name: "Dr. B" }];
    expect(doctors.length > MAX_SOLO_DOCTORS).toBe(true);
  });

  it("una cuenta solo con 1 doctor o vacía está dentro del tope", () => {
    expect([{ name: "Dr. A" }].length > MAX_SOLO_DOCTORS).toBe(false);
    expect([].length > MAX_SOLO_DOCTORS).toBe(false);
  });
});
