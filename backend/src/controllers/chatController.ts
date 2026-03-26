import { FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { getAIResponse } from "../services/ai/claudeService";
import prisma from "../config/prisma";

const bodySchema = z.object({
  message: z.string().min(1),
  clinicSlug: z.string().default("galana"),
  sessionId: z.string().optional(),
});

export async function chatController(req: FastifyRequest, reply: FastifyReply) {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.flatten() });
  }

  const { message, clinicSlug, sessionId } = parsed.data;

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

  const { reply: aiReply, context } = await getAIResponse({
    message,
    clinic,
    sessionId: session.id,
  });

  await prisma.message.create({
    data: { sessionId: session.id, role: "assistant", content: aiReply },
  });

  if (context) {
    await prisma.patientContext.upsert({
      where: { sessionId: session.id },
      update: { ...context },
      create: { sessionId: session.id, ...context },
    });
  }

  return reply.send({ reply: aiReply, sessionId: session.id, context });
}
