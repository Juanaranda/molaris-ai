/**
 * Recall service — recordatorios automáticos de chequeo periódico.
 *
 * Por cada clínica activa, busca pacientes cuya última cita con un servicio X
 * fue hace ≥ intervalDays y que no tienen otra cita próxima — y les envía un
 * WhatsApp recordándoles volver.
 *
 * Defaults sugeridos (creados auto en cada clínica nueva sin reglas):
 *   - Limpieza → 180 días
 *   - Ortodoncia → 30 días
 *   - Control endodoncia → 90 días
 *
 * Se ejecuta una vez al día (cron) desde startRecallScheduler().
 */

import prisma from "../../config/prisma";
import { sendMetaMessage } from "../whatsapp/metaService";
import { config } from "../../config/env";

const DEFAULT_RULES = [
  { triggerService: "Limpieza",             intervalDays: 180, messageTemplate: "Hola {nombre} 👋 Han pasado 6 meses desde tu última limpieza dental en {clinica}. ¿Agendamos tu chequeo? Responde acá para reservar." },
  { triggerService: "Ortodoncia",           intervalDays: 30,  messageTemplate: "Hola {nombre} 👋 Es momento de tu control mensual de ortodoncia en {clinica}. Responde acá para reservar tu próxima cita." },
  { triggerService: "Control endodoncia",   intervalDays: 90,  messageTemplate: "Hola {nombre} 👋 Te toca control post-endodoncia en {clinica}. Responde acá para reservar." },
];

export async function ensureDefaultRecallRules(clinicId: string): Promise<void> {
  const existing = await prisma.recallRule.count({ where: { clinicId } });
  if (existing > 0) return;
  await prisma.recallRule.createMany({
    data: DEFAULT_RULES.map((r) => ({ ...r, clinicId })),
  });
  console.info(`[Recall] Creadas ${DEFAULT_RULES.length} reglas default para clínica ${clinicId}`);
}

interface RecallCandidate {
  rule:          { id: string; triggerService: string; intervalDays: number; messageTemplate: string };
  clinicId:      string;
  clinicName:    string;
  clinicMeta?:   { phoneId: string; token: string };
  patientPhone:  string;
  patientName:   string | null;
  patientRut:    string | null;
  lastBookingAt: Date;
}

/**
 * Encuentra los candidatos a recibir un recall para una clínica.
 * - última cita con el servicio X fue hace ≥ intervalDays
 * - sin cita futura confirmada
 * - sin recall enviado en los últimos 30 días para ese phone+rule
 */
async function findCandidates(
  clinic: { id: string; name: string; waVerified: boolean; waPhoneId: string | null; waToken: string | null },
): Promise<RecallCandidate[]> {
  const rules = await prisma.recallRule.findMany({
    where: { clinicId: clinic.id, active: true },
  });
  if (rules.length === 0) return [];

  const clinicMeta = (clinic.waVerified && clinic.waPhoneId && clinic.waToken)
    ? { phoneId: clinic.waPhoneId, token: clinic.waToken }
    : undefined;

  const now            = new Date();
  const dedupeCutoff   = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 días
  const out: RecallCandidate[] = [];

  for (const rule of rules) {
    const cutoff = new Date(now.getTime() - rule.intervalDays * 24 * 60 * 60 * 1000);

    // Última cita por teléfono con el servicio X (case-insensitive)
    const candidates = await prisma.$queryRaw<Array<{
      patientPhone: string; patientName: string | null; patientRut: string | null; lastDate: Date;
    }>>`
      SELECT
        "patientPhone" as "patientPhone",
        MAX("patientName") as "patientName",
        MAX("patientRut")  as "patientRut",
        MAX(date)          as "lastDate"
      FROM bookings
      WHERE "clinicId" = ${clinic.id}
        AND "patientPhone" IS NOT NULL
        AND status != 'cancelled'
        AND LOWER(service) LIKE ${`%${rule.triggerService.toLowerCase()}%`}
      GROUP BY "patientPhone"
      HAVING MAX(date) <= ${cutoff}
    `;

    for (const c of candidates) {
      // Saltar si tiene cita futura confirmada
      const upcoming = await prisma.booking.findFirst({
        where: {
          clinicId: clinic.id,
          patientPhone: c.patientPhone,
          date: { gte: now },
          status: { not: "cancelled" },
        },
        select: { id: true },
      });
      if (upcoming) continue;

      // Saltar si ya enviamos un recall reciente para ese phone+rule
      const recent = await prisma.recallEvent.findFirst({
        where: {
          ruleId:       rule.id,
          patientPhone: c.patientPhone,
          sentAt:       { gte: dedupeCutoff },
        },
        select: { id: true },
      });
      if (recent) continue;

      out.push({
        rule,
        clinicId:      clinic.id,
        clinicName:    clinic.name,
        clinicMeta,
        patientPhone:  c.patientPhone,
        patientName:   c.patientName,
        patientRut:    c.patientRut,
        lastBookingAt: c.lastDate,
      });
    }
  }
  return out;
}

async function sendRecall(c: RecallCandidate): Promise<void> {
  const digits = c.patientPhone.replace(/\D/g, "");
  if (!digits) return;

  const firstName = c.patientName?.split(" ")[0] ?? "";
  const body = c.rule.messageTemplate
    .replace("{nombre}",  firstName)
    .replace("{clinica}", c.clinicName);

  let success = true;
  let errorMessage: string | undefined;
  try {
    if (c.clinicMeta) {
      await sendMetaMessage(c.clinicMeta.phoneId, c.clinicMeta.token, digits, body);
    } else {
      const { accountSid, authToken, from } = config.twilio;
      if (!accountSid || !authToken || !from) {
        console.info(`[Recall] Sin canal — simulando envío a ${digits}`);
      } else {
        const twilio = (await import("twilio")).default;
        await twilio(accountSid, authToken).messages.create({
          from, to: `whatsapp:+${digits}`, body,
        });
      }
    }
  } catch (err) {
    success = false;
    errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[Recall] Error enviando a ${digits}:`, errorMessage);
  }

  await prisma.recallEvent.create({
    data: {
      ruleId:        c.rule.id,
      clinicId:      c.clinicId,
      patientPhone:  digits,
      patientName:   c.patientName,
      patientRut:    c.patientRut,
      lastBookingAt: c.lastBookingAt,
      success,
      errorMessage,
    },
  });
}

export async function runRecallCheck(): Promise<{ clinics: number; sent: number; failed: number }> {
  const clinics = await prisma.clinic.findMany({
    where: { active: true },
    select: { id: true, name: true, waVerified: true, waPhoneId: true, waToken: true },
  });
  let sent = 0; let failed = 0;
  for (const clinic of clinics) {
    const candidates = await findCandidates(clinic);
    for (const c of candidates) {
      const before = sent;
      await sendRecall(c);
      // Si quedó success=false en el último evento, contar como failed
      const last = await prisma.recallEvent.findFirst({
        where: { ruleId: c.rule.id, patientPhone: c.patientPhone.replace(/\D/g, "") },
        orderBy: { sentAt: "desc" },
        select: { success: true },
      });
      if (last?.success) sent++;
      else failed++;
      // (no romper si sent == before; el contador lo maneja el branching anterior)
      void before;
    }
  }
  if (sent + failed > 0) {
    console.info(`[Recall] ${clinics.length} clínicas procesadas — ${sent} enviados, ${failed} fallos`);
  }
  return { clinics: clinics.length, sent, failed };
}

export function startRecallScheduler(): void {
  // Correr una vez al día (24h) — primer run al iniciar después de 5 min
  const ONE_DAY_MS  = 24 * 60 * 60 * 1000;
  const FIRST_DELAY = 5  * 60 * 1000;

  setTimeout(() => {
    runRecallCheck().catch((e) => console.error("[Recall] Error inicial:", e));
    setInterval(() => {
      runRecallCheck().catch((e) => console.error("[Recall] Error en check:", e));
    }, ONE_DAY_MS);
  }, FIRST_DELAY);

  console.info("[Recall] Scheduler activo — check diario (primer run en 5 min)");
}
