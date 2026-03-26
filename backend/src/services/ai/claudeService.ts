import Groq from "groq-sdk";
import { config } from "../../config/env";
import { buildSystemPrompt } from "./promptBuilder";
import { getHistory, appendToHistory } from "./sessionStore";
import type { Clinic } from "@prisma/client";

const client = new Groq({ apiKey: config.groqApiKey });

export interface PatientContextUpdate {
  patientName?: string;
  serviceInterest?: string;
  urgency?: string;
  intent?: string;
  score?: number;
  notes?: string;
}

export interface AIRequestParams {
  message: string;
  clinic: Clinic;
  sessionId: string;
}

export interface AIResponse {
  reply: string;
  context: PatientContextUpdate | null;
}

export async function getAIResponse({
  message,
  clinic,
  sessionId,
}: AIRequestParams): Promise<AIResponse> {
  const systemPrompt = buildSystemPrompt(clinic);

  appendToHistory(sessionId, "user", message);
  const history = getHistory(sessionId);

  const response = await client.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 600,
    messages: [
      { role: "system", content: systemPrompt },
      ...history,
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "update_patient_context",
          description: "Extrae y actualiza el perfil del paciente basado en la conversación.",
          parameters: {
            type: "object",
            properties: {
              patientName: { type: "string", description: "Nombre del paciente si lo mencionó" },
              serviceInterest: { type: "string", description: "Tratamiento o servicio de interés" },
              urgency: { type: "string", enum: ["high", "medium", "low"], description: "Urgencia detectada" },
              intent: { type: "string", enum: ["ready_to_book", "evaluating", "just_browsing"], description: "Intención de agendar" },
              score: { type: "number", description: "Score de lead del 0 al 100" },
              notes: { type: "string", description: "Información adicional relevante" },
            },
          },
        },
      },
    ],
    tool_choice: "auto",
  });

  const msg = response.choices[0]?.message;
  const replyText = msg?.content ?? "";

  appendToHistory(sessionId, "assistant", replyText);

  // Extraer contexto del tool call si lo hubo
  let context: PatientContextUpdate | null = null;
  const toolCall = msg?.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    try {
      context = JSON.parse(toolCall.function.arguments) as PatientContextUpdate;
    } catch {
      // ignorar si falla el parse
    }
  }

  return { reply: replyText, context };
}
