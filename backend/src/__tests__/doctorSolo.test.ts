import { describe, it, expect } from "vitest";
import { construirDoctorSolo } from "../routes/clinics";

/**
 * El profesional único del plan Solo (#69).
 *
 * Lo que se cuida acá es el contacto. El onboarding express se salta el paso
 * del equipo, así que este es el único momento en que se llena: si sale sin
 * WhatsApp ni correo, el dentista independiente no recibe el link para
 * confirmar las horas que le pide el agente y cada solicitud caduca sola.
 */
describe("construirDoctorSolo", () => {
  const BASE = { adminName: "Dr. Juan Garcés", adminEmail: "juan@consulta.cl" };

  it("se registra a sí mismo como el único profesional", () => {
    const doc = construirDoctorSolo({ ...BASE, specialty: "Endodoncia" });
    expect(doc.name).toBe("Dr. Juan Garcés");
    expect(doc.specialty).toBe("Endodoncia");
  });

  it("siempre sale con al menos un canal de aviso", () => {
    // Sin esto la confirmación no le llega a nadie y la hora se pierde.
    const doc = construirDoctorSolo(BASE);
    expect(doc.phone ?? doc.email).toBeTruthy();
    expect(doc.email).toBe("juan@consulta.cl");
  });

  it("prefiere el WhatsApp al teléfono: el aviso sale por ahí primero", () => {
    const doc = construirDoctorSolo({ ...BASE, whatsapp: "+56 9 1111 1111", phone: "+56 2 2222 2222" });
    expect(doc.phone).toBe("+56 9 1111 1111");
  });

  it("cae al teléfono cuando no hay WhatsApp", () => {
    expect(construirDoctorSolo({ ...BASE, phone: "+56 2 2222 2222" }).phone).toBe("+56 2 2222 2222");
  });

  it("un teléfono en blanco no cuenta como teléfono", () => {
    const doc = construirDoctorSolo({ ...BASE, whatsapp: "   ", phone: "  " });
    expect(doc.phone).toBeUndefined();
    // Igual queda contactable por correo, que es el punto.
    expect(doc.email).toBe("juan@consulta.cl");
  });

  it("sin especialidad usa odontología general y no queda vacía", () => {
    expect(construirDoctorSolo(BASE).specialty).toBe("Odontología General");
    expect(construirDoctorSolo({ ...BASE, specialty: "   " }).specialty).toBe("Odontología General");
  });

  it("arranca de lunes a viernes, para que el agente tenga qué ofrecer", () => {
    expect(construirDoctorSolo(BASE).days).toEqual(
      ["monday", "tuesday", "wednesday", "thursday", "friday"]
    );
  });
});
