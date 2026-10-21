import { describe, it, expect } from "vitest";
import { digitosLocales, telefonoCompleto, formatearLocal, telefonoCompletoValido } from "@/lib/telefono";

describe("teléfono con +56 fijo", () => {
  it("entiende lo guardado o pegado en cualquier formato", () => {
    expect(digitosLocales("+56 9 1234 5678")).toBe("912345678");
    expect(digitosLocales("56912345678")).toBe("912345678");
    expect(digitosLocales("9 1234 5678")).toBe("912345678");
    expect(digitosLocales("")).toBe("");
  });

  it("no deja escribir más de 9 dígitos", () => {
    expect(digitosLocales("9123456789999")).toBe("912345678");
  });

  it("guarda el número completo, o nada si está vacío", () => {
    expect(telefonoCompleto("9 1234 5678")).toBe("+56912345678");
    expect(telefonoCompleto("")).toBe("");
  });

  it("da formato mientras se escribe", () => {
    expect(formatearLocal("9")).toBe("9");
    expect(formatearLocal("912")).toBe("9 12");
    expect(formatearLocal("912345678")).toBe("9 1234 5678");
    expect(formatearLocal("223456789")).toBe("2 2345 6789");
  });

  it("sabe cuándo está completo", () => {
    expect(telefonoCompletoValido("+56912345678")).toBe(true);
    expect(telefonoCompletoValido("+569123")).toBe(false);
  });
});
