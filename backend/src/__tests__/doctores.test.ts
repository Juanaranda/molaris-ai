import { describe, it, expect } from "vitest";
import { doctoresPublicos, validarRutsDoctores, diasDelDoctor, horarioLegible } from "../lib/doctores";

/**
 * La página de reservas es pública: de un profesional solo puede mostrar su
 * nombre, especialidad y días. Nada de su contacto ni su RUT.
 */
describe("doctores en la página pública", () => {
  const config = [
    { name: "Camila Soto", nombres: "Camila", apellidos: "Soto", specialty: "Ortodoncia", schedule: "Lun/Mié", phone: "+56911111111", email: "camila@clinica.cl", rut: "12.345.678-5" },
  ];

  it("no deja salir el WhatsApp, el correo ni el RUT", () => {
    const [d] = doctoresPublicos(config);
    expect(d).toEqual({ name: "Camila Soto", specialty: "Ortodoncia", schedule: "Lun/Mié" });
    expect(JSON.stringify(doctoresPublicos(config))).not.toMatch(/\+569|@|12\.345/);
  });

  it("tolera configuraciones viejas o rotas", () => {
    expect(doctoresPublicos(undefined)).toEqual([]);
    expect(doctoresPublicos([null, { specialty: "x" }, { name: "Ana" }])).toEqual([{ name: "Ana", specialty: "", schedule: "" }]);
  });
});

/**
 * El onboarding guarda los días como `days: ["monday", …]` y sin `schedule`;
 * los profesionales viejos solo traen el texto. La página pública tiene que
 * entender los dos o los del onboarding quedan sin días ni horas.
 */
describe("días que atiende un profesional", () => {
  it("lee los días del onboarding", () => {
    expect(diasDelDoctor({ days: ["monday", "wednesday", "friday"] })).toEqual([1, 3, 5]);
    expect(diasDelDoctor({ days: ["saturday", "monday", "monday"] })).toEqual([1, 6]);
  });

  it("sigue leyendo el texto viejo", () => {
    expect(diasDelDoctor({ schedule: "Lun-Vie" })).toEqual([1, 2, 3, 4, 5]);
    expect(diasDelDoctor({ schedule: "Mar/Jue/Sáb" })).toEqual([2, 4, 6]);
  });

  it("prefiere `days` y cae al texto si `days` no dice nada", () => {
    expect(diasDelDoctor({ days: ["tuesday"], schedule: "Lun-Vie" })).toEqual([2]);
    expect(diasDelDoctor({ days: [], schedule: "Lun/Mié" })).toEqual([1, 3]);
    expect(diasDelDoctor({ days: ["funday"], schedule: "Vie" })).toEqual([5]);
    expect(diasDelDoctor({})).toEqual([]);
  });

  it("arma el texto con la semana partiendo el lunes", () => {
    expect(horarioLegible([1, 2, 3, 4, 5])).toBe("Lun/Mar/Mié/Jue/Vie");
    expect(horarioLegible([0, 6, 1])).toBe("Lun/Sáb/Dom");
    expect(horarioLegible([])).toBe("");
  });

  it("la página pública muestra los días de un profesional del onboarding", () => {
    const [d] = doctoresPublicos([{ name: "Ana Rojas", specialty: "Endodoncia", days: ["monday", "tuesday", "wednesday", "thursday", "friday"], phone: "+56922222222", rut: "12.345.678-5" }]);
    expect(d).toEqual({ name: "Ana Rojas", specialty: "Endodoncia", schedule: "Lun/Mar/Mié/Jue/Vie" });
  });

  it("si el profesional trae su texto, se respeta", () => {
    const [d] = doctoresPublicos([{ name: "Ana", specialty: "", schedule: "Lun-Vie", days: ["monday"] }]);
    expect(d.schedule).toBe("Lun-Vie");
  });
});

describe("RUT del profesional al guardar", () => {
  it("es opcional", () => {
    const r = validarRutsDoctores([{ name: "Ana", rut: "" }]);
    expect(r).toEqual({ ok: true, doctors: [{ name: "Ana" }] });
  });

  it("se guarda con formato", () => {
    const r = validarRutsDoctores([{ name: "Ana", rut: "123456785" }]);
    expect(r).toEqual({ ok: true, doctors: [{ name: "Ana", rut: "12.345.678-5" }] });
  });

  it("rechaza un dígito verificador malo y dice de quién", () => {
    const r = validarRutsDoctores([{ name: "Ana Rojas", rut: "12.345.678-9" }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Ana Rojas");
  });
});
