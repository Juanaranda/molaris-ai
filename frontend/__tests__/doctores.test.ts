import { describe, it, expect } from "vitest";
import { sinPrefijo, nombreCompleto, separarNombre, rutValido, formatearRut } from "@/lib/doctores";

describe("nombre del profesional", () => {
  it("no lleva Dr. ni Dra.", () => {
    expect(sinPrefijo("Dra. María González")).toBe("María González");
    expect(sinPrefijo("dr Juan Pérez")).toBe("Juan Pérez");
    expect(sinPrefijo("Drago Pérez")).toBe("Drago Pérez");
  });

  it("junta nombres y apellidos sin espacios de más", () => {
    expect(nombreCompleto("  María José ", " González  Pérez")).toBe("María José González Pérez");
    expect(nombreCompleto("Dra. Ana", "Rojas")).toBe("Ana Rojas");
  });

  it("separa los nombres guardados antes como se escriben en Chile", () => {
    expect(separarNombre("Dr. Juan Pérez")).toEqual({ nombres: "Juan", apellidos: "Pérez" });
    expect(separarNombre("Ivonne Poblete Soto")).toEqual({ nombres: "Ivonne", apellidos: "Poblete Soto" });
    expect(separarNombre("María José González Pérez")).toEqual({ nombres: "María José", apellidos: "González Pérez" });
    expect(separarNombre("Ana")).toEqual({ nombres: "Ana", apellidos: "" });
  });
});

describe("RUT", () => {
  it("valida el dígito verificador", () => {
    expect(rutValido("12.345.678-5")).toBe(true);
    expect(rutValido("12345678-9")).toBe(false);
    expect(rutValido("hola")).toBe(false);
  });

  it("da formato mientras se escribe", () => {
    expect(formatearRut("123456785")).toBe("12.345.678-5");
    expect(formatearRut("12.345.678-k")).toBe("12.345.678-K");
    expect(formatearRut("1")).toBe("1");
  });
});
