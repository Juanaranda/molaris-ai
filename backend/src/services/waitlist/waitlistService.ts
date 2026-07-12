/**
 * Waitlist — cuando un Booking se cancela, busca el primer match en la lista
 * de espera y le envía un WhatsApp avisando del cupo liberado.
 *
 * Match = misma clínica + (sin preferencia de doctor o coincide) +
 *         (sin preferencia de servicio o coincide) +
 *         (sin rango de fechas o la fecha cae dentro).
 * Orden: createdAt asc — primer llegado, primer servido.
 *
 * Status flow: waiting → notified → converted (si admin lo agenda) | expired (manual)
 */

import prisma from "../../config/prisma";
import { sendMetaMessage } from "../whatsapp/metaService";
import { config } from "../../config/env";

interface CanceledBooking {
  clinicId: string;
  date:     Date;
  time:     string;
  doctor:   string;
  service:  string | null;
}

/**
 * Busca la primera entrada de la waitlist que matchea el slot liberado.
 * Solo considera entries en status="waiting".
 */
async function findFirstMatch(b: CanceledBooking) {
  return prisma.waitlistEntry.findFirst({
    where: {
      clinicId: b.clinicId,
      status:   "waiting",
      AND: [
        { OR: [{ preferredDoctor:  null }, { preferredDoctor:  b.doctor }] },
        { OR: [{ preferredService: null }, ...(b.service ? [{ preferredService: b.service }] : [])] },
        { OR: [{ dateFrom: null }, { dateFrom: { lte: b.date } }] },
        { OR: [{ dateTo:   null }, { dateTo:   { gte: b.date } }] },
      ],
    },
    orderBy: { createdAt: "asc" },
  });
}

function formatPhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

/**
 * Notifica al primer match de la waitlist cuando se libera un slot.
 * No bloquea — debe llamarse async (con .catch para no romper la respuesta principal).
 */
export async function notifyWaitlistForCanceledBooking(bookingId: string): Promise<{
  notified: boolean;
  entryId?: string;
}> {
  const b = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { clinic: { select: { id: true, name: true, waVerified: true, waPhoneId: true, waToken: true, whatsapp: true } } },
  });
  if (!b) return { notified: false };

  const match = await findFirstMatch({
    clinicId: b.clinicId,
    date:     b.date,
    time:     b.time,
    doctor:   b.doctor,
    service:  b.service,
  });
  if (!match) return { notified: false };

  const dateStr = b.date.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });
  const firstName = match.patientName.split(" ")[0];
  const msg = [
    `Hola ${firstName} 👋`,
    ``,
    `Se liberó un cupo en *${b.clinic.name}* que coincide con lo que esperabas:`,
    `📅 ${dateStr} a las ${b.time}`,
    `👩‍⚕️ ${b.doctor}`,
    b.service ? `🔬 ${b.service}` : "",
    ``,
    `¿Te interesa? Responde *SÍ* a este mensaje o llámanos al +${b.clinic.whatsapp ?? ""}.`,
    ``,
    `_${b.clinic.name} · molari.ai_`,
  ].filter(Boolean).join("\n");

  const digits = formatPhone(match.patientPhone);
  const clinicMeta = (b.clinic.waVerified && b.clinic.waPhoneId && b.clinic.waToken)
    ? { phoneId: b.clinic.waPhoneId, token: b.clinic.waToken }
    : null;

  try {
    if (clinicMeta) {
      await sendMetaMessage(clinicMeta.phoneId, clinicMeta.token, digits, msg);
    } else {
      const { accountSid, authToken, from } = config.twilio;
      if (accountSid && authToken && from) {
        const twilio = (await import("twilio")).default;
        await twilio(accountSid, authToken).messages.create({
          from, to: `whatsapp:+${digits}`, body: msg,
        });
      } else {
        console.info(`[Waitlist] Sin canal — simulando aviso a ${digits}`);
      }
    }
  } catch (err) {
    console.error("[Waitlist] Error enviando aviso:", err);
    return { notified: false, entryId: match.id };
  }

  await prisma.waitlistEntry.update({
    where: { id: match.id },
    data:  { status: "notified", notifiedAt: new Date(), notifiedForDate: b.date },
  });
  return { notified: true, entryId: match.id };
}
