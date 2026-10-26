import { describe, it, expect } from "vitest";
import { calcularProduccion, fueAtendida, type CitaFinanzas } from "../services/finanzas/produccion";

/**
 * Producción por profesional (MOL-58): la base para pagarle a cada uno.
 * Lo que más importa: no contar la misma plata dos veces y no perder lo que
 * atendió alguien que ya no está en el equipo.
 */

const AHORA = new Date("2026-10-26T20:00:00Z");
const EQUIPO = [{ id: "rojas", name: "Nicolás Rojas" }, { id: "poblete", name: "Ivonne Poblete" }];
let n = 0;
const cita = (o: Partial<CitaFinanzas>): CitaFinanzas => ({
  id: `c${++n}`, doctor: "Nicolás Rojas", doctorId: "rojas", date: new Date("2026-10-10T12:00:00Z"),
  status: "confirmed", amountTotal: null, amountPaid: null, ...o,
});

describe("qué cuenta como atendida", () => {
  it("solo lo que ya pasó, no canceladas ni solicitudes sin confirmar", () => {
    expect(fueAtendida({ status: "confirmed", date: new Date("2026-10-10") }, AHORA)).toBe(true);
    expect(fueAtendida({ status: "cancelled", date: new Date("2026-10-10") }, AHORA)).toBe(false);
    expect(fueAtendida({ status: "pending", date: new Date("2026-10-10") }, AHORA)).toBe(false);
    expect(fueAtendida({ status: "confirmed", date: new Date("2026-11-10") }, AHORA)).toBe(false);
  });
});

describe("producción por profesional", () => {
  it("suma lo cobrado, lo pagado y lo que falta por profesional y en total", () => {
    const r = calcularProduccion([
      cita({ amountTotal: 60000, amountPaid: 30000 }),
      cita({ amountTotal: 25000, amountPaid: 25000 }),
      cita({ doctor: "Ivonne Poblete", doctorId: "poblete", amountTotal: 40000, amountPaid: 0 }),
    ], [], EQUIPO, AHORA);
    expect(r.profesionales.find((p) => p.id === "rojas")).toMatchObject({ atendidas: 2, cobrado: 85000, pagado: 55000, porCobrar: 30000 });
    expect(r.profesionales.find((p) => p.id === "poblete")).toMatchObject({ atendidas: 1, cobrado: 40000, pagado: 0, porCobrar: 40000 });
    expect(r.clinica).toMatchObject({ atendidas: 3, cobrado: 125000, pagado: 55000, porCobrar: 70000 });
  });

  it("cuenta las atenciones sin monto en vez de mostrarlas como cero", () => {
    const r = calcularProduccion([cita({}), cita({ amountTotal: 10000, amountPaid: 10000 })], [], EQUIPO, AHORA);
    expect(r.clinica).toMatchObject({ atendidas: 2, sinMonto: 1, cobrado: 10000 });
  });

  it("un abono ligado a una cita es del profesional de esa cita; uno suelto, solo de la clínica", () => {
    const c = cita({ id: "con-abono", amountTotal: 50000, amountPaid: 0 });
    const r = calcularProduccion([c], [{ amount: 20000, bookingId: "con-abono" }, { amount: 5000, bookingId: null }], EQUIPO, AHORA);
    expect(r.profesionales[0]).toMatchObject({ pagado: 20000, porCobrar: 30000 });
    expect(r.clinica).toMatchObject({ pagado: 25000, otrosAbonos: 5000, porCobrar: 30000 });
  });

  it("quien ya no está en el equipo conserva lo que atendió, marcado como inactivo", () => {
    const r = calcularProduccion([cita({ doctor: "Ana Aranda", doctorId: null, amountTotal: 30000, amountPaid: 30000 })], [], EQUIPO, AHORA);
    expect(r.profesionales[0]).toMatchObject({ id: null, nombre: "Ana Aranda", activo: false, cobrado: 30000 });
  });

  it("las citas sin profesional van juntas y al final", () => {
    const r = calcularProduccion([
      cita({ doctor: "Sin asignar", doctorId: null }),
      cita({ doctor: "Sin asignar", doctorId: null }),
      cita({}),
    ], [], EQUIPO, AHORA);
    expect(r.profesionales.map((p) => [p.nombre, p.atendidas])).toEqual([["Nicolás Rojas", 1], ["Sin profesional asignado", 2]]);
  });

  it("agrupa por id: un nombre escrito distinto sigue siendo la misma persona", () => {
    const r = calcularProduccion([cita({ doctor: "Dr. Nicolás Rojas" }), cita({ doctor: "nicolas rojas" })], [], EQUIPO, AHORA);
    expect(r.profesionales).toHaveLength(1);
    expect(r.profesionales[0]).toMatchObject({ nombre: "Nicolás Rojas", atendidas: 2 });
  });
});
