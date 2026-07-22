/**
 * Webhook de Meta Cloud API — multi-tenant.
 *
 * GET  /api/webhooks/meta  → verificación del webhook (Meta lo llama al configurar)
 * POST /api/webhooks/meta  → mensajes entrantes de WhatsApp
 *
 * Meta identifica la clínica por phone_number_id en el payload.
 * La clínica debe tener waPhoneId + waToken en su registro de DB.
 */

import crypto from "node:crypto";
import { FastifyInstance } from "fastify";
import prisma from "../config/prisma";
import { config } from "../config/env";
import { getAIResponse } from "../services/ai/claudeService";
import { sendMetaMessage, markMetaMessageRead } from "../services/whatsapp/metaService";
import { recordAgentSuccess, recordAgentFailure } from "../services/agent/agentHealth";
import { isDuplicateWebhookEvent } from "../lib/webhookDedup";

interface MetaWebhookBody {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: { phone_number_id: string; display_phone_number: string };
        messages?: Array<{
          id: string;
          from: string;
          type: string;
          text?: { body: string };
          timestamp: string;
        }>;
        statuses?: unknown[];
      };
      field: string;
    }>;
  }>;
}

export async function webhookMetaRoutes(app: FastifyInstance) {
  // Capturar rawBody en este plugin para validación HMAC de Meta.
  // addContentTypeParser es scoped a este plugin gracias a la encapsulación de Fastify.
  app.addContentTypeParser("application/json", { parseAs: "buffer" }, (req, body, done) => {
    (req as unknown as Record<string, unknown>).rawBody = body;
    try {
      done(null, JSON.parse((body as Buffer).toString("utf8")));
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  // ── Verificación del webhook (Meta llama esto al registrar la URL) ──────────
  app.get("/webhooks/meta", async (req, reply) => {
    const q = req.query as Record<string, string>;
    const mode      = q["hub.mode"];
    const token     = q["hub.verify_token"];
    const challenge = q["hub.challenge"];

    if (mode === "subscribe" && token === config.meta.verifyToken) {
      console.info("[Meta webhook] Verificación exitosa");
      return reply.status(200).send(challenge);
    }
    return reply.status(403).send("Forbidden");
  });

  // ── Mensajes entrantes ──────────────────────────────────────────────────────
  app.post("/webhooks/meta", async (req, reply) => {
    // Validar firma HMAC-SHA256 si META_APP_SECRET está configurado
    if (config.meta.appSecret) {
      const signature = (req.headers["x-hub-signature-256"] as string | undefined) ?? "";
      const rawBody   = (req as unknown as Record<string, unknown>).rawBody as Buffer | undefined;
      if (!rawBody || !signature) {
        return reply.status(403).send("Missing signature");
      }
      const expected = "sha256=" + crypto
        .createHmac("sha256", config.meta.appSecret)
        .update(rawBody)
        .digest("hex");
      const sigBuf = Buffer.from(signature);
      const expBuf = Buffer.from(expected);
      // timingSafeEqual lanza si los largos difieren — una firma malformada
      // debe responder 403, no 500.
      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        console.warn("[Meta webhook] Firma HMAC inválida — request rechazada");
        return reply.status(403).send("Invalid signature");
      }
    }

    const body = req.body as MetaWebhookBody;

    // Responder 200 de inmediato — Meta reintenta si no recibe 200 en 20 s
    reply.status(200).send({ ok: true });

    if (body.object !== "whatsapp_business_account") return;

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const val = change.value;
        if (!val.messages?.length) continue;

        const phoneId = val.metadata.phone_number_id;

        // Buscar clínica por Phone Number ID
        const clinic = await prisma.clinic.findUnique({
          where: { waPhoneId: phoneId },
        });
        if (!clinic || !clinic.active || !clinic.waToken) {
          console.warn(`[Meta] Phone ID ${phoneId} sin clínica registrada`);
          continue;
        }

        for (const msg of val.messages) {
          if (msg.type !== "text" || !msg.text?.body) continue;
          if (msg.id && isDuplicateWebhookEvent("meta", msg.id)) continue; // reintento de Meta (#53)

          const fromPhone   = msg.from;          // número sin +
          const messageText = msg.text.body.trim();

          // Marcar como leído
          markMetaMessageRead(phoneId, clinic.waToken, msg.id);

          // Encontrar o crear paciente
          let patient = await prisma.patient.findFirst({
            where: { clinicId: clinic.id, phone: fromPhone },
          });
          if (!patient) {
            patient = await prisma.patient.create({
              data: { clinicId: clinic.id, phone: fromPhone, channel: "whatsapp" },
            });
          }

          // Encontrar o crear sesión
          let session = await prisma.session.findFirst({
            where: { clinicId: clinic.id, patientId: patient.id, channel: "whatsapp", status: "open" },
            orderBy: { createdAt: "desc" },
          });
          if (!session) {
            session = await prisma.session.create({
              data: { clinicId: clinic.id, patientId: patient.id, channel: "whatsapp" },
            });
          }

          await prisma.message.create({
            data: { sessionId: session.id, role: "user", content: messageText },
          });

          // Kill switch del agente (#49): si está apagado, fallback humano sin IA
          if (clinic.agentEnabled === false) {
            const fb = "¡Gracias por tu mensaje! 🙏 En un momento te atiende una persona del equipo.";
            await sendMetaMessage(phoneId, clinic.waToken, fromPhone, fb);
            await prisma.message.create({ data: { sessionId: session.id, role: "assistant", content: fb } });
            continue;
          }

          // IA
          let aiReply = "Lo siento, tuve un problema. Por favor intenta de nuevo.";
          try {
            const existingCtx = await prisma.patientContext.findUnique({
              where: { sessionId: session.id },
            });
            const ctx = existingCtx ? {
              patientName:     existingCtx.patientName     ?? undefined,
              rut:             existingCtx.rut             ?? undefined,
              serviceInterest: existingCtx.serviceInterest ?? undefined,
              intent:          existingCtx.intent          ?? undefined,
              urgency:         existingCtx.urgency         ?? undefined,
            } : {};

            const result = await getAIResponse({ message: messageText, clinic, sessionId: session.id, currentContext: ctx });

            // Salud del agente / circuit breaker (#50)
            if (result.failed) recordAgentFailure(clinic.id, { source: "whatsapp" });
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
                const DAYS = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
                aiReply = `¡Listo ${patientName.split(" ")[0]}! Tu cita está confirmada para el ${DAYS[bookingDate.getDay()]} ${date.slice(8)}/${date.slice(5,7)} a las ${time} con ${doctor}. Te esperamos en ${clinic.name}. 🦷`;
              } catch {
                aiReply = result.reply || aiReply;
              }
            } else {
              aiReply = result.reply || aiReply;
            }

            await prisma.message.create({
              data: { sessionId: session.id, role: "assistant", content: aiReply },
            });
            if (result.context) {
              await prisma.patientContext.upsert({
                where: { sessionId: session.id },
                update: { ...result.context },
                create: { sessionId: session.id, ...result.context },
              });
            }
          } catch (err: unknown) {
            console.error("[Meta webhook] Error IA:", err);
          }

          // Enviar respuesta al paciente
          try {
            await sendMetaMessage(phoneId, clinic.waToken, fromPhone, aiReply);
          } catch (err: unknown) {
            console.error("[Meta webhook] Error enviando mensaje:", err);
          }
        }
      }
    }
  });
}
