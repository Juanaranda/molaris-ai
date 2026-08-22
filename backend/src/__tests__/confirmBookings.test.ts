import { describe, it, expect } from "vitest";
import { canPerform } from "../services/auth/clinicalPermissions";

/**
 * Quién puede confirmar una hora que pidió un paciente por el agente.
 *
 * Importa acotarlo con tests porque la regla no es "ser doctor": si dependiera
 * solo del profesional de esa hora, una solicitud del sábado en la tarde
 * esperaría hasta el lunes.
 */
describe("permiso confirm_bookings", () => {
  it("recepción puede confirmar, aunque no vea fichas clínicas", () => {
    expect(canPerform("USER", "RECEPTION", "confirm_bookings")).toBe(true);
    // Sigue sin poder entrar a la ficha: son permisos distintos.
    expect(canPerform("USER", "RECEPTION", "read_clinical")).toBe(false);
  });

  it("los profesionales clínicos y el admin de clínica pueden", () => {
    for (const rol of ["GENERAL_DENTIST", "SPECIALIST", "CLINIC_ADMIN"] as const) {
      expect(canPerform("USER", rol, "confirm_bookings")).toBe(true);
    }
  });

  it("la higienista no confirma horas de otros", () => {
    expect(canPerform("USER", "HYGIENIST", "confirm_bookings")).toBe(false);
  });

  it("sin rol clínico asignado se mantiene la compatibilidad hacia atrás", () => {
    expect(canPerform("USER", null, "confirm_bookings")).toBe(true);
    expect(canPerform("ADMIN", null, "confirm_bookings")).toBe(true);
  });

  it("el superadmin puede siempre", () => {
    expect(canPerform("SUPERADMIN", "HYGIENIST", "confirm_bookings")).toBe(true);
  });
});
