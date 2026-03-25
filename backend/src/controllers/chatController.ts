import { FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { getAIResponse } from "../services/ai/claudeService";

const bodySchema = z.object({
  message: z.string().min(1),
  clinicId: z.string().optional(),
  sessionId: z.string().optional(),
});

export async function chatController(req: FastifyRequest, reply: FastifyReply) {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.flatten() });
  }

  const { message, clinicId, sessionId } = parsed.data;

  const response = await getAIResponse({ message, clinicId, sessionId });
  return reply.send({ reply: response });
}
