import prisma from "../../config/prisma";
import { config } from "../../config/env";

interface ClinicReminderConfig {
  enabled: boolean;
  dayBefore: boolean;
  twoHours: boolean;
}

function getReminderConfig(clinicConfig: unknown): ClinicReminderConfig {
  const cfg = (clinicConfig as Record<string, unknown> | null) ?? {};
  const r = (cfg.reminders as Partial<ClinicReminderConfig>) ?? {};
  return {
    enabled:   r.enabled   !== false,
    dayBefore: r.dayBefore !== false,
    twoHours:  r.twoHours  !== false,
  };
}

interface ReminderPayload {
  phone: string | null | undefined;
  clinicName: string;
  clinicWhatsapp: string;
  patientName: string;
  doctor: string;
  dateStr: string;   // "martes 6 de mayo"
  time: string;
  type: "day" | "hour";
}

function buildReminderMessage({ clinicName, patientName, doctor, dateStr, time, type, clinicWhatsapp }: ReminderPayload): string {
  const lines =
    type === "day"
      ? [
          `Hola ${patientName} 👋`,
          ``,
          `Te recordamos que mañana tienes una cita en *${clinicName}*:`,
          `📅 ${dateStr} a las ${time}`,
          `👩‍⚕️ Con ${doctor}`,
          ``,
          `¿Necesitas cambiar tu hora? Escríbenos al +${clinicWhatsapp}`,
          `_${clinicName} · molari.ai_`,
        ]
      : [
          `Hola ${patientName} 👋`,
          ``,
          `Tu cita en *${clinicName}* es hoy en 2 horas:`,
          `🕐 ${time} con ${doctor}`,
          ``,
          `¡Te esperamos! 🦷`,
          `_${clinicName} · molari.ai_`,
        ];
  return lines.join("\n");
}

function formatPhoneForWhatsapp(raw: string): string {
  return "whatsapp:+" + raw.replace(/\D/g, "");
}

function formatDateSpanish(d: Date): string {
  return d.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });
}

async function sendViaWhatsapp(to: string, body: string): Promise<void> {
  const { accountSid, authToken, from } = config.twilio;

  if (!accountSid || !authToken || !from) {
    console.info("[Reminder] Twilio no configurado — simulando envío a", to);
    console.info("[Reminder] Mensaje:", body);
    return;
  }

  const twilio = (await import("twilio")).default;
  const client = twilio(accountSid, authToken);
  await client.messages.create({ from, to, body });
  console.info(`[Reminder] Enviado a ${to}`);
}

async function sendReminder(payload: ReminderPayload): Promise<void> {
  const msg = buildReminderMessage(payload);

  if (!payload.phone) {
    console.info(`[Reminder] Sin teléfono para ${payload.patientName} — saltando envío`);
    return;
  }

  const toNumber = formatPhoneForWhatsapp(payload.phone);
  await sendViaWhatsapp(toNumber, msg);
}

export async function runReminderCheck(): Promise<void> {
  const now = new Date();

  // ── Recordatorio del día anterior (D-1) ─────────────────────────────────────
  // Busca citas de mañana que aún no hayan recibido este recordatorio
  const tomorrowStart = new Date(now);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  tomorrowStart.setHours(0, 0, 0, 0);

  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setHours(23, 59, 59, 999);

  const dayBookings = await prisma.booking.findMany({
    where: {
      date: { gte: tomorrowStart, lte: tomorrowEnd },
      status: { not: "cancelled" },
      reminderDaySent: false,
    },
    include: {
      clinic: true,
      patientUser: { include: { identity: true } },
    },
  });

  for (const b of dayBookings) {
    const remCfg = getReminderConfig(b.clinic.config);
    if (!remCfg.enabled || !remCfg.dayBefore) {
      await prisma.booking.update({ where: { id: b.id }, data: { reminderDaySent: true } });
      continue;
    }

    const patientName = b.patientUser
      ? `${b.patientUser.identity.firstName} ${b.patientUser.identity.lastName}`
      : (b.patientName ?? "Paciente");
    const phone = b.patientUser?.identity.phone ?? null;

    try {
      await sendReminder({
        phone,
        clinicName: b.clinic.name,
        clinicWhatsapp: b.clinic.whatsapp ?? "",
        patientName,
        doctor: b.doctor,
        dateStr: formatDateSpanish(new Date(b.date)),
        time: b.time,
        type: "day",
      });
    } catch (err: any) {
      console.error(`[Reminder] Error D-1 booking ${b.id}:`, err?.message ?? err);
    }

    await prisma.booking.update({ where: { id: b.id }, data: { reminderDaySent: true } });
  }

  if (dayBookings.length > 0) {
    console.info(`[Reminder] D-1: procesados ${dayBookings.length} recordatorios`);
  }

  // ── Recordatorio de 2 horas antes ────────────────────────────────────────────
  // Busca citas de HOY cuyo horario cae entre ahora+1h45m y ahora+2h15m
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const todayBookings = await prisma.booking.findMany({
    where: {
      date: { gte: todayStart, lte: todayEnd },
      status: { not: "cancelled" },
      reminderHourSent: false,
    },
    include: {
      clinic: true,
      patientUser: { include: { identity: true } },
    },
  });

  const windowStart = new Date(now.getTime() + 1 * 60 * 60 * 1000 + 45 * 60 * 1000); // +1h45m
  const windowEnd   = new Date(now.getTime() + 2 * 60 * 60 * 1000 + 15 * 60 * 1000); // +2h15m

  const hourBookings = todayBookings.filter((b) => {
    const [h, m] = b.time.split(":").map(Number);
    const bookingTime = new Date(now);
    bookingTime.setHours(h, m, 0, 0);
    return bookingTime >= windowStart && bookingTime <= windowEnd;
  });

  for (const b of hourBookings) {
    const remCfg = getReminderConfig(b.clinic.config);
    if (!remCfg.enabled || !remCfg.twoHours) {
      await prisma.booking.update({ where: { id: b.id }, data: { reminderHourSent: true } });
      continue;
    }

    const patientName = b.patientUser
      ? `${b.patientUser.identity.firstName} ${b.patientUser.identity.lastName}`
      : (b.patientName ?? "Paciente");
    const phone = b.patientUser?.identity.phone ?? null;

    try {
      await sendReminder({
        phone,
        clinicName: b.clinic.name,
        clinicWhatsapp: b.clinic.whatsapp ?? "",
        patientName,
        doctor: b.doctor,
        dateStr: formatDateSpanish(new Date(b.date)),
        time: b.time,
        type: "hour",
      });
    } catch (err: any) {
      console.error(`[Reminder] Error 2h booking ${b.id}:`, err?.message ?? err);
    }

    await prisma.booking.update({ where: { id: b.id }, data: { reminderHourSent: true } });
  }

  if (hourBookings.length > 0) {
    console.info(`[Reminder] 2h: procesados ${hourBookings.length} recordatorios`);
  }
}

export function startReminderScheduler(): void {
  // Corre cada 15 minutos
  const INTERVAL_MS = 15 * 60 * 1000;

  runReminderCheck().catch((e) => console.error("[Reminder] Error inicial:", e));
  setInterval(() => {
    runReminderCheck().catch((e) => console.error("[Reminder] Error en check:", e));
  }, INTERVAL_MS);

  console.info("[Reminder] Scheduler activo — check cada 15 minutos");
}
