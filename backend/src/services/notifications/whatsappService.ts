import { config } from "../../config/env";

export interface BookingNotification {
  clinicName: string;
  clinicWhatsapp: string;   // número de la clínica que recibe el aviso
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

export async function sendWhatsAppMessage(to: string, body: string): Promise<void> {
  const { accountSid, authToken, from } = config.twilio;
  const toFmt = `whatsapp:+${to.replace(/\D/g, "")}`;
  if (!accountSid || !authToken || !from) {
    console.info("[WhatsApp] Twilio no configurado. Mensaje simulado:", { to: toFmt, body });
    return;
  }
  try {
    const twilio = (await import("twilio")).default;
    const client = twilio(accountSid, authToken);
    await client.messages.create({ from, to: toFmt, body });
  } catch (err: any) {
    console.error("[WhatsApp] Error al enviar:", err?.message ?? err);
  }
}

export async function sendBookingNotification(data: BookingNotification): Promise<void> {
  const msg = buildMessage(data);
  const { accountSid, authToken, from } = config.twilio;
  const to = `whatsapp:+${data.clinicWhatsapp}`;

  // Si Twilio no está configurado → log estructurado (activar más tarde)
  if (!accountSid || !authToken || !from) {
    console.info("[WhatsApp] Twilio no configurado. Notificación simulada:");
    console.info({ to, msg });
    return;
  }

  try {
    const twilio = (await import("twilio")).default;
    const client = twilio(accountSid, authToken);
    await client.messages.create({ from, to, body: msg });
    console.info(`[WhatsApp] Notificación enviada a ${to}`);
  } catch (err: any) {
    // No fallar la respuesta al paciente si WhatsApp falla
    console.error("[WhatsApp] Error al enviar notificación:", err?.message ?? err);
  }
}
