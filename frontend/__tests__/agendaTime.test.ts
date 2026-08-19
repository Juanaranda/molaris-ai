import { describe, it, expect } from "vitest";
import { minutosDesdeInicioDeGrilla, esElTramoDeAhora } from "@/lib/agendaTime";

/**
 * La línea de "ahora" en la agenda. Una línea mal puesta hace que el doctor
 * lea la agenda corrida, así que los bordes se prueban con el reloj fijo:
 * antes de abrir, después de cerrar y en el último tramo.
 */

// Misma grilla que la agenda: 09:00 a 19:00 en tramos de media hora.
const SLOTS = Array.from({ length: 21 }, (_, i) => {
  const m = 9 * 60 + i * 30;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${m % 60 === 0 ? "00" : "30"}`;
});

const alas = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(2026, 7, 19, h, m, 0);
  return d;
};

describe("minutosDesdeInicioDeGrilla", () => {
  it("cuenta desde la apertura", () => {
    expect(minutosDesdeInicioDeGrilla(SLOTS, alas("09:00"))).toBe(0);
    expect(minutosDesdeInicioDeGrilla(SLOTS, alas("10:15"))).toBe(75);
  });

  it("devuelve null antes de abrir y después de cerrar, en vez de una posición inventada", () => {
    expect(minutosDesdeInicioDeGrilla(SLOTS, alas("08:59"))).toBeNull();
    expect(minutosDesdeInicioDeGrilla(SLOTS, alas("23:25"))).toBeNull();
    expect(minutosDesdeInicioDeGrilla(SLOTS, alas("19:30"))).toBeNull();
    expect(minutosDesdeInicioDeGrilla(SLOTS, alas("03:00"))).toBeNull();
  });

  it("el último tramo vale media hora más que su etiqueta", () => {
    // La grilla llega hasta la etiqueta 19:00, que cubre hasta las 19:30.
    expect(SLOTS[SLOTS.length - 1]).toBe("19:00");
    expect(minutosDesdeInicioDeGrilla(SLOTS, alas("19:29"))).toBe(629);
    expect(minutosDesdeInicioDeGrilla(SLOTS, alas("19:30"))).toBeNull();
  });

  it("no explota con la grilla vacía", () => {
    expect(minutosDesdeInicioDeGrilla([], alas("10:00"))).toBeNull();
  });
});

describe("esElTramoDeAhora", () => {
  it("marca solo el tramo de media hora que contiene la hora actual", () => {
    const ahora = alas("10:20");
    expect(esElTramoDeAhora("10:00", SLOTS, ahora)).toBe(true);
    expect(esElTramoDeAhora("10:30", SLOTS, ahora)).toBe(false);
    expect(esElTramoDeAhora("09:30", SLOTS, ahora)).toBe(false);
  });

  it("el borde exacto pertenece al tramo que empieza, no al que termina", () => {
    const ahora = alas("10:30");
    expect(esElTramoDeAhora("10:00", SLOTS, ahora)).toBe(false);
    expect(esElTramoDeAhora("10:30", SLOTS, ahora)).toBe(true);
  });

  it("fuera de horario no marca ningún tramo", () => {
    const ahora = alas("23:25");
    expect(SLOTS.some((s) => esElTramoDeAhora(s, SLOTS, ahora))).toBe(false);
  });

  it("dentro del horario marca exactamente un tramo", () => {
    const ahora = alas("14:05");
    expect(SLOTS.filter((s) => esElTramoDeAhora(s, SLOTS, ahora))).toHaveLength(1);
  });
});
