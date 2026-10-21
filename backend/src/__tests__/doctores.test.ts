import { describe, it, expect } from "vitest";
import { doctoresPublicos, validarRutsDoctores } from "../lib/doctores";

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
