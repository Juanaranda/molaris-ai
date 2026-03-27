import Groq from "groq-sdk";
import { config } from "../../config/env";
import { buildSystemPrompt } from "./promptBuilder";
import { getHistory, appendToHistory } from "./sessionStore";
import type { Clinic } from "@prisma/client";

const groq = new Groq({ apiKey: config.groqApiKey });

// Cadena de fallback: se intenta en orden hasta que uno responda
// Agregar aquí nuevos modelos/proveedores cuando estén disponibles
const MODEL_CHAIN = [
  { provider: "groq", model: "llama-3.3-70b-versatile" },   // primario — mejor calidad
  { provider: "groq", model: "llama-3.1-8b-instant" },      // fallback 1 — más rápido/barato
  { provider: "groq", model: "gemma2-9b-it" },              // fallback 2 — modelo diferente
  // { provider: "anthropic", model: "claude-haiku-4-5" },  // fallback 3 — cuando tengas créditos
  // { provider: "openai",    model: "gpt-4o-mini" },       // fallback 4 — cuando tengas créditos
];

const STATIC_FALLBACK = "En este momento estamos con alta demanda. Por favor escríbenos directamente al WhatsApp y te atendemos de inmediato. 🦷";

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

  const tools: Groq.Chat.Completions.ChatCompletionTool[] = [
    {
      type: "function",
      function: {
        name: "update_patient_context",
        description: "Extrae y actualiza el perfil del paciente basado en la conversación.",
        parameters: {
          type: "object",
          properties: {
            patientName: { type: "string" },
            serviceInterest: { type: "string" },
            urgency: { type: "string", enum: ["high", "medium", "low"] },
            intent: { type: "string", enum: ["ready_to_book", "evaluating", "just_browsing"] },
            score: { type: "number" },
            notes: { type: "string" },
          },
        },
      },
    },
  ];

  // Intentar cada modelo en la cadena hasta que uno responda
  let msg: Groq.Chat.Completions.ChatCompletionMessage | undefined;
  let usedModel = "";
  for (const { model } of MODEL_CHAIN) {
    try {
      const response = await groq.chat.completions.create({
        model,
        max_tokens: 600,
        messages: [{ role: "system", content: systemPrompt }, ...history],
        tools,
        tool_choice: "auto",
      });
      msg = response.choices[0]?.message;
      usedModel = model;
      break;
    } catch (err: any) {
      const isRetryable = err?.status === 429 || err?.status >= 500 || err?.code === "ECONNREFUSED";
      if (!isRetryable) throw err; // error no recuperable → no reintentar
      console.warn(`[AI] ${model} falló (${err?.status ?? err?.code}), probando siguiente...`);
    }
  }

  if (!msg) {
    // Todos los modelos fallaron → respuesta estática de emergencia
    console.error("[AI] Todos los modelos fallaron. Usando respuesta estática.");
    return { reply: STATIC_FALLBACK, context: null };
  }

  if (usedModel !== MODEL_CHAIN[0].model) {
    console.warn(`[AI] Usando modelo de fallback: ${usedModel}`);
  }
  const rawContent = msg?.content ?? "";

  // Extraer contexto: primero desde tool_calls (formato correcto),
  // luego desde tags inline <function=...> que Llama a veces emite como texto
  let context: PatientContextUpdate | null = null;
  const toolCall = msg?.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    try {
      context = JSON.parse(toolCall.function.arguments) as PatientContextUpdate;
    } catch {}
  }

  // Fallback: parsear y limpiar tags inline del reply
  let replyText = rawContent;
  if (!context) {
    const funcMatch = rawContent.match(/<function=update_patient_context>([\s\S]*?)<\/function>/);
    if (funcMatch) {
      try {
        context = JSON.parse(funcMatch[1]) as PatientContextUpdate;
      } catch {}
      replyText = rawContent
        .replace(/<function=update_patient_context>[\s\S]*?<\/function>/g, "")
        .trim();
    }
  }

  appendToHistory(sessionId, "assistant", replyText);

  return { reply: replyText, context };
}
