import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockConfirmar, mockRechazar, mockAvisar, mockListaEspera } = vi.hoisted(() => ({
  mockConfirmar: vi.fn(),
  mockRechazar: vi.fn(),
  mockAvisar: vi.fn(),
  mockListaEspera: vi.fn(),
}));
vi.mock("../services/booking/confirmation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/booking/confirmation")>()),
  confirmarBooking: mockConfirmar,
  rechazarBooking: mockRechazar,
}));
vi.mock("../services/booking/notifyPatient", () => ({ avisarPacienteDecision: mockAvisar }));
vi.mock("../services/waitlist/waitlistService", () => ({
  notifyWaitlistForCanceledBooking: mockListaEspera,
}));

import { esperaConfirmacion } from "../services/booking/confirmation";
import {
  decidirCambioDeEstado, resolverSolicitud, mensajeConflicto,
  liberaCupo, avisarListaDeEsperaSiSeLibera,
} from "../services/booking/decisionDesdePanel";

/**
 * Cambiar el estado de una hora pedida por el paciente desde el panel (MOL-32).
 *
 * El botón "Confirmar" de Citas y el selector de la agenda escribían el estado
 * directo, y el paciente nunca se enteraba de la decisión. Ahora esas horas
 * pasan por el mismo flujo que el link de confirmación.
 */
describe("esperaConfirmacion", () => {
  it("solo las pendientes que pidió el paciente esperan confirmación", () => {
    expect(esperaConfirmacion({ status: "pending", requestedVia: "agent" })).toBe(true);
    expect(esperaConfirmacion({ status: "pending", requestedVia: "web" })).toBe(true);
  });

  it("las creadas a mano por la clínica no esperan a nadie", () => {
    expect(esperaConfirmacion({ status: "pending", requestedVia: null })).toBe(false);
    expect(esperaConfirmacion({ status: "pending" })).toBe(false);
  });

  it("una vía desconocida no cuenta, igual que en el filtro del scheduler", () => {
    expect(esperaConfirmacion({ status: "pending", requestedVia: "otra" })).toBe(false);
  });

  it("una hora ya resuelta no espera confirmación", () => {
    expect(esperaConfirmacion({ status: "confirmed", requestedVia: "agent" })).toBe(false);
    expect(esperaConfirmacion({ status: "cancelled", requestedVia: "web" })).toBe(false);
  });
});

describe("decidirCambioDeEstado", () => {
  const solicitud = { status: "pending", requestedVia: "agent" };

  it("confirmar una solicitud es aprobarla", () => {
    expect(decidirCambioDeEstado(solicitud, "confirmed")).toBe("confirmar");
  });

  it("cancelar una solicitud es rechazarla", () => {
    expect(decidirCambioDeEstado(solicitud, "cancelled")).toBe("rechazar");
  });

  it("dejarla pendiente o no tocar el estado no decide nada", () => {
    expect(decidirCambioDeEstado(solicitud, "pending")).toBe("directo");
    expect(decidirCambioDeEstado(solicitud, undefined)).toBe("directo");
  });

  it("una cita que no espera confirmación sigue cambiando directo", () => {
    const aMano = { status: "pending", requestedVia: null };
    expect(decidirCambioDeEstado(aMano, "confirmed")).toBe("directo");
    expect(decidirCambioDeEstado(aMano, "cancelled")).toBe("directo");
    const yaConfirmada = { status: "confirmed", requestedVia: "agent" };
    expect(decidirCambioDeEstado(yaConfirmada, "cancelled")).toBe("directo");
  });
});

describe("resolverSolicitud", () => {
  const quien = { id: "u1", nombre: "Recepción" };

  beforeEach(() => {
    mockConfirmar.mockReset();
    mockRechazar.mockReset();
    mockAvisar.mockReset().mockResolvedValue({ enviado: true });
  });

  it("al confirmar, le avisa al paciente que quedó confirmada", async () => {
    mockConfirmar.mockResolvedValue({ ok: true, estado: "confirmed" });
    const res = await resolverSolicitud({ bookingId: "b1", decision: "confirmar", quien });
    expect(res).toEqual({ ok: true, estado: "confirmed" });
    expect(mockConfirmar).toHaveBeenCalledWith("b1", quien);
    expect(mockAvisar).toHaveBeenCalledWith({ bookingId: "b1", decision: "confirmada", motivo: undefined });
  });

  it("al rechazar, avisa como rechazo (que es el que lleva alternativas)", async () => {
    mockRechazar.mockResolvedValue({ ok: true, estado: "cancelled" });
    await resolverSolicitud({ bookingId: "b1", decision: "rechazar", quien, motivo: "Congreso" });
    expect(mockRechazar).toHaveBeenCalledWith("b1", quien, "Congreso");
    expect(mockAvisar).toHaveBeenCalledWith({ bookingId: "b1", decision: "rechazada", motivo: "Congreso" });
  });

  it("si la decisión no se aplicó, no le avisa nada al paciente", async () => {
    mockConfirmar.mockResolvedValue({ ok: false, motivo: "ocupado" });
    const res = await resolverSolicitud({ bookingId: "b1", decision: "confirmar", quien });
    expect(res).toEqual({ ok: false, motivo: "ocupado" });
    expect(mockAvisar).not.toHaveBeenCalled();
  });

  it("si el aviso falla, la decisión igual queda tomada", async () => {
    mockRechazar.mockResolvedValue({ ok: true, estado: "cancelled" });
    mockAvisar.mockRejectedValue(new Error("WhatsApp caído"));
    await expect(resolverSolicitud({ bookingId: "b1", decision: "rechazar", quien }))
      .resolves.toEqual({ ok: true, estado: "cancelled" });
  });
});

describe("mensajeConflicto", () => {
  it("distingue una hora tomada de una solicitud ya resuelta", () => {
    expect(mensajeConflicto("ocupado")).toMatch(/tomada/);
    expect(mensajeConflicto("ya_resuelta")).toMatch(/ya fue resuelta/);
  });
});

/**
 * Cancelar desde la agenda no le avisaba a la lista de espera; desde Citas sí
 * (MOL-36). Las tres rutas del panel usan ahora el mismo criterio.
 */
describe("liberaCupo", () => {
  it("una cita viva que pasa a cancelada libera el cupo", () => {
    expect(liberaCupo("confirmed", "cancelled")).toBe(true);
    expect(liberaCupo("pending", "cancelled")).toBe(true);
  });

  it("cancelar una cita ya cancelada no libera nada nuevo", () => {
    expect(liberaCupo("cancelled", "cancelled")).toBe(false);
  });

  it("cualquier otro cambio, o no tocar el estado, no libera el cupo", () => {
    expect(liberaCupo("pending", "confirmed")).toBe(false);
    expect(liberaCupo("confirmed", "pending")).toBe(false);
    expect(liberaCupo("confirmed", undefined)).toBe(false);
    expect(liberaCupo("cancelled", "pending")).toBe(false);
  });
});

describe("avisarListaDeEsperaSiSeLibera", () => {
  beforeEach(() => {
    mockListaEspera.mockReset().mockResolvedValue({ notified: true });
  });

  it("al liberarse el cupo, avisa a la lista de espera por esa cita", () => {
    expect(avisarListaDeEsperaSiSeLibera("b1", "confirmed", "cancelled")).toBe(true);
    expect(mockListaEspera).toHaveBeenCalledWith("b1");
  });

  it("si la cita ya estaba cancelada, no vuelve a avisar", () => {
    expect(avisarListaDeEsperaSiSeLibera("b1", "cancelled", "cancelled")).toBe(false);
    expect(mockListaEspera).not.toHaveBeenCalled();
  });

  it("si no se canceló, no avisa", () => {
    expect(avisarListaDeEsperaSiSeLibera("b1", "pending", "confirmed")).toBe(false);
    expect(avisarListaDeEsperaSiSeLibera("b1", "confirmed", undefined)).toBe(false);
    expect(mockListaEspera).not.toHaveBeenCalled();
  });

  it("si el aviso falla, no revienta: la cancelación ya quedó hecha", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mockListaEspera.mockRejectedValue(new Error("WhatsApp caído"));
    expect(() => avisarListaDeEsperaSiSeLibera("b1", "confirmed", "cancelled")).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
