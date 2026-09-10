import { FastifyInstance } from "fastify";
import prisma from "../config/prisma";
import { getAIResponse } from "../services/ai/claudeService";
import { config } from "../config/env";
import { datosDeSolicitud } from "../services/booking/confirmation";
import { avisarProfesional } from "../services/booking/notifyProfessional";

function twiml(message: string): string {
  const safe = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${safe}</Message></Response>`;
}

export async function webhookRoutes(app: FastifyInstance) {
  /**
   * POST /api/webhooks/whatsapp/:slug
   *
   * Twilio envía un POST form-encoded con:
   *   From=whatsapp:+56912345678
   *   To=whatsapp:+14155238886
   *   Body=Hola, quiero agendar una cita
   *
   * Configurar en la consola de Twilio:
   *   Sandbox → When a message comes in → https://tu-dominio.com/api/webhooks/whatsapp/galana
   */
  app.post<{ Params: { slug: string } }>(
    "/webhooks/whatsapp/:slug",
    async (req, reply) => {
      const { slug } = req.params;
      const body = req.body as Record<string, string>;

      // Validate Twilio signature to prevent forged webhook requests
      if (config.twilio.authToken) {
        const twilioSignature = req.headers["x-twilio-signature"] as
          string | undefined;
        if (!twilioSignature) {
          return reply.status(403).send("Forbidden");
        }
        const { default: twilio } = await import("twilio");
        // Twilio firma contra la URL pública EXACTA configurada en su consola.
        // Derivarla del frontendUrl rompe la validación en prod (backend vive en
        // otro dominio) — se reconstruye desde los headers del proxy, con
        // PUBLIC_BACKEND_URL como override explícito.
        const proto = ((req.headers["x-forwarded-proto"] as string) ?? "https")
          .split(",")[0]
          .trim();
        const host = (
          (req.headers["x-forwarded-host"] as string) ??
          req.headers.host ??
          ""
        )
          .split(",")[0]
          .trim();
        const webhookUrl = process.env.PUBLIC_BACKEND_URL
          ? `${process.env.PUBLIC_BACKEND_URL.replace(/\/$/, "")}/api/webhooks/whatsapp/${slug}`
          : `${proto}://${host}/api/webhooks/whatsapp/${slug}`;
        const isValid = twilio.validateRequest(
          config.twilio.authToken,
          twilioSignature,
          webhookUrl,
          body,
        );
        if (!isValid) {
          return reply.status(403).send("Forbidden");
        }
      }

      const fromRaw = body.From ?? "";
      const messageText = (body.Body ?? "").trim();
      const fromPhone = fromRaw.replace("whatsapp:", "").replace("+", "");

      if (!messageText) {
        return reply.type("text/xml").send(twiml(""));
      }

      const clinic = await prisma.clinic.findUnique({ where: { slug } });
      if (!clinic || !clinic.active) {
        return reply
          .type("text/xml")
          .send(
            twiml("Lo siento, la clínica no está disponible en este momento."),
          );
      }

      // Encontrar o crear paciente por número WhatsApp
      let patient = await prisma.patient.findFirst({
        where: { clinicId: clinic.id, phone: fromPhone },
      });
      if (!patient) {
        patient = await prisma.patient.create({
          data: { clinicId: clinic.id, phone: fromPhone, channel: "whatsapp" },
        });
      }

      // Encontrar o crear sesión abierta para este número
      let session = await prisma.session.findFirst({
        where: {
          clinicId: clinic.id,
          patientId: patient.id,
          channel: "whatsapp",
          status: "open",
        },
        orderBy: { createdAt: "desc" },
      });
      if (!session) {
        session = await prisma.session.create({
          data: {
            clinicId: clinic.id,
            patientId: patient.id,
            channel: "whatsapp",
          },
        });
      }

      // Guardar mensaje entrante
      await prisma.message.create({
        data: { sessionId: session.id, role: "user", content: messageText },
      });

      // Obtener respuesta de la IA
      let aiReply =
        "Lo siento, tuve un problema al procesar tu mensaje. Intenta de nuevo.";
      try {
        const currentContext = await prisma.patientContext.findUnique({
          where: { sessionId: session.id },
        });
        const ctx = currentContext
          ? {
              patientName: currentContext.patientName ?? undefined,
              rut: currentContext.rut ?? undefined,
              serviceInterest: currentContext.serviceInterest ?? undefined,
              intent: currentContext.intent ?? undefined,
              urgency: currentContext.urgency ?? undefined,
            }
          : {};

        const result = await getAIResponse({
          message: messageText,
          clinic,
          sessionId: session.id,
          currentContext: ctx,
        });

        // Si el modelo pidió crear una cita, ejecutarla
        if (result.bookingAction) {
          const { doctor, date, time, patientName, patientRut, service } =
            result.bookingAction;
          try {
            if (!doctor || !date || !time)
              throw new Error("bookingAction incompleto");
            const bookingDate = new Date(`${date}T12:00:00`);
            const startOfDay = new Date(`${date}T00:00:00`);
            const endOfDay = new Date(`${date}T23:59:59`);
            const displayName = patientName || patient.phone || fromPhone;

            // Mismo patrón que el chat web: conflict check + create en una
            // transacción para que dos mensajes concurrentes no dupliquen el slot.
            const txResult = await prisma.$transaction(async (tx) => {
              const conflict = await tx.booking.findFirst({
                where: {
                  clinicId: clinic.id,
                  doctor,
                  time,
                  date: { gte: startOfDay, lte: endOfDay },
                  status: { not: "cancelled" },
                },
              });
              if (conflict) return { conflict: true as const, booking: null };
              const booking = await tx.booking.create({
                data: {
                  clinicId: clinic.id,
                  patientName: displayName,
                  patientRut: patientRut?.replace(/[.\-]/g, "") || null,
                  date: bookingDate,
                  time,
                  doctor,
                  service: service || null,
                  ...datosDeSolicitud({ fechaCita: bookingDate, telefono: fromPhone }),
                  sessionId: session.id,
                },
              });
              return { conflict: false as const, booking };
            });

            if (txResult.conflict) {
              aiReply = `Ese horario (${time} con ${doctor}) acaba de ser reservado por otro paciente. ¿Te acomoda otro horario?`;
            } else {
              const DAY_NAMES_ES = [
                "Domingo",
                "Lunes",
                "Martes",
                "Miércoles",
                "Jueves",
                "Viernes",
                "Sábado",
              ];
              const dayName = DAY_NAMES_ES[bookingDate.getDay()];
              // La hora queda pedida, no confirmada: la confirma el profesional.
              // Prometer una cita cerrada acá era la misma mentira que se sacó
              // del widget web cuando se armó el human-in-the-loop.
              aiReply = `Listo ${displayName.split(" ")[0]}, dejé tu solicitud para el ${dayName} ${date.slice(8)}/${date.slice(5, 7)} a las ${time} con ${doctor}. Estoy validándola y te aviso apenas tenga respuesta.`;
              console.info(
                `[Webhook] Solicitud creada id=${txResult.booking!.id} para ${displayName}`,
              );
              // Sin esto la solicitud espera a que el scheduler pase (cada 15
              // min); el profesional recibe el link de inmediato.
              avisarProfesional({ bookingId: txResult.booking!.id }).then((r) => {
                if (!r.enviado) console.warn(`[Webhook] no se pudo avisar al profesional (${r.motivo}) — booking ${txResult.booking!.id}`);
              }).catch((e) => console.error("[Webhook] fallo avisando al profesional:", e));
            }
          } catch (bookingErr: any) {
            console.error(
              "[Webhook] Error al crear cita:",
              bookingErr?.message,
            );
            aiReply =
              result.reply ||
              "Hubo un problema al confirmar tu cita. Por favor llámanos directamente.";
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
      } catch (err: any) {
        console.error("[Webhook] Error AI:", err?.message ?? err);
      }

      return reply.type("text/xml").send(twiml(aiReply));
    },
  );
}
