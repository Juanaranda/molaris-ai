import Groq from "groq-sdk";
import { config } from "../../config/env";
import { buildSystemPrompt } from "./promptBuilder";
import { buildContextHint } from "./contextInjector";
import { getHistory, appendToHistory, getMessageCount, MAX_MESSAGES } from "./sessionStore";
import { checkTopic, OFF_TOPIC_REPLY, TOO_LONG_REPLY } from "./topicGuard";
import { computeScore } from "./leadScoring";
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
  rut?: string;
  email?: string;
  serviceInterest?: string;
  urgency?: string;
  intent?: string;
  score?: number;
  notes?: string;
  slotBooked?: boolean;
}

export interface AIRequestParams {
  message: string;
  clinic: Clinic;
  sessionId: string;
  currentContext?: Partial<PatientContextUpdate>;
}

export interface AIResponse {
  reply: string;
  context: PatientContextUpdate | null;
  isFarewell: boolean;
}

function extractContextHeuristic(message: string): PatientContextUpdate | null {
  const lower = message.toLowerCase();
  const wantsBooking = /agend|reserv|cita|quiero|necesito|hora/.test(lower);
  const hasUrgency   = /dolor|duele|urgente|fractura|sangr/.test(lower);
  const serviceMatch = lower.match(/(limpieza|blanqueamiento|implante|ortodoncia|endodoncia|carilla|extracci[oó]n|urgencia|conducto)/);

  if (!wantsBooking && !serviceMatch && !hasUrgency) return null;

  return {
    intent:          wantsBooking ? "ready_to_book" : "evaluating",
    urgency:         hasUrgency ? "high" : "low",
    serviceInterest: serviceMatch ? serviceMatch[0] : undefined,
    patientName:     undefined,
    score:           0, // se calcula justo después
  };
}

function buildStateHint(ctx: Partial<PatientContextUpdate>): string {
  const lines = [
    "## DATOS YA RECOPILADOS EN ESTA CONVERSACIÓN (NO los vuelvas a pedir)",
  ];

  if (ctx.slotBooked)    lines.push("- Hora: ya seleccionó horario — NO preguntes fecha/hora de nuevo");
  if (ctx.patientName)   lines.push(`- Nombre: ${ctx.patientName}`);
  if (ctx.rut)           lines.push(`- RUT: ${ctx.rut}`);
  if (ctx.email)         lines.push(`- Email: ${ctx.email}`);

  // Solo indicar qué falta si ya agendó hora
  if (ctx.slotBooked) {
    const missing: string[] = [];
    if (!ctx.patientName) missing.push("nombre completo");
    if (!ctx.rut)         missing.push("RUT (formato XX.XXX.XXX-X)");
    if (missing.length > 0) {
      lines.push(`\nPara confirmar la cita aún falta: ${missing.join(" y ")}. Pídelo de forma natural en la conversación.`);
    } else if (!ctx.email) {
      lines.push("\nTodos los datos obligatorios están completos. Puedes preguntar el email (opcional) o despedirte.");
    } else {
      lines.push("\nTodos los datos están completos. Despídete con un mensaje cálido.");
    }
  }

  return lines.join("\n");
}

export async function getAIResponse({
  message,
  clinic,
  sessionId,
  currentContext = {},
}: AIRequestParams): Promise<AIResponse> {
  // ── Capa 1: Rate limit por sesión ─────────────────────────────────
  if (getMessageCount(sessionId) >= MAX_MESSAGES) {
    return {
      reply: "Has alcanzado el límite de mensajes de esta sesión. Para continuar, contáctanos directamente o inicia una nueva conversación.",
      context: null,
    };
  }

  // ── Capa 2: Pre-filtro de tópico (sin costo de LLM) ──────────────
  const guard = checkTopic(message);
  if (!guard.allowed) {
    appendToHistory(sessionId, "user", message);
    const reply = guard.reason === "too_long" ? TOO_LONG_REPLY : OFF_TOPIC_REPLY;
    appendToHistory(sessionId, "assistant", reply);
    return { reply, context: null };
  }

  const systemPrompt = buildSystemPrompt(clinic);
  const contextHint = buildContextHint(message, clinic.config);
  const stateHint = buildStateHint(currentContext);
  appendToHistory(sessionId, "user", message);
  const history = getHistory(sessionId);

  const tools: Groq.Chat.Completions.ChatCompletionTool[] = [
    {
      type: "function",
      function: {
        name: "update_patient_context",
        description: "Extrae datos reales del paciente mencionados en la conversación. SOLO incluye un campo si el paciente lo mencionó explícitamente. NO uses 'Pendiente', 'null', ni valores inventados.",
        parameters: {
          type: "object",
          properties: {
            patientName: { type: "string", description: "Nombre completo del paciente" },
            rut: { type: "string", description: "RUT del paciente (formato XX.XXX.XXX-X)" },
            email: { type: "string", description: "Email del paciente (opcional)" },
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
        messages: [
          { role: "system", content: systemPrompt },
          ...(contextHint ? [{ role: "system" as const, content: contextHint }] : []),
          { role: "system", content: stateHint },
          ...history,
        ],
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
  // Llama puede emitir dos formatos distintos:
  //   A) <function=name>json</function>
  //   B) <function=name {json}>  (self-closing con JSON inline)
  let replyText = rawContent;
  if (!context) {
    // Formato A
    const funcMatchA = rawContent.match(/<function=update_patient_context>([\s\S]*?)<\/function>/);
    if (funcMatchA) {
      try { context = JSON.parse(funcMatchA[1]) as PatientContextUpdate; } catch {}
    }
    // Formato B
    if (!context) {
      const funcMatchB = rawContent.match(/<function=update_patient_context\s*(\{[\s\S]*?\})\s*>/);
      if (funcMatchB) {
        try { context = JSON.parse(funcMatchB[1]) as PatientContextUpdate; } catch {}
      }
    }
    // Limpiar cualquier variante del tag del texto de respuesta
    replyText = rawContent
      .replace(/<function=update_patient_context>[\s\S]*?<\/function>/g, "")
      .replace(/<function=update_patient_context\s*\{[\s\S]*?\}\s*>/g, "")
      .replace(/<function=[^>]*>/g, "")
      .trim();
  }

  appendToHistory(sessionId, "assistant", replyText);

  // Fallback heurístico: si el LLM no disparó el tool, extraer señales del mensaje
  if (!context) {
    context = extractContextHeuristic(message);
  }

  // Fusionar con contexto previo para no perder datos entre turnos
  const mergedContext: PatientContextUpdate = { ...currentContext, ...context };

  // Score siempre calculado de forma determinista (nunca confiar en el número del LLM)
  if (mergedContext) mergedContext.score = computeScore(mergedContext);

  // Despedida cuando hay hora agendada + nombre + RUT
  const isFarewell = Boolean(
    mergedContext.slotBooked &&
    mergedContext.patientName &&
    mergedContext.rut
  );

  return { reply: replyText, context: mergedContext, isFarewell };
}
