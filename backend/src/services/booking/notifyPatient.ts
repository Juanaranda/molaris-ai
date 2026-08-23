import prisma from "../../config/prisma";
import { sendWhatsAppMessage } from "../notifications/whatsappService";
import { getWeekAvailability } from "../availability/availabilityService";

/**
 * Le cuenta al paciente qué pasó con la hora que pidió.
 *
 * La regla que fijó Juan: el rechazo SIEMPRE va con contraoferta. Un "no" seco
 * pierde a alguien que ya demostró que quiere atenderse; con dos horarios
 * concretos al lado, la conversación sigue.
 */

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function legible(fecha: Date, hora: string): string {
  return `${DIAS[fecha.getDay()]} ${fecha.toLocaleDateString("es-CL", { day: "numeric", month: "long" })} a las ${hora}`;
}

/** Hasta dos horas libres del mismo profesional, a partir de la que pidió. */
async function buscarAlternativas(
  clinicId: string, doctor: string, desde: Date, servicio: string | null,
): Promise<string[]> {
  try {
    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { config: true } });
    if (!clinic) return [];
    const semana = getWeekAvailability(
      desde.toISOString().slice(0, 10),
      clinic.config as never,
      servicio ?? undefined,
    );
    const libres: string[] = [];
    for (const dia of semana) {
      for (const slot of dia.slots) {
        if (slot.doctor !== doctor) continue;
        libres.push(legible(new Date(`${dia.date}T12:00:00`), slot.time));
        if (libres.length === 2) return libres;
      }
    }
    return libres;
  } catch (e) {
    // Sin alternativas el mensaje igual sale; peor sería no avisar nada.
    console.error("[confirmación] no se pudieron calcular alternativas:", e instanceof Error ? e.message : e);
    return [];
  }
}

export async function avisarPacienteDecision({ bookingId, decision, motivo }: {
  bookingId: string;
  decision: "confirmada" | "rechazada" | "caducada";
  motivo?: string;
}): Promise<{ enviado: boolean }> {
  const b = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { clinic: { select: { name: true, waPhoneId: true, waToken: true, waVerified: true } } },
  });
  if (!b) return { enviado: false };

  // Sin teléfono no hay a dónde avisar. Queda en el log porque es una cita que
  // se decidió sin que el paciente se entere.
  if (!b.patientPhone) {
    console.warn(`[confirmación] booking ${b.id} (${decision}) sin teléfono del paciente: no se avisó`);
    return { enviado: false };
  }

  const nombre = b.patientName?.split(" ")[0] ?? "";
  const cuando = legible(b.date, b.time);
  let texto: string;

  if (decision === "confirmada") {
    texto = `${nombre}, tu hora quedó confirmada.\n\n${cuando} con ${b.doctor}\n\nTe esperamos en ${b.clinic.name}.`;
  } else {
    const alternativas = await buscarAlternativas(b.clinicId, b.doctor, b.date, b.service);
    const cabecera = decision === "caducada"
      // Se dice lo que pasó de verdad: no se alcanzó a confirmar. Inventar otra
      // excusa es peor, porque el paciente vuelve a pedir la misma hora.
      ? `${nombre}, no alcanzamos a confirmar tu hora del ${cuando} con ${b.doctor} y tuvimos que liberarla. Disculpa la molestia.`
      : `${nombre}, ${b.doctor} no puede atenderte el ${cuando}${motivo ? `: ${motivo}` : "."}`;

    texto = alternativas.length
      ? `${cabecera}\n\nTe puedo ofrecer:\n${alternativas.map((a) => `· ${a}`).join("\n")}\n\n¿Te sirve alguna? Respóndeme y la dejo pedida.`
      : `${cabecera}\n\nEscríbeme y buscamos otro horario que te acomode.`;
  }

  const meta = b.clinic.waVerified && b.clinic.waPhoneId && b.clinic.waToken
    ? { phoneId: b.clinic.waPhoneId, token: b.clinic.waToken }
    : undefined;

  try {
    await sendWhatsAppMessage(b.patientPhone, texto, meta);
    return { enviado: true };
  } catch (e) {
    console.error("[confirmación] no se pudo avisar al paciente:", e instanceof Error ? e.message : e);
    return { enviado: false };
  }
}
