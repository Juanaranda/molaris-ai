import prisma from "../../config/prisma";
import {
  esperaConfirmacion, confirmarBooking, rechazarBooking, type ResultadoDecision,
} from "./confirmation";
import { avisarPacienteDecision } from "./notifyPatient";

/**
 * Qué hacer cuando alguien cambia el estado de una cita desde el panel (MOL-32).
 *
 * El panel tiene más de una forma de cambiar el estado —el botón "Confirmar" de
 * Citas y el selector de la agenda— y ambas escribían el estado directo. Con una
 * hora que el paciente pidió y espera el visto bueno, eso dejaba al paciente sin
 * saber nada: el aviso solo salía desde el link de confirmación.
 *
 * Ahora, si la cita espera confirmación, pasarla a confirmada es aprobarla y
 * pasarla a cancelada es rechazarla, con el mismo aviso (y las mismas
 * alternativas) que el flujo del link. Cualquier otra cita sigue como antes.
 */
export type CambioDeEstado = "confirmar" | "rechazar" | "directo";

export function decidirCambioDeEstado(
  actual: { status: string; requestedVia?: string | null },
  nuevo: string | undefined,
): CambioDeEstado {
  if (!esperaConfirmacion(actual)) return "directo";
  if (nuevo === "confirmed") return "confirmar";
  if (nuevo === "cancelled") return "rechazar";
  return "directo";
}

/** Texto del 409 cuando la decisión no se pudo aplicar. */
export function mensajeConflicto(motivo: "ya_resuelta" | "ocupado"): string {
  return motivo === "ocupado"
    ? "Esa hora ya fue tomada por otra cita."
    : "Esta solicitud ya fue resuelta.";
}

/** Quién decide, para dejarlo registrado en la cita. */
export async function quienDecide(userId: string): Promise<{ id?: string; nombre: string }> {
  const u = await prisma.partnerUser.findUnique({ where: { id: userId }, select: { id: true, name: true } });
  return u ? { id: u.id, nombre: u.name } : { nombre: "Equipo de la clínica" };
}

/**
 * Aprueba o rechaza una solicitud y le avisa al paciente.
 *
 * El aviso va sin await: si WhatsApp falla, la decisión ya quedó tomada y no
 * tiene por qué deshacerse — avisarPacienteDecision deja el error en el log.
 */
export async function resolverSolicitud({ bookingId, decision, quien, motivo }: {
  bookingId: string;
  decision: "confirmar" | "rechazar";
  quien: { id?: string; nombre: string };
  motivo?: string;
}): Promise<ResultadoDecision> {
  const res = decision === "rechazar"
    ? await rechazarBooking(bookingId, quien, motivo)
    : await confirmarBooking(bookingId, quien);

  if (res.ok) {
    // El rechazo sale con alternativas: avisarPacienteDecision las busca solo.
    avisarPacienteDecision({
      bookingId,
      decision: decision === "rechazar" ? "rechazada" : "confirmada",
      motivo,
    }).catch(() => {});
  }
  return res;
}
