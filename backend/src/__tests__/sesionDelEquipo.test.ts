import { describe, it, expect } from "vitest";
import { esTokenDeSesion, motivoSesionInvalida } from "../routes/auth";

/**
 * Qué cuenta como sesión del equipo, y cuándo deja de valer.
 *
 * Todos los tokens del sistema se firman con la misma clave. Antes bastaba la
 * firma, y un paciente registrado en la página pública podía listar y exportar
 * todos los pacientes de la clínica y modificarla (comprobado el 23/9).
 */

describe("esTokenDeSesion", () => {
  it("acepta la sesión del equipo, con o sin clínica", () => {
    expect(esTokenDeSesion({ userId: "u1", role: "ADMIN", clinicId: "c1" })).toBe(true);
    expect(esTokenDeSesion({ userId: "u1", role: "USER", clinicId: "c1" })).toBe(true);
    expect(esTokenDeSesion({ userId: "sa", role: "SUPERADMIN", clinicId: null })).toBe(true);
  });

  it("rechaza el token del portal de pacientes (el hueco que se encontró)", () => {
    expect(esTokenDeSesion({ patientUserId: "p1", identityId: "i1", clinicId: "c1", type: "patient" })).toBe(false);
  });

  it("rechaza los demás tokens firmados con la misma clave", () => {
    expect(esTokenDeSesion({ userId: "u1", type: "reset", pwf: "x" })).toBe(false);          // reseteo de contraseña
    expect(esTokenDeSesion({ bookingId: "b1", type: "confirm_booking", hs: "x" })).toBe(false); // link de confirmación
    expect(esTokenDeSesion({ clinicId: "c1", kind: "mp_oauth" })).toBe(false);               // state de Mercado Pago
    expect(esTokenDeSesion({ userId: "u1", stage: "2fa" })).toBe(false);                     // paso intermedio del 2FA
  });

  it("una marca de tipo invalida el token aunque traiga userId y rol", () => {
    // Si algún día alguien firma un token con rol y además tipo, no debe
    // colarse como sesión.
    expect(esTokenDeSesion({ userId: "u1", role: "ADMIN", clinicId: "c1", type: "algo" })).toBe(false);
  });

  it("rechaza roles inventados y basura", () => {
    expect(esTokenDeSesion({ userId: "u1", role: "PACIENTE", clinicId: "c1" })).toBe(false);
    expect(esTokenDeSesion({ userId: "", role: "ADMIN", clinicId: "c1" })).toBe(false);
    expect(esTokenDeSesion(null)).toBe(false);
    expect(esTokenDeSesion("texto")).toBe(false);
  });
});

describe("motivoSesionInvalida", () => {
  const TOKEN = { role: "ADMIN", clinicId: "c1" };
  const VIGENTE = { active: true, role: "ADMIN", clinicId: "c1" };

  it("la sesión sigue valiendo si nada cambió", () => {
    expect(motivoSesionInvalida(TOKEN, VIGENTE)).toBeNull();
  });

  it("una persona desactivada queda fuera de inmediato, no a los 7 días", () => {
    expect(motivoSesionInvalida(TOKEN, { ...VIGENTE, active: false })).toBe("desactivado");
  });

  it("si le cambian el rol, el token viejo deja de servir", () => {
    expect(motivoSesionInvalida(TOKEN, { ...VIGENTE, role: "USER" })).toBe("rol_cambio");
  });

  it("si la mueven de clínica, también", () => {
    expect(motivoSesionInvalida(TOKEN, { ...VIGENTE, clinicId: "c2" })).toBe("clinica_cambio");
  });

  it("si la cuenta ya no existe", () => {
    expect(motivoSesionInvalida(TOKEN, null)).toBe("no_existe");
  });

  it("el superadmin sin clínica sigue valiendo", () => {
    expect(motivoSesionInvalida({ role: "SUPERADMIN", clinicId: null }, { active: true, role: "SUPERADMIN", clinicId: null })).toBeNull();
  });
});
