import prisma from "../../config/prisma";
import { registerScheduler, markSchedulerRun } from "../notifications/schedulerHealth";
import { avisarProfesional } from "./notifyProfessional";
import { sendWhatsAppMessage } from "../notifications/whatsappService";
import { avisarPacienteDecision } from "./notifyPatient";
import { RECORDATORIOS_HORAS, ESPERANDO_CONFIRMACION } from "./confirmation";

/**
 * Persigue las horas que el agente dejó pedidas y nadie ha resuelto.
 *
 * Sin esto, una solicitud que el profesional no vio se queda para siempre:
 * el cupo bloqueado, el paciente esperando una respuesta que no llega, y la
 * clínica sin enterarse. El scheduler cierra ese ciclo de tres formas:
 *
 *   1. Recuerda al profesional a las 2 y a las 6 horas.
 *   2. Después del segundo recordatorio avisa a recepción, que también puede
 *      confirmar — es la diferencia entre perder al paciente y no perderlo.
 *   3. Vencido el plazo, libera el cupo y le pide disculpas al paciente
 *      diciéndole la verdad: no se alcanzó a confirmar.
 */

const INTERVALO_MS = 15 * 60 * 1000; // cada 15 min

/**
 * Cuántos recordatorios corresponden según cuánto lleva esperando.
 *
 * Vive aparte para poder probar los bordes: el scheduler corre cada 15 minutos,
 * así que una solicitud puede cruzar la marca de las 2h en cualquier punto de
 * ese intervalo y no debe mandar dos veces el mismo aviso ni saltarse uno.
 */
export function recordatoriosQueTocan(horasEsperando: number): number {
  return RECORDATORIOS_HORAS.filter((h) => horasEsperando >= h).length;
}

/** Solicitudes vivas: pedidas por el agente y todavía sin resolver. */
function pendientesDelAgente() {
  return prisma.booking.findMany({
    where: ESPERANDO_CONFIRMACION,
    include: { clinic: { select: { id: true, name: true, whatsapp: true, waPhoneId: true, waToken: true, waVerified: true } } },
  });
}

/**
 * Manda el recordatorio que toca según cuánto lleva esperando.
 * Devuelve cuántos se enviaron, para el log.
 */
export async function enviarRecordatorios(ahora = new Date()): Promise<number> {
  const pendientes = await pendientesDelAgente();
  let enviados = 0;

  for (const b of pendientes) {
    if (b.confirmDeadline && b.confirmDeadline <= ahora) continue; // ya caducó: lo cierra el otro paso
    const horasEsperando = (ahora.getTime() - b.createdAt.getTime()) / 3_600_000;

    const tocan = recordatoriosQueTocan(horasEsperando);
    if (tocan <= b.remindersSent) continue;

    const r = await avisarProfesional({ bookingId: b.id, esRecordatorio: true });
    // Se cuenta el intento aunque falle el envío: si el profesional no tiene
    // contacto cargado, reintentar cada 15 minutos no lo va a arreglar y sí
    // llenaría el log hasta que caduque.
    await prisma.booking.update({ where: { id: b.id }, data: { remindersSent: tocan } });
    if (r.enviado) enviados++;

    // Tras el último recordatorio se suma recepción, que también tiene el
    // permiso de confirmar.
    if (tocan >= RECORDATORIOS_HORAS.length && !b.escalatedAt) {
      await avisarRecepcion(b.id).catch((e) =>
        console.error("[confirmScheduler] no se pudo avisar a recepción:", e instanceof Error ? e.message : e));
      await prisma.booking.update({ where: { id: b.id }, data: { escalatedAt: ahora } });
    }
  }
  return enviados;
}

/** Avisa al número de la clínica que hay una solicitud sin respuesta. */
async function avisarRecepcion(bookingId: string): Promise<void> {
  const b = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { clinic: { select: { name: true, whatsapp: true, waPhoneId: true, waToken: true, waVerified: true } } },
  });
  if (!b?.clinic.whatsapp) return;

  const meta = b.clinic.waVerified && b.clinic.waPhoneId && b.clinic.waToken
    ? { phoneId: b.clinic.waPhoneId, token: b.clinic.waToken }
    : undefined;

  const fecha = b.date.toLocaleDateString("es-CL", { day: "numeric", month: "long" });
  await sendWhatsAppMessage(
    b.clinic.whatsapp,
    `${b.doctor} no ha respondido una solicitud de hora.\n\n` +
    `${b.patientName ?? "Paciente"} — ${b.service ?? "consulta"}\n` +
    `${fecha} a las ${b.time}\n\n` +
    `Pueden confirmarla o rechazarla desde el panel, en Citas.`,
    meta,
  );
}

/**
 * Cierra las que se pasaron del plazo: libera el cupo y avisa al paciente.
 * Devuelve cuántas se caducaron.
 */
export async function caducarVencidas(ahora = new Date()): Promise<number> {
  const vencidas = await prisma.booking.findMany({
    where: { ...ESPERANDO_CONFIRMACION, confirmDeadline: { lte: ahora } },
    select: { id: true },
  });

  let cerradas = 0;
  for (const { id } of vencidas) {
    // Se re-afirma "pending" en el where: si alguien confirmó justo ahora, su
    // decisión gana y esta corrida no la pisa.
    const r = await prisma.booking.updateMany({
      where: { id, status: "pending" },
      data: {
        status: "cancelled",
        rejectedAt: ahora,
        rejectionReason: "Nadie confirmó dentro del plazo",
      },
    });
    if (r.count === 0) continue;

    cerradas++;
    // Se le dice al paciente qué pasó de verdad. Inventar otra excusa haría
    // que vuelva a pedir la misma hora.
    await avisarPacienteDecision({ bookingId: id, decision: "caducada" })
      .catch((e) => console.error("[confirmScheduler] no se pudo avisar la caducidad:", e instanceof Error ? e.message : e));
  }
  return cerradas;
}

export async function runConfirmCheck(ahora = new Date()): Promise<{ recordatorios: number; caducadas: number }> {
  markSchedulerRun("bookingConfirm");
  const recordatorios = await enviarRecordatorios(ahora);
  const caducadas = await caducarVencidas(ahora);
  if (recordatorios || caducadas) {
    console.info(`[confirmScheduler] ${recordatorios} recordatorio(s), ${caducadas} solicitud(es) caducada(s)`);
  }
  return { recordatorios, caducadas };
}

export function startConfirmScheduler(): void {
  registerScheduler("bookingConfirm", INTERVALO_MS);
  setInterval(() => {
    runConfirmCheck().catch((e) => console.error("[confirmScheduler] error en check:", e));
  }, INTERVALO_MS);
  console.info("[confirmScheduler] Scheduler activo — persigue horas sin confirmar cada 15 min");
}
