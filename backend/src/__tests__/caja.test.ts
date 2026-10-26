import { describe, it, expect } from "vitest";
import { diaChile, diferenciaDePago, medioDePago, rangoDiaChile, resumirCaja } from "../services/finanzas/caja";

/**
 * El cierre de caja cuadra lo que entró en un día de Chile, por medio de pago.
 */

describe("el día es el de Chile, no el del servidor", () => {
  it("un pago a las 22:00 de Chile es de ese día aunque en UTC ya sea el siguiente", () => {
    expect(diaChile(new Date("2026-10-27T01:00:00Z"))).toBe("2026-10-26"); // 22:00 en Chile (UTC-3)
    expect(diaChile(new Date("2026-10-26T04:00:00Z"))).toBe("2026-10-26"); // 01:00 en Chile
  });

  it("el rango del día va de medianoche a medianoche de Chile", () => {
    const { desde, hasta } = rangoDiaChile("2026-10-26");
    expect(desde.toISOString()).toBe("2026-10-26T03:00:00.000Z");
    expect(hasta.toISOString()).toBe("2026-10-27T03:00:00.000Z");
  });

  it("en invierno Chile está a UTC-4", () => {
    expect(rangoDiaChile("2026-07-15").desde.toISOString()).toBe("2026-07-15T04:00:00.000Z");
  });
});

describe("lo que entra al cambiar lo pagado", () => {
  it("es la diferencia con lo que ya estaba pagado", () => {
    expect(diferenciaDePago(null, 30000)).toBe(30000);
    expect(diferenciaDePago(30000, 60000)).toBe(30000);
  });
  it("una corrección hacia abajo es negativa, y sin cambio no hay movimiento", () => {
    expect(diferenciaDePago(60000, 50000)).toBe(-10000);
    expect(diferenciaDePago(60000, 60000)).toBe(0);
    expect(diferenciaDePago(60000, undefined)).toBe(0);
  });
});

describe("resumen de la caja", () => {
  it("suma por medio de pago; lo desconocido cuenta como otro", () => {
    const r = resumirCaja([
      { monto: 25000, medio: "cash" }, { monto: 10000, medio: "cash" },
      { monto: 60000, medio: "transfer" }, { monto: -5000, medio: "cash" },
      { monto: 15000, medio: "cheque" },
    ]);
    expect(r.porMedio).toMatchObject({ cash: 30000, transfer: 60000, other: 15000, card: 0 });
    expect(r.total).toBe(105000);
    expect(r.cantidad).toBe(5);
  });
  it("valida el medio", () => {
    expect(medioDePago("card")).toBe("card");
    expect(medioDePago(undefined)).toBe("other");
  });
});
