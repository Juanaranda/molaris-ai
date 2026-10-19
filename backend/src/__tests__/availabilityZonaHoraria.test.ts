import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import {
  getWeekAvailability,
  type ClinicAvailabilityConfig,
} from "../services/availability/availabilityService";

/* Railway corre en UTC. Se fuerza esa TZ porque en la máquina de desarrollo
   (Chile) el corte de "slot ya pasó" daba bien aunque estuviera mal: en UTC
   las horas de hoy se ocultaban 3-4 h antes de tiempo. */
const tzOriginal = process.env.TZ;
beforeAll(() => { process.env.TZ = "UTC"; vi.useFakeTimers(); });
afterAll(() => { vi.useRealTimers(); process.env.TZ = tzOriginal; });
afterEach(() => { vi.setSystemTime(new Date("2026-07-01T12:00:00Z")); });

const cfg: ClinicAvailabilityConfig = {
  boxes: 2,
  slotDurationMin: 30,
  // El sábado abre hasta tarde para probar la medianoche UTC.
  openingHours: { "6": { from: "10:00", to: "23:30" } },
  doctors: [{ name: "Dra. Turno", workDays: [1, 2, 3, 4, 5, 6] }],
};

/** Disponibilidad del día visto desde un momento sin nada pasado. */
function referencia(weekStart: string, fecha: string) {
  vi.setSystemTime(new Date("2026-07-01T12:00:00Z"));
  return getWeekAvailability(weekStart, cfg).find((d) => d.date === fecha)!;
}

describe("getWeekAvailability con el servidor en UTC", () => {
  it("a las 09:00 de Chile las horas de hoy desde las 10:00 siguen ofrecidas", () => {
    const esperado = referencia("2026-08-03", "2026-08-03");
    vi.setSystemTime(new Date("2026-08-03T09:00:00-04:00"));
    const lunes = getWeekAvailability("2026-08-03", cfg).find((d) => d.date === "2026-08-03")!;
    expect(lunes.slots).toEqual(esperado.slots);
    expect(lunes.slots.some((s) => s.time === "10:00")).toBe(true);
  });

  it("a las 12:00 de Chile solo se cierran las horas antes de 12:30", () => {
    const esperado = referencia("2026-08-03", "2026-08-03");
    vi.setSystemTime(new Date("2026-08-03T12:00:00-04:00"));
    const lunes = getWeekAvailability("2026-08-03", cfg).find((d) => d.date === "2026-08-03")!;
    for (const [i, s] of lunes.slots.entries()) {
      if (s.time < "12:30") expect(s.available, s.time).toBe(false);
      else expect(s, s.time).toEqual(esperado.slots[i]);
    }
  });

  it("sábado 21:30 en Chile (domingo en UTC) el sábado sigue abierto con sus horas de la noche", () => {
    const esperado = referencia("2026-08-03", "2026-08-08");
    vi.setSystemTime(new Date("2026-08-08T21:30:00-04:00"));
    const sabado = getWeekAvailability("2026-08-03", cfg).find((d) => d.date === "2026-08-08")!;
    expect(sabado.isOpen).toBe(true);
    const noche = sabado.slots.filter((s) => s.time >= "22:00");
    expect(noche).toEqual(esperado.slots.filter((s) => s.time >= "22:00"));
  });

  it("los días de la semana salen con su nombre correcto", () => {
    vi.setSystemTime(new Date("2026-08-02T23:00:00-04:00"));
    const semana = getWeekAvailability("2026-08-03", cfg);
    expect(semana.map((d) => `${d.date} ${d.dayName}`)).toEqual([
      "2026-08-03 Lunes", "2026-08-04 Martes", "2026-08-05 Miércoles", "2026-08-06 Jueves",
      "2026-08-07 Viernes", "2026-08-08 Sábado", "2026-08-09 Domingo",
    ]);
  });
});
