import { FastifyInstance } from "fastify";
import prisma from "../config/prisma";
import { getAIResponse } from "../services/ai/claudeService";

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

      const fromRaw    = body.From ?? "";
      const messageText = (body.Body ?? "").trim();
      const fromPhone  = fromRaw.replace("whatsapp:", "").replace("+", "");

      if (!messageText) {
        return reply.type("text/xml").send(twiml(""));
      }

      const clinic = await prisma.clinic.findUnique({ where: { slug } });
      if (!clinic || !clinic.active) {
        return reply.type("text/xml").send(twiml("Lo siento, la clínica no está disponible en este momento."));
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
        where: { clinicId: clinic.id, patientId: patient.id, channel: "whatsapp", status: "open" },
        orderBy: { createdAt: "desc" },
      });
      if (!session) {
        session = await prisma.session.create({
          data: { clinicId: clinic.id, patientId: patient.id, channel: "whatsapp" },
        });
      }

      // Guardar mensaje entrante
      await prisma.message.create({
        data: { sessionId: session.id, role: "user", content: messageText },
      });

      // Obtener respuesta de la IA
      let aiReply = "Lo siento, tuve un problema al procesar tu mensaje. Intenta de nuevo.";
      try {
        const result = await getAIResponse({ message: messageText, clinic, sessionId: session.id });
        aiReply = result.reply || aiReply;

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
    }
  );
}
