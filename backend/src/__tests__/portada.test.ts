import { describe, it, expect } from "vitest";
import { validarPortada, PORTADAS } from "../lib/portada";
import { ALLOWED_CONFIG_KEYS } from "../routes/clinics";

/**
 * La portada de "Mi clínica" va a un style del panel: solo se aceptan las
 * predefinidas o un "#RRGGBB", nunca CSS libre.
 */
describe("validarPortada", () => {
  it("la clave está permitida en Clinic.config", () => {
    expect(ALLOWED_CONFIG_KEYS.has("portada")).toBe(true);
  });

  it.each(PORTADAS)("acepta la predefinida '%s'", (p) => {
    expect(validarPortada(p)).toEqual({ ok: true, valor: p });
  });

  it("acepta un color propio y lo deja en mayúsculas", () => {
    expect(validarPortada("#1a5c7a")).toEqual({ ok: true, valor: "#1A5C7A" });
  });

  it("vacío vuelve a la portada por defecto", () => {
    expect(validarPortada("")).toEqual({ ok: true, valor: undefined });
    expect(validarPortada(null)).toEqual({ ok: true, valor: undefined });
  });

  it.each([
    "red",
    "#fff",
    "#12345g",
    "url(https://malo.example/x.png)",
    "linear-gradient(red, blue)",
    "#1A5C7A; background: red",
    42,
  ])("rechaza %s", (v) => {
    expect(validarPortada(v).ok).toBe(false);
  });
});
