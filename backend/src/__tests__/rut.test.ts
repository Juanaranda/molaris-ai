import { describe, it, expect } from "vitest";
import { isValidRut, formatRut, cleanRut, computeDv } from "../lib/rut";

describe("RUT chileno", () => {
  it("valida RUTs correctos (con y sin formato)", () => {
    expect(isValidRut("12.345.678-5")).toBe(true);
    expect(isValidRut("12345678-5")).toBe(true);
    expect(isValidRut("123456785")).toBe(true);
    expect(isValidRut("11.111.111-1")).toBe(true);
  });

  it("valida RUT con dígito verificador K", () => {
    // 20.347.878-K es un RUT con DV = K
    const clean = cleanRut("20347878K");
    expect(computeDv(clean.slice(0, -1))).toBe("K");
    expect(isValidRut("20.347.878-K")).toBe(true);
    expect(isValidRut("20347878k")).toBe(true); // minúscula
  });

  it("rechaza dígito verificador incorrecto", () => {
    expect(isValidRut("12.345.678-9")).toBe(false);
    expect(isValidRut("11.111.111-2")).toBe(false);
  });

  it("rechaza basura y formatos inválidos", () => {
    expect(isValidRut("")).toBe(false);
    expect(isValidRut("hola")).toBe(false);
    expect(isValidRut("123")).toBe(false);
    expect(isValidRut("1.234-5")).toBe(false);
  });

  it("formatea correctamente", () => {
    expect(formatRut("123456785")).toBe("12.345.678-5");
    expect(formatRut("20347878K")).toBe("20.347.878-K");
  });
});
