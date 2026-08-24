import crypto from "crypto";
import jwt from "jsonwebtoken";
import prisma from "../../config/prisma";
import { config } from "../../config/env";

/**
 * Confirmación humana de las horas que pide el agente.
 *
 * El agente ya no confirma citas por su cuenta: reserva el cupo en "pending" y
 * espera a que una persona apruebe. Sin esto, el agente le puede llenar la
 * agenda a un profesional sin que se entere, que en una clínica chica es un
 * problema real.
 *
 * El link va a WhatsApp o correo y funciona SIN iniciar sesión: nadie va a
 * entrar a la app un sábado en la tarde. Lo que lo hace seguro es que el token
 * está firmado, expira, y lleva la huella del estado de la cita — así deja de
 * servir apenas alguien decide, y un link reenviado no vuelve a confirmar.
 */

/** Horas dentro de las que hay que decidir, cuando la cita es lejana. */
export const PLAZO_BASE_HORAS = 24;
/** Recordatorios al profesional, en horas desde que se pidió. */
export const RECORDATORIOS_HORAS = [2, 6];

/**
 * Hasta cuándo se puede confirmar.
 *
 * No es simplemente "24 horas": si el paciente pide hora para mañana a las 9,
 * un plazo de 24h vencería después de la propia cita. Cuando la hora está más
 * cerca que el plazo, se usa la mitad del tiempo que falta — así siempre queda
 * margen para avisarle al paciente que no se pudo.
 */
export function calcularPlazo(fechaCita: Date, ahora = new Date()): Date {
  const base = new Date(ahora.getTime() + PLAZO_BASE_HORAS * 3_600_000);
  if (base < fechaCita) return base;

  const faltan = fechaCita.getTime() - ahora.getTime();
  // Cita ya pasada o inminente: se decide de inmediato o no se decide.
  if (faltan <= 0) return new Date(ahora.getTime() + 60_000);
  return new Date(ahora.getTime() + faltan / 2);
}

/**
 * Huella del estado actual. Va dentro del token: si la cita ya se confirmó,
 * rechazó o canceló, la huella cambia y el link viejo deja de validar.
 */
function huellaEstado(status: string, confirmedAt: Date | null, rejectedAt: Date | null): string {
  const material = `${status}|${confirmedAt?.toISOString() ?? ""}|${rejectedAt?.toISOString() ?? ""}`;
  return crypto.createHmac("sha256", config.jwtSecret).update(material).digest("hex").slice(0, 16);
}

export function emitirTokenConfirmacion(booking: {
  id: string; status: string; confirmedAt: Date | null; rejectedAt: Date | null;
  confirmDeadline: Date | null;
}): string {
  // El token no sobrevive al plazo: un link que sigue sirviendo tres semanas
  // después es un link que confirma una hora que ya nadie recuerda.
  const expiraEn = booking.confirmDeadline
    ? Math.max(60, Math.floor((booking.confirmDeadline.getTime() - Date.now()) / 1000))
    : 24 * 3600;

  return jwt.sign(
    { bookingId: booking.id, type: "confirm_booking",
      hs: huellaEstado(booking.status, booking.confirmedAt, booking.rejectedAt) },
    config.jwtSecret,
    { expiresIn: expiraEn },
  );
}

export type ResultadoToken =
  | { ok: true; booking: NonNullable<Awaited<ReturnType<typeof buscarBooking>>> }
  | { ok: false; motivo: "invalido" | "expirado" | "ya_resuelta" | "no_existe" };

function buscarBooking(id: string) {
  return prisma.booking.findUnique({
    where: { id },
    include: { clinic: { select: { id: true, name: true, slug: true, config: true, whatsapp: true } } },
  });
}

export async function validarTokenConfirmacion(token: string): Promise<ResultadoToken> {
  let payload: { bookingId: string; type: string; hs: string };
  try {
    payload = jwt.verify(token, config.jwtSecret) as typeof payload;
    if (payload.type !== "confirm_booking") throw new Error("tipo inválido");
  } catch (e) {
    const expirado = e instanceof Error && e.name === "TokenExpiredError";
    return { ok: false, motivo: expirado ? "expirado" : "invalido" };
  }

  const booking = await buscarBooking(payload.bookingId);
  if (!booking) return { ok: false, motivo: "no_existe" };

  // Un solo uso: si ya se decidió, la huella cambió y este link no sirve más.
  if (payload.hs !== huellaEstado(booking.status, booking.confirmedAt, booking.rejectedAt)) {
    return { ok: false, motivo: "ya_resuelta" };
  }
  return { ok: true, booking };
}

export type ResultadoDecision =
  | { ok: true; estado: "confirmed" | "cancelled" }
  | { ok: false; motivo: "ya_resuelta" | "ocupado" };

/**
 * Aprueba la hora. Vuelve a comprobar el cupo dentro de la transacción: entre
 * que el agente reservó y el profesional abrió el link pueden haber pasado
 * horas, y alguien pudo agendar a mano encima.
 */
export async function confirmarBooking(
  bookingId: string,
  quien: { id?: string; nombre: string },
): Promise<ResultadoDecision> {
  return prisma.$transaction(async (tx) => {
    const b = await tx.booking.findUnique({ where: { id: bookingId } });
    if (!b || b.status !== "pending") return { ok: false, motivo: "ya_resuelta" as const };

    const inicioDia = new Date(b.date); inicioDia.setHours(0, 0, 0, 0);
    const finDia = new Date(b.date); finDia.setHours(23, 59, 59, 999);

    const choque = await tx.booking.findFirst({
      where: {
        clinicId: b.clinicId, doctor: b.doctor, time: b.time,
        date: { gte: inicioDia, lte: finDia },
        status: "confirmed", id: { not: b.id },
      },
    });
    if (choque) return { ok: false, motivo: "ocupado" as const };

    await tx.booking.update({
      where: { id: b.id },
      data: {
        status: "confirmed", confirmedAt: new Date(),
        confirmedById: quien.id ?? null, confirmedByName: quien.nombre,
      },
    });
    return { ok: true, estado: "confirmed" as const };
  });
}

export async function rechazarBooking(
  bookingId: string,
  quien: { id?: string; nombre: string },
  motivo?: string,
): Promise<ResultadoDecision> {
  const actualizadas = await prisma.booking.updateMany({
    // Se re-afirma "pending" en el where: si alguien confirmó entre medio, este
    // rechazo no debe pisar la decisión que ya se tomó.
    where: { id: bookingId, status: "pending" },
    data: {
      status: "cancelled", rejectedAt: new Date(),
      rejectionReason: motivo?.trim() || null,
      confirmedByName: quien.nombre,
      confirmedById: quien.id ?? null,
    },
  });
  if (actualizadas.count === 0) return { ok: false, motivo: "ya_resuelta" };
  return { ok: true, estado: "cancelled" };
}
