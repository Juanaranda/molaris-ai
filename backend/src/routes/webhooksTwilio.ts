/**
 * Webhook de entrada de WhatsApp vía Twilio (número de beta compartido).
 *
 * POST /api/webhooks/twilio  → mensajes entrantes de WhatsApp
 *
 * A diferencia de Meta (que enruta por phone_number_id), el número de Twilio
 * es compartido: TODOS los mensajes se enrutan a la clínica designada en
 * TWILIO_BETA_CLINIC_SLUG. Pensado para pruebas de beta con una sola clínica.
 *
 * Responde con TwiML (XML síncrono) — Twilio envía el mensaje de vuelta, sin
 * necesidad de una llamada saliente separada.
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import crypto from "crypto";
import prisma from "../config/prisma";
import { config } from "../config/env";
import { getAIResponse } from "../services/ai/claudeService";
import { recordAgentSuccess, recordAgentFailure } from "../services/agent/agentHealth";
import { checkDailyBudget } from "../services/ai/budgetGuard";
import { isDuplicateWebhookEvent } from "../lib/webhookDedup";

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const HUMAN_FALLBACK = "¡Gracias por tu mensaje! 🙏 En un momento te atiende una persona del equipo.";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** Respuesta TwiML con un mensaje (o vacía si message es ""). */
function twiml(message = ""): string {
  const inner = message ? `<Message>${escapeXml(message)}</Message>` : "";
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`;
}

/** Valida la firma X-Twilio-Signature (HMAC-SHA1 sobre URL + params ordenados). */
function validTwilioSignature(
  req: FastifyRequest,
  fullUrl: string,
  params: Record<string, string>,
): boolean {
  const sig = req.headers["x-twilio-signature"];
  if (typeof sig !== "string") return false;
  const authToken = config.twilio.authToken;
  if (!authToken) return false;

  let data = fullUrl;
  for (const key of Object.keys(params).sort()) data += key + params[key];
  const expected = crypto.createHmac("sha1", authToken).update(Buffer.from(data, "utf-8")).digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function webhookTwilioRoutes(app: FastifyInstance) {
  app.post("/webhooks/twilio", async (req, reply) => {
    reply.type("text/xml");
    const body = (req.body ?? {}) as Record<string, string>;

    if (config.twilio.validateSignature) {
      const proto = (req.headers["x-forwarded-proto"] as string) ?? "https";
      const fullUrl = config.twilio.webhookUrl || `${proto}://${req.headers.host}${req.raw.url}`;
      if (!validTwilioSignature(req, fullUrl, body)) {
        console.warn("[Twilio webhook] Firma X-Twilio-Signature inválida");
        return reply.status(403).send(twiml());
      }
    }

    const messageText = (body.Body ?? "").trim();
    const fromPhone = (body.From ?? "").replace(/^whatsapp:/i, "").replace(/\D/g, "");
    if (!messageText || !fromPhone) return reply.send(twiml());

    // Twilio reintenta si no ve 2xx a tiempo; un MessageSid repetido no debe
    // gatillar otra respuesta de la IA (#53). Respondemos 200 con TwiML vacío.
    if (body.MessageSid && isDuplicateWebhookEvent("twilio", body.MessageSid)) {
      return reply.send(twiml());
    }

    // Si el enrutamiento no está bien configurado, el paciente igual recibe una
    // respuesta. Antes se devolvía TwiML vacío y quedaba en silencio absoluto:
    // ni el paciente sabía que su mensaje llegó, ni Twilio registraba un error,
    // así que el problema solo era visible leyendo estos logs.
    const slug = config.twilio.betaClinicSlug;
    if (!slug) {
      console.error("[Twilio webhook] TWILIO_BETA_CLINIC_SLUG no configurado — el agente no puede responder");
      return reply.send(twiml(HUMAN_FALLBACK));
    }
    const clinic = await prisma.clinic.findUnique({ where: { slug } });
    if (!clinic || !clinic.active) {
      console.error(
        `[Twilio webhook] Clínica "${slug}" ${!clinic ? "no existe en la base (¿falta correr el seed?)" : "está inactiva"} — el agente no puede responder`,
      );
      return reply.send(twiml(HUMAN_FALLBACK));
    }

    // Paciente + sesión (por teléfono, canal whatsapp)
    let patient = await prisma.patient.findFirst({ where: { clinicId: clinic.id, phone: fromPhone } });
    if (!patient) {
      patient = await prisma.patient.create({ data: { clinicId: clinic.id, phone: fromPhone, channel: "whatsapp" } });
    }
    let session = await prisma.session.findFirst({
      where: { clinicId: clinic.id, patientId: patient.id, channel: "whatsapp", status: "open" },
      orderBy: { createdAt: "desc" },
    });
    if (!session) {
      session = await prisma.session.create({ data: { clinicId: clinic.id, patientId: patient.id, channel: "whatsapp" } });
    }

    await prisma.message.create({ data: { sessionId: session.id, role: "user", content: messageText } });

    // Kill switch (#49)
    if (clinic.agentEnabled === false) {
      await prisma.message.create({ data: { sessionId: session.id, role: "assistant", content: HUMAN_FALLBACK } });
      return reply.send(twiml(HUMAN_FALLBACK));
    }

    // Presupuesto diario de IA (#59)
    const clinicCfg = clinic.config as { aiDailyBudgetUsd?: number } | null;
    if (!(await checkDailyBudget(clinic.id, clinic.name, clinicCfg?.aiDailyBudgetUsd))) {
      await prisma.message.create({ data: { sessionId: session.id, role: "assistant", content: HUMAN_FALLBACK } });
      return reply.send(twiml(HUMAN_FALLBACK));
    }

    let aiReply = "Disculpa, tuve un problema. ¿Puedes intentar de nuevo?";
    try {
      const existingCtx = await prisma.patientContext.findUnique({ where: { sessionId: session.id } });
      const ctx = existingCtx ? {
        patientName:     existingCtx.patientName     ?? undefined,
        rut:             existingCtx.rut             ?? undefined,
        serviceInterest: existingCtx.serviceInterest ?? undefined,
        intent:          existingCtx.intent          ?? undefined,
        urgency:         existingCtx.urgency         ?? undefined,
      } : {};

      const result = await getAIResponse({ message: messageText, clinic, sessionId: session.id, currentContext: ctx });

      if (result.failed) recordAgentFailure(clinic.id, { source: "whatsapp-twilio" });
      else recordAgentSuccess(clinic.id);

      if (result.bookingAction) {
        const { doctor, date, time, patientName, patientRut, service } = result.bookingAction;
        try {
          const bookingDate = new Date(`${date}T12:00:00`);
          await prisma.booking.create({
            data: {
              clinicId: clinic.id,
              patientName: patientName || fromPhone,
              patientRut:  patientRut  || null,
              patientPhone: fromPhone,
              date: bookingDate, time, doctor,
              service: service || null,
              status: "pending",
              sessionId: session.id,
            },
          });
          aiReply = `¡Listo ${patientName.split(" ")[0]}! Tu cita quedó agendada para el ${DAYS[bookingDate.getDay()]} ${date.slice(8)}/${date.slice(5, 7)} a las ${time} con ${doctor}. Te esperamos en ${clinic.name}. 🦷`;
        } catch {
          aiReply = result.reply || aiReply;
        }
      } else {
        aiReply = result.reply || aiReply;
      }

      await prisma.message.create({ data: { sessionId: session.id, role: "assistant", content: aiReply } });
      if (result.context) {
        await prisma.patientContext.upsert({
          where: { sessionId: session.id },
          update: { ...result.context },
          create: { sessionId: session.id, ...result.context },
        });
      }
    } catch (err) {
      console.error("[Twilio webhook] Error IA:", err);
    }

    return reply.send(twiml(aiReply));
  });
}
