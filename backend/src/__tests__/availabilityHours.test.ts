import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import {
  getWeekAvailability,
  ventanaAtencion,
  duracionDeServicio,
  type ClinicAvailabilityConfig,
} from "../services/availability/availabilityService";

/* Lunes 3 de agosto de 2026, con el reloj congelado el viernes anterior.
   Antes esta fecha estaba fija sin congelar el reloj: getWeekAvailability
   descarta los slots que ya pasaron, así que el día que llegó el 3 de agosto
   los tests empezaron a recibir [] y CI quedó roja en cada push. Congelando el
   reloj el resultado no depende de cuándo se corran. */
const LUNES = "2026-08-03";
const ANTES_DEL_LUNES = new Date("2026-07-31T09:00:00-04:00");

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(ANTES_DEL_LUNES); });
afterAll(() => { vi.useRealTimers(); });

const base: ClinicAvailabilityConfig = {
  boxes: 2,
  slotDurationMin: 30,
  services: [
    { name: "Limpieza dental", durationMin: 30 },
    { name: "Implante dental", durationMin: 90 },
    { name: "Control", durationMin: 15 },
  ],
  doctors: [
    { name: "Dra. Mañana", schedule: "Lun-Vie", hours: { from: "10:00", to: "13:00" } },
    { name: "Dr. Tarde",   schedule: "Lun-Vie", hours: { from: "15:00", to: "18:00" } },
  ],
};

describe("duracionDeServicio", () => {
  it("usa la duración declarada del servicio", () => {
    expect(duracionDeServicio(base, "Implante dental")).toBe(90);
    expect(duracionDeServicio(base, "Limpieza dental")).toBe(30);
  });

  it("calza aunque el nombre venga parcial, como lo escribe el paciente", () => {
    expect(duracionDeServicio(base, "implante")).toBe(90);
    expect(duracionDeServicio(base, "LIMPIEZA")).toBe(30);
  });

  it("cae al valor de la clínica si el servicio no está en el catálogo", () => {
    expect(duracionDeServicio(base, "Algo que no existe")).toBe(30);
    expect(duracionDeServicio(base, undefined)).toBe(30);
  });

  it("ignora una duración inválida en vez de generar slots de cero minutos", () => {
    const cfg = { ...base, services: [{ name: "Roto", durationMin: 0 }] };
    expect(duracionDeServicio(cfg, "Roto")).toBe(30);
  });
});

describe("ventanaAtencion", () => {
  it("intersecta el horario del doctor con el de la clínica", () => {
    // Clínica 10-18, doctora 10-13 → 10:00 a 13:00
    const v = ventanaAtencion(base, base.doctors![0], 1);
    expect(v).toEqual({ desde: 600, hasta: 780 });
  });

  it("recorta al horario de la clínica si el doctor se pasa", () => {
    const cfg: ClinicAvailabilityConfig = {
      ...base,
      openingHours: { "1": { from: "10:00", to: "14:00" } },
    };
    // Doctor declara hasta 18:00 pero la clínica cierra 14:00
    const v = ventanaAtencion(cfg, { name: "X", hours: { from: "09:00", to: "18:00" } }, 1);
    expect(v).toEqual({ desde: 600, hasta: 840 });
  });

  it("hereda el horario de la clínica si el doctor no declara el suyo", () => {
    const v = ventanaAtencion(base, { name: "Sin horario" }, 1);
    expect(v).toEqual({ desde: 600, hasta: 1080 });   // 10:00–18:00
  });

  it("devuelve null cuando la clínica cierra ese día", () => {
    expect(ventanaAtencion(base, base.doctors![0], 0)).toBeNull();   // domingo
  });

  it("devuelve null si el horario del doctor no solapa con el de la clínica", () => {
    const cfg: ClinicAvailabilityConfig = {
      ...base,
      openingHours: { "1": { from: "10:00", to: "14:00" } },
    };
    const v = ventanaAtencion(cfg, { name: "Nocturno", hours: { from: "19:00", to: "22:00" } }, 1);
    expect(v).toBeNull();
  });
});

describe("getWeekAvailability con horarios por doctor", () => {
  const lunes = () => getWeekAvailability(LUNES, base, "Limpieza dental").find((d) => d.date === LUNES)!;

  it("no ofrece horas fuera de la ventana de ningún profesional", () => {
    const horas = lunes().slots.map((s) => s.time);
    // Nadie atiende entre 13:00 y 15:00
    expect(horas).not.toContain("13:00");
    expect(horas).not.toContain("14:00");
    expect(horas).not.toContain("14:30");
  });

  it("cada hora se asigna solo a un profesional que realmente atiende a esa hora", () => {
    for (const slot of lunes().slots) {
      const h = Number(slot.time.slice(0, 2));
      if (h < 13) expect(slot.doctor).toBe("Dra. Mañana");
      else        expect(slot.doctor).toBe("Dr. Tarde");
    }
  });

  it("la última hora nunca termina después del cierre del profesional", () => {
    // Implante = 90 min. La doctora sale 13:00, así que su última hora es 11:30.
    const dia = getWeekAvailability(LUNES, base, "Implante dental").find((d) => d.date === LUNES)!;
    const mañana = dia.slots.filter((s) => s.doctor === "Dra. Mañana").map((s) => s.time);
    expect(mañana).toEqual(["10:00", "11:30"]);
  });

  it("un servicio más largo entrega menos horas que uno corto", () => {
    const corto = getWeekAvailability(LUNES, base, "Control").find((d) => d.date === LUNES)!;
    const largo = getWeekAvailability(LUNES, base, "Implante dental").find((d) => d.date === LUNES)!;
    expect(corto.slots.length).toBeGreaterThan(largo.slots.length);
  });

  it("respeta el horario propio de la clínica por sobre el por defecto", () => {
    const cfg: ClinicAvailabilityConfig = {
      ...base,
      openingHours: { "1": { from: "08:00", to: "09:00" } },
      doctors: [{ name: "Temprano", schedule: "Lun-Vie" }],
    };
    const dia = getWeekAvailability(LUNES, cfg, "Control").find((d) => d.date === LUNES)!;
    expect(dia.slots.map((s) => s.time)).toEqual(["08:00", "08:15", "08:30", "08:45"]);
  });

  it("marca el día cerrado si la clínica declara ese día en null", () => {
    const cfg: ClinicAvailabilityConfig = { ...base, openingHours: { "1": null } };
    const dia = getWeekAvailability(LUNES, cfg, "Control").find((d) => d.date === LUNES)!;
    expect(dia.isOpen).toBe(false);
    expect(dia.slots).toHaveLength(0);
  });
});
