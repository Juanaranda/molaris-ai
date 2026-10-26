import { describe, it, expect } from "vitest";
import { coberturaDeMontos, moverDia, moverMes, nombreDelMes, rangoDelMes, textoDiferencia } from "@/lib/finanzas";

describe("el mes de la pestaña Finanzas", () => {
  it("va del primer al último día, con los bisiestos", () => {
    expect(rangoDelMes(2026, 9)).toEqual({ desde: "2026-10-01", hasta: "2026-10-31" });
    expect(rangoDelMes(2028, 1)).toEqual({ desde: "2028-02-01", hasta: "2028-02-29" });
  });

  it("cruza el año hacia atrás y hacia adelante", () => {
    expect(moverMes(2026, 0, -1)).toEqual({ anio: 2025, mes: 11 });
    expect(moverMes(2026, 11, 1)).toEqual({ anio: 2027, mes: 0 });
  });

  it("se nombra en español", () => {
    expect(nombreDelMes(2026, 9)).toBe("Octubre 2026");
  });
});

describe("qué tan completos están los montos", () => {
  it("dice qué parte de lo atendido tiene monto registrado", () => {
    expect(coberturaDeMontos({ atendidas: 136, sinMonto: 134 })).toBe(1);
    expect(coberturaDeMontos({ atendidas: 10, sinMonto: 0 })).toBe(100);
    expect(coberturaDeMontos({ atendidas: 0, sinMonto: 0 })).toBe(100);
  });
});

describe("la caja del día", () => {
  it("se mueve de día en día cruzando el mes", () => {
    expect(moverDia("2026-10-31", 1)).toBe("2026-11-01");
    expect(moverDia("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("la diferencia del cierre se dice en palabras", () => {
    const fmt = (n: number) => `$${n}`;
    expect(textoDiferencia(-2000, fmt)).toBe("Faltan $2000");
    expect(textoDiferencia(500, fmt)).toBe("Sobran $500");
    expect(textoDiferencia(0, fmt)).toBe("Cuadra");
  });
});
