import { config } from "../../config/env";
import { buildSystemPrompt } from "./promptBuilder";
import { buildContextHint } from "./contextInjector";
import { getHistory, appendToHistory, getMessageCount, MAX_MESSAGES } from "./sessionStore";
import { checkTopic, OFF_TOPIC_REPLY, TOO_LONG_REPLY } from "./topicGuard";
import { computeScore } from "./leadScoring";
import type { Clinic } from "@prisma/client";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1/chat/completions";
const STATIC_FALLBACK = "En este momento estamos con alta demanda. Por favor escríbenos directamente al WhatsApp y te atendemos de inmediato. 🦷";

// ── Tipos ──────────────────────────────────────────────────────────────────

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

// ── Clasificador de complejidad (sin costo de LLM) ─────────────────────────
//
// Tier 1 — fast    : saludos, preguntas simples (precio, horario, ubicación)
// Tier 2 — balanced: intención de agendar, multi-turno, contexto moderado
// Tier 3 — smart   : urgencia médica, confirmación de datos críticos (RUT)
//
type Tier = "fast" | "balanced" | "smart";

function classifyTier(
  message: string,
  ctx: Partial<PatientContextUpdate>,
  historyLength: number,
): Tier {
  const lower = message.toLowerCase();

  // Tier 3: situaciones críticas
  const isCritical =
    /dolor|duele|sangr|fractura|urgente|urgencia|rut|confirmaci[oó]n/.test(lower) ||
    Boolean(ctx.slotBooked); // ya agendó → confirmar datos es crítico

  if (isCritical) return "smart";

  // Tier 2: quiere agendar o conversación larga
  const wantsBooking =
    /agend|reserv|cita|hora|disponible|quiero|necesito/.test(lower) ||
    ctx.intent === "ready_to_book" ||
    historyLength > 6;

  if (wantsBooking) return "balanced";

  // Tier 1: todo lo demás
  return "fast";
}

// ── Llamada a OpenRouter ───────────────────────────────────────────────────

interface ORMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const TOOLS = [
  {
    type: "function",
    function: {
      name: "update_patient_context",
      description:
        "Extrae datos reales del paciente mencionados en la conversación. SOLO incluye un campo si el paciente lo mencionó explícitamente. NO uses 'Pendiente', 'null', ni valores inventados.",
      parameters: {
        type: "object",
        properties: {
          patientName:     { type: "string", description: "Nombre completo del paciente" },
          rut:             { type: "string", description: "RUT del paciente (formato XX.XXX.XXX-X)" },
          email:           { type: "string", description: "Email del paciente (opcional)" },
          serviceInterest: { type: "string" },
          urgency:         { type: "string", enum: ["high", "medium", "low"] },
          intent:          { type: "string", enum: ["ready_to_book", "evaluating", "just_browsing"] },
          score:           { type: "number" },
          notes:           { type: "string" },
        },
      },
    },
  },
];

async function callOpenRouter(model: string, messages: ORMessage[]) {
  const res = await fetch(OPENROUTER_BASE, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.openRouter.apiKey}`,
      "Content-Type":  "application/json",
      "HTTP-Referer":  "https://molaris.ai",
      "X-Title":       "Molaris AI",
    },
    body: JSON.stringify({ model, messages, tools: TOOLS, tool_choice: "auto", max_tokens: 600 }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw Object.assign(new Error(`OpenRouter ${res.status}`), { status: res.status, body });
  }

  return res.json() as Promise<any>;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function extractContextHeuristic(message: string): PatientContextUpdate | null {
  const lower = message.toLowerCase();
  const wantsBooking  = /agend|reserv|cita|quiero|necesito|hora/.test(lower);
  const hasUrgency    = /dolor|duele|urgente|fractura|sangr/.test(lower);
  const serviceMatch  = lower.match(/(limpieza|blanqueamiento|implante|ortodoncia|endodoncia|carilla|extracci[oó]n|urgencia|conducto)/);

  if (!wantsBooking && !serviceMatch && !hasUrgency) return null;

  return {
    intent:          wantsBooking ? "ready_to_book" : "evaluating",
    urgency:         hasUrgency ? "high" : "low",
    serviceInterest: serviceMatch ? serviceMatch[0] : undefined,
    patientName:     undefined,
    score:           0,
  };
}

function buildStateHint(ctx: Partial<PatientContextUpdate>): string {
  const lines = ["## DATOS YA RECOPILADOS EN ESTA CONVERSACIÓN (NO los vuelvas a pedir)"];

  if (ctx.slotBooked)  lines.push("- Hora: ya seleccionó horario — NO preguntes fecha/hora de nuevo");
  if (ctx.patientName) lines.push(`- Nombre: ${ctx.patientName}`);
  if (ctx.rut)         lines.push(`- RUT: ${ctx.rut}`);
  if (ctx.email)       lines.push(`- Email: ${ctx.email}`);

  if (ctx.slotBooked) {
    const missing: string[] = [];
    if (!ctx.patientName) missing.push("nombre completo");
    if (!ctx.rut)         missing.push("RUT (formato XX.XXX.XXX-X)");
    if (missing.length > 0) {
      lines.push(`\nPara confirmar la cita aún falta: ${missing.join(" y ")}. Pídelo de forma natural.`);
    } else if (!ctx.email) {
      lines.push("\nTodos los datos obligatorios están completos. Puedes preguntar el email (opcional) o despedirte.");
    } else {
      lines.push("\nTodos los datos están completos. Despídete con un mensaje cálido.");
    }
  }

  return lines.join("\n");
}

// ── Función principal ──────────────────────────────────────────────────────

export async function getAIResponse({
  message,
  clinic,
  sessionId,
  currentContext = {},
}: AIRequestParams): Promise<AIResponse> {

  // Capa 1: rate limit por sesión
  if (getMessageCount(sessionId) >= MAX_MESSAGES) {
    return {
      reply: "Has alcanzado el límite de mensajes de esta sesión. Para continuar, contáctanos directamente o inicia una nueva conversación.",
      context: null,
      isFarewell: false,
    };
  }

  // Capa 2: pre-filtro de tópico (sin costo de LLM)
  const guard = checkTopic(message);
  if (!guard.allowed) {
    appendToHistory(sessionId, "user", message);
    const reply = guard.reason === "too_long" ? TOO_LONG_REPLY : OFF_TOPIC_REPLY;
    appendToHistory(sessionId, "assistant", reply);
    return { reply, context: null, isFarewell: false };
  }

  const systemPrompt = buildSystemPrompt(clinic);
  const contextHint  = buildContextHint(message, clinic.config);
  const stateHint    = buildStateHint(currentContext);
  appendToHistory(sessionId, "user", message);
  const history = getHistory(sessionId);

  // Capa 3: orquestación por tier de complejidad
  const tier  = classifyTier(message, currentContext, history.length);
  const model = config.openRouter.models[tier];
  console.log(`[AI] tier=${tier} model=${model}`);

  // Cadena de fallback: tier elegido → balanced → smart → estático
  const fallbackChain: string[] = [model];
  if (tier === "fast")  fallbackChain.push(config.openRouter.models.balanced);
  if (tier !== "smart") fallbackChain.push(config.openRouter.models.smart);

  const messages: ORMessage[] = [
    { role: "system", content: systemPrompt },
    ...(contextHint ? [{ role: "system" as const, content: contextHint }] : []),
    { role: "system", content: stateHint },
    ...history,
  ];

  let orMsg: any;
  for (const m of fallbackChain) {
    try {
      const data = await callOpenRouter(m, messages);
      orMsg = data.choices?.[0]?.message;
      if (m !== model) console.warn(`[AI] Usando fallback: ${m}`);
      break;
    } catch (err: any) {
      const retryable = err?.status === 429 || (err?.status ?? 0) >= 500;
      if (!retryable) throw err;
      console.warn(`[AI] ${m} falló (${err?.status}), probando siguiente...`);
    }
  }

  if (!orMsg) {
    console.error("[AI] Todos los modelos fallaron. Usando respuesta estática.");
    return { reply: STATIC_FALLBACK, context: null, isFarewell: false };
  }

  const rawContent = orMsg.content ?? "";

  // Extraer contexto del tool_call
  let context: PatientContextUpdate | null = null;
  const toolCall = orMsg.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    try { context = JSON.parse(toolCall.function.arguments) as PatientContextUpdate; } catch {}
  }

  // Fallback: parsear tags inline que algunos modelos emiten como texto
  let replyText = rawContent;
  if (!context) {
    const matchA = rawContent.match(/<function=update_patient_context>([\s\S]*?)<\/function>/);
    if (matchA) {
      try { context = JSON.parse(matchA[1]) as PatientContextUpdate; } catch {}
    }
    if (!context) {
      const matchB = rawContent.match(/<function=update_patient_context\s*(\{[\s\S]*?\})\s*>/);
      if (matchB) {
        try { context = JSON.parse(matchB[1]) as PatientContextUpdate; } catch {}
      }
    }
    replyText = rawContent
      .replace(/<function=update_patient_context>[\s\S]*?<\/function>/g, "")
      .replace(/<function=update_patient_context\s*\{[\s\S]*?\}\s*>/g, "")
      .replace(/<function=[^>]*>/g, "")
      .trim();
  }

  appendToHistory(sessionId, "assistant", replyText);

  if (!context) context = extractContextHeuristic(message);

  const mergedContext: PatientContextUpdate = { ...currentContext, ...context };
  if (mergedContext) mergedContext.score = computeScore(mergedContext);

  const isFarewell = Boolean(
    mergedContext.slotBooked && mergedContext.patientName && mergedContext.rut,
  );

  return { reply: replyText, context: mergedContext, isFarewell };
}
