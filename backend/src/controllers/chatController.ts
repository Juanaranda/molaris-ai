import { FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { getAIResponse } from "../services/ai/claudeService";
import prisma from "../config/prisma";
import { config } from "../config/env";

const bodySchema = z.object({
  message: z.string().min(1),
  clinicSlug: z.string().default("galana"),
  sessionId: z.string().optional(),
  slotBooked: z.boolean().optional(),
});

export async function chatController(req: FastifyRequest, reply: FastifyReply) {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.flatten() });
  }

  const { message, clinicSlug, sessionId, slotBooked } = parsed.data;

  const clinic = await prisma.clinic.findUnique({ where: { slug: clinicSlug } });
  if (!clinic) {
    return reply.status(404).send({ error: `Clínica "${clinicSlug}" no encontrada` });
  }

  // Obtener o crear sesión
  let session = sessionId
    ? await prisma.session.findUnique({ where: { id: sessionId } })
    : null;

  if (!session) {
    session = await prisma.session.create({
      data: { clinicId: clinic.id, channel: "web" },
    });
  }

  await prisma.message.create({
    data: { sessionId: session.id, role: "user", content: message },
  });

  // Cargar contexto existente para pasárselo al AI
  const existingCtx = await prisma.patientContext.findUnique({ where: { sessionId: session.id } });

  const { reply: aiReply, context, isFarewell } = await getAIResponse({
    message,
    clinic,
    sessionId: session.id,
    currentContext: {
      patientName:     existingCtx?.patientName     ?? undefined,
      rut:             existingCtx?.rut             ?? undefined,
      email:           existingCtx?.email           ?? undefined,
      serviceInterest: existingCtx?.serviceInterest ?? undefined,
      slotBooked:      slotBooked ?? existingCtx?.slotBooked ?? false,
    },
  });

  await prisma.message.create({
    data: { sessionId: session.id, role: "assistant", content: aiReply },
  });

  if (context) {
    const slotBookedValue = slotBooked ?? existingCtx?.slotBooked ?? false;
    await prisma.patientContext.upsert({
      where: { sessionId: session.id },
      update: { ...context, slotBooked: slotBookedValue || context.slotBooked || false },
      create: { sessionId: session.id, ...context, slotBooked: slotBookedValue || context.slotBooked || false },
    });
  }

  // Adjuntar link de reserva cuando el bot ya dice "aquí:" o cuando la intención cambia a ready_to_book
  // El bot a veces emite la cue textual sin settear el intent → detectar ambos casos
  const hasBookingCue = /(?:aquí|link|enlace)\s*:?\s*$/i.test(aiReply.trim());
  const justReadyToBook =
    context?.intent === "ready_to_book" &&
    existingCtx?.intent !== "ready_to_book";

  let finalReply = aiReply;
  if ((justReadyToBook || hasBookingCue) && !(existingCtx?.slotBooked ?? false)) {
    const bookingUrl = `${config.frontendUrl}/book/${clinicSlug}?s=${session.id}`;
    // Si el reply ya termina en "aquí:" simplemente concatenar la URL en la misma línea
    if (hasBookingCue) {
      finalReply = aiReply.trimEnd() + `\n\n👉 ${bookingUrl}`;
    } else {
      finalReply = aiReply.replace(/\s+$/, "") + `\n\n👉 ${bookingUrl}`;
    }
  }

  return reply.send({ reply: finalReply, sessionId: session.id, context, isFarewell });
}
