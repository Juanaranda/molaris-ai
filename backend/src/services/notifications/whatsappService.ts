import { config } from "../../config/env";
import { sendMetaMessage } from "../whatsapp/metaService";

export interface ClinicMeta { phoneId: string; token: string }

export interface BookingNotification {
  clinicName: string;
  clinicWhatsapp: string;   // número de la clínica que recibe el aviso
  clinicMeta?: ClinicMeta;
  patientName: string;
  service: string;
  date: string;             // YYYY-MM-DD
  dayName: string;
  time: string;
  doctor: string;
  box: string | null;
  sessionId: string;
}

function buildMessage(b: BookingNotification): string {
  const boxLine = b.box ? `📦 Box: ${b.box}` : "";
  return [
    `🦷 *Nueva cita confirmada — ${b.clinicName}*`,
    ``,
    `👤 Paciente: ${b.patientName || "Sin nombre aún"}`,
    `🔬 Servicio: ${b.service || "A confirmar"}`,
    `📅 Fecha: ${b.dayName} ${b.date.slice(8)}/${b.date.slice(5, 7)} a las ${b.time}`,
    `👩‍⚕️ Doctor/a: ${b.doctor}`,
    boxLine,
    ``,
    `📎 ID sesión: ${b.sessionId}`,
    `_Generado por molari.ai_`,
  ]
    .filter((l) => l !== undefined)
    .join("\n");
}

export async function sendWhatsAppMessage(
  to: string,
  body: string,
  clinicMeta?: ClinicMeta,
): Promise<void> {
  const digits = to.replace(/\D/g, "");

  // Meta Cloud API primero (si la clínica lo tiene verificado)
  if (clinicMeta) {
    try {
      await sendMetaMessage(clinicMeta.phoneId, clinicMeta.token, digits, body);
      return;
    } catch (err) {
      console.error("[WhatsApp] Error vía Meta, intentando Twilio:", err instanceof Error ? err.message : err);
    }
  }

  // Fallback Twilio
  const { accountSid, authToken, from } = config.twilio;
  if (!accountSid || !authToken || !from) {
    console.info("[WhatsApp] Sin canal configurado. Mensaje simulado:", { to: digits, body });
    return;
  }
  try {
    const twilio = (await import("twilio")).default;
    const client = twilio(accountSid, authToken);
    await client.messages.create({ from, to: `whatsapp:+${digits}`, body });
  } catch (err: unknown) {
    console.error("[WhatsApp] Error al enviar:", err instanceof Error ? err.message : err);
  }
}

export async function sendBookingNotification(data: BookingNotification): Promise<void> {
  const msg = buildMessage(data);
  if (!data.clinicWhatsapp) {
    console.info("[WhatsApp] Clínica sin número configurado, notificación omitida");
    return;
  }
  await sendWhatsAppMessage(data.clinicWhatsapp, msg, data.clinicMeta);
  console.info(`[WhatsApp] Notificación de booking enviada a ${data.clinicWhatsapp}`);
}
