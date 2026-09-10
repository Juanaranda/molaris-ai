import { describe, it, expect } from "vitest";
import { esperaConfirmacion } from "@/lib/solicitudes";

/**
 * Qué hora muestra el panel como "por confirmar".
 *
 * El panel lo pregunta en seis lugares —la píldora de estado, el bloque de
 * arriba de la agenda, el modal de la cita, la lista del día—. Estaban
 * comparados a mano contra "agent", así que al sumar la página pública esas
 * horas habrían quedado sin marca en unas vistas y con marca en otras.
 */

describe("esperaConfirmacion", () => {
  it("la del asistente espera confirmación", () => {
    expect(esperaConfirmacion({ status: "pending", requestedVia: "agent" })).toBe(true);
  });

  it("la de la página pública también: el doctor confirma siempre", () => {
    expect(esperaConfirmacion({ status: "pending", requestedVia: "web" })).toBe(true);
  });

  it("la que creó la clínica a mano no espera nada", () => {
    // Sin marca de canal la hizo un humano del equipo: ya está decidida.
    expect(esperaConfirmacion({ status: "pending", requestedVia: null })).toBe(false);
    expect(esperaConfirmacion({ status: "pending" })).toBe(false);
  });

  it("una vez resuelta deja de esperar, venga de donde venga", () => {
    for (const via of ["agent", "web"]) {
      expect(esperaConfirmacion({ status: "confirmed", requestedVia: via })).toBe(false);
      expect(esperaConfirmacion({ status: "cancelled", requestedVia: via })).toBe(false);
    }
  });

  it("un canal nuevo queda cubierto sin tocar las pantallas", () => {
    // La condición es "la pidió el paciente", no una lista de canales: agregar
    // uno en el backend no obliga a recorrer las seis vistas del panel.
    expect(esperaConfirmacion({ status: "pending", requestedVia: "instagram" })).toBe(true);
  });
});
