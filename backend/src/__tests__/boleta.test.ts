import { describe, it, expect, vi } from "vitest";

vi.mock("../config/prisma", () => ({ default: {} }));

import { armarBoleta, medioPagoSii, montosBoleta, type Emisor } from "../services/sii/openFacturaService";
import { nombreDelItem } from "../services/sii/boletas";
import { pagosSinBoleta } from "../services/finanzas/caja";

/**
 * La boleta electrónica (MOL-63). El formato se probó contra el ambiente de
 * pruebas de OpenFactura; estos tests fijan lo que el SII revisa: montos,
 * campos del emisor y receptor de una boleta (distintos a los de factura).
 */
const emisor: Emisor = {
  rut: "76795561-8", razonSocial: "Clínica Dental Aurora SpA", giro: "Servicios odontológicos",
  direccion: "Av. Siempre Viva 123", comuna: "Providencia", sucursal: "81303347",
};

describe("montosBoleta", () => {
  it("en la boleta afecta el total trae el IVA incluido", () => {
    expect(montosBoleta(3000, false)).toEqual({ neto: 2521, iva: 479, total: 3000 });
    expect(montosBoleta(30000, false)).toEqual({ neto: 25210, iva: 4790, total: 30000 });
  });
  it("neto más IVA siempre suma lo que pagó el paciente", () => {
    for (const total of [1, 99, 1000, 12345, 87990, 1_500_000]) {
      const m = montosBoleta(total, false);
      expect(m.neto + m.iva).toBe(total);
    }
  });
  it("en la exenta no hay IVA", () => {
    expect(montosBoleta(45000, true)).toEqual({ neto: 45000, iva: 0, total: 45000 });
  });
});

describe("medioPagoSii", () => {
  it("traduce el medio de la caja al código del SII", () => {
    expect(medioPagoSii("cash")).toBe(1);
    expect(medioPagoSii("card")).toBe(2);
    expect(medioPagoSii("mercadopago")).toBe(2);
    expect(medioPagoSii("transfer")).toBe(3);
    expect(medioPagoSii("other")).toBe(5);
  });
});

describe("armarBoleta", () => {
  const base = { emisor, fecha: "2026-10-28", medio: "cash", receptor: null, items: [{ nombre: "Limpieza dental", monto: 30000 }] };

  it("exenta: tipo 41, líneas exentas y totales sin IVA", () => {
    const dte = armarBoleta({ ...base, exenta: true }) as any;
    expect(dte.Encabezado.IdDoc).toEqual({ TipoDTE: 41, Folio: 0, FchEmis: "2026-10-28", IndServicio: 3, MedioPago: 1 });
    expect(dte.Encabezado.Totales).toEqual({ MntExe: 30000, MntTotal: 30000, TotalPeriodo: 30000, VlrPagar: 30000 });
    expect(dte.Detalle[0]).toMatchObject({ IndExe: 1, PrcItem: 30000, MontoItem: 30000 });
  });

  it("afecta: tipo 39, detalle con IVA incluido y totales sin TasaIVA", () => {
    const dte = armarBoleta({ ...base, exenta: false }) as any;
    expect(dte.Encabezado.IdDoc.TipoDTE).toBe(39);
    expect(dte.Encabezado.Totales).toEqual({ MntNeto: 25210, IVA: 4790, MntTotal: 30000, TotalPeriodo: 30000, VlrPagar: 30000 });
    expect(dte.Encabezado.Totales).not.toHaveProperty("TasaIVA");
    expect(dte.Detalle[0].MontoItem).toBe(30000);
    expect(dte.Detalle[0]).not.toHaveProperty("IndExe");
  });

  it("el emisor usa los campos de boleta, no los de factura", () => {
    const e = (armarBoleta({ ...base, exenta: true }) as any).Encabezado.Emisor;
    expect(e).toEqual({
      RUTEmisor: "76795561-8", RznSocEmisor: "Clínica Dental Aurora SpA", GiroEmisor: "Servicios odontológicos",
      DirOrigen: "Av. Siempre Viva 123", CmnaOrigen: "Providencia", CdgSIISucur: "81303347",
    });
    expect(e).not.toHaveProperty("RznSoc");
    expect(e).not.toHaveProperty("Acteco");
  });

  it("sin RUT del paciente va a consumidor final; con RUT, a su nombre", () => {
    expect((armarBoleta({ ...base, exenta: true }) as any).Encabezado.Receptor).toEqual({ RUTRecep: "66666666-6" });
    const conRut = armarBoleta({ ...base, exenta: true, receptor: { rut: "11111111-1", nombre: "Ana Pérez" } }) as any;
    expect(conRut.Encabezado.Receptor).toEqual({ RUTRecep: "11111111-1", RznSocRecep: "Ana Pérez" });
  });

  it("limpia el nombre del ítem: el SII borra los guiones largos y corta en 80", () => {
    const dte = armarBoleta({ ...base, exenta: true, items: [{ nombre: "Endodoncia — molar", monto: 1000 }] }) as any;
    expect(dte.Detalle[0].NmbItem).toBe("Endodoncia - molar");
    const largo = armarBoleta({ ...base, exenta: true, items: [{ nombre: "x".repeat(120), monto: 1000 }] }) as any;
    expect(largo.Detalle[0].NmbItem).toHaveLength(80);
  });
});

describe("nombreDelItem", () => {
  it("usa la prestación de la cita, o lo que es el pago", () => {
    expect(nombreDelItem("cita", "Limpieza dental")).toBe("Limpieza dental");
    expect(nombreDelItem("cita", null)).toBe("Atención dental");
    expect(nombreDelItem("plan", "Ortodoncia")).toBe("Abono a tratamiento dental");
    expect(nombreDelItem("abono", null)).toBe("Abono a cuenta");
  });
});

describe("pagosSinBoleta", () => {
  it("cuenta los pagos sin boleta emitida; las correcciones no llevan", () => {
    expect(pagosSinBoleta([
      { monto: 30000, boleta: null },
      { monto: 20000, boleta: { status: "issued" } },
      { monto: 10000, boleta: { status: "error" } },
      { monto: 5000, boleta: { status: "accepted" } },
      { monto: -5000, boleta: null },
    ])).toBe(2);
  });
});
