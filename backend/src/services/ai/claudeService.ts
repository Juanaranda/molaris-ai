import { config } from "../../config/env";
import { buildSystemPrompt } from "./promptBuilder";
import { buildContextHint } from "./contextInjector";
import { getHistory, appendToHistory, getMessageCount, MAX_MESSAGES } from "./sessionStore";
import { checkTopic, isOutOfDomain, OFF_TOPIC_REPLY, JAILBREAK_REPLY, TOO_LONG_REPLY } from "./topicGuard";
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
  usage?: { model: string; tier: string; tokensIn: number; tokensOut: number; costUsd: number; latencyMs: number };
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

// ── Precios por modelo (USD / 1M tokens) ──────────────────────────────────
const MODEL_PRICING: Record<string, { in: number; out: number }> = {
  "meta-llama/llama-3.1-8b-instruct:free": { in: 0,    out: 0    },
  "meta-llama/llama-3.3-70b-instruct":     { in: 0.59, out: 0.79 },
  "google/gemini-2.5-flash":               { in: 0.15, out: 0.60 },
  "google/gemini-2.5-flash-preview":       { in: 0.15, out: 0.60 },
  "anthropic/claude-haiku-4-5":            { in: 0.80, out: 4.00 },
  "anthropic/claude-haiku-4-5-20251001":   { in: 0.80, out: 4.00 },
};

function calcCost(model: string, tokensIn: number, tokensOut: number): number {
  const p = MODEL_PRICING[model] ?? { in: 1, out: 3 }; // fallback conservador
  return (tokensIn / 1_000_000) * p.in + (tokensOut / 1_000_000) * p.out;
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
    body: JSON.stringify({ model, messages, tools: TOOLS, tool_choice: "auto", max_tokens: 600, usage: { include: true } }),
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
  const lines = ["## ESTADO DE LA CONVERSACIÓN"];

  if (ctx.patientName) lines.push(`- Nombre ya dado: ${ctx.patientName} (NO lo vuelvas a pedir)`);
  if (ctx.rut)         lines.push(`- RUT ya dado: ${ctx.rut} (NO lo vuelvas a pedir)`);
  if (ctx.email)       lines.push(`- Email ya dado: ${ctx.email} (NO lo vuelvas a pedir)`);

  if (ctx.intent === "ready_to_book" && !ctx.slotBooked) {
    lines.push("\nEl paciente quiere agendar. El link de reserva se adjuntará automáticamente. Di algo natural del tipo 'Aquí puedes elegir tu hora:' y NO solicites RUT ni datos por el chat.");
    if (ctx.patientName || ctx.rut) {
      lines.push("Menciona que sus datos ya estarán precargados en el formulario.");
    }
  }

  // Flujo legacy (widget embebido): slotBooked viene del frontend
  if (ctx.slotBooked) {
    lines.push("\n- Hora: ya seleccionada vía widget — NO preguntes fecha/hora de nuevo");
    const missing: string[] = [];
    if (!ctx.patientName) missing.push("nombre completo");
    if (!ctx.rut)         missing.push("RUT (formato XX.XXX.XXX-X)");
    if (missing.length > 0) {
      lines.push(`Falta para confirmar: ${missing.join(" y ")}. Pídelo de forma natural.`);
    } else {
      lines.push("Todos los datos están completos. Despídete con mensaje cálido.");
    }
  }

  return lines.join("\n");
}

// ── Guardia post-LLM: elimina doctores alucinados ─────────────────────────
//
// El LLM a veces ignora el system prompt e inventa nombres de doctores.
// Esta función escanea la respuesta y reemplaza cualquier "Dr./Dra. X" que
// NO esté en la lista oficial de la clínica por "nuestro equipo".
//
function sanitizeDoctorMentions(text: string, validDoctors: string[]): string {
  // Extraer apellidos de la lista válida para comparación flexible
  const validLastNames = new Set(
    validDoctors.flatMap((name) => name.split(" ").slice(1).map((w) => w.toLowerCase()))
  );

  return text.replace(/\b(Dr\.?|Dra\.?)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)/g, (match, title, rest) => {
    const fullName = `${title} ${rest}`;
    // ¿Está en la lista exacta?
    if (validDoctors.some((d) => d.toLowerCase() === fullName.toLowerCase())) return match;
    // ¿Al menos el apellido coincide?
    const words = rest.split(" ").map((w: string) => w.toLowerCase());
    if (words.some((w: string) => validLastNames.has(w))) return match;
    // Doctor inventado → reemplazar
    console.warn(`[AI] Doctor alucinado detectado y eliminado: "${fullName}"`);
    return "nuestro equipo";
  });
}

// ── Función principal ──────────────────────────────────────────────────────

export async function getAIResponse({
  message,
  clinic,
  sessionId,
  currentContext = {},
}: AIRequestParams): Promise<AIResponse> {

  // Capa 1: rate limit por sesión (async — puede recuperar desde DB)
  if ((await getMessageCount(sessionId)) >= MAX_MESSAGES) {
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
    const reply =
      guard.reason === "too_long"  ? TOO_LONG_REPLY  :
      guard.reason === "jailbreak" ? JAILBREAK_REPLY :
      OFF_TOPIC_REPLY;
    appendToHistory(sessionId, "assistant", reply);
    return { reply, context: null, isFarewell: false };
  }

  const systemPrompt = buildSystemPrompt(clinic);
  const contextHint  = buildContextHint(message, clinic.config);
  const stateHint    = buildStateHint(currentContext);
  appendToHistory(sessionId, "user", message);
  const history = await getHistory(sessionId);

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
  let usedModel = model;
  let tokensIn = 0, tokensOut = 0, latencyMs = 0;

  for (const m of fallbackChain) {
    try {
      const t0 = Date.now();
      const data = await callOpenRouter(m, messages);
      latencyMs = Date.now() - t0;
      orMsg = data.choices?.[0]?.message;
      tokensIn  = data.usage?.prompt_tokens     ?? 0;
      tokensOut = data.usage?.completion_tokens ?? 0;
      usedModel = m;
      if (m !== model) console.warn(`[AI] Usando fallback: ${m}`);
      break;
    } catch (err: any) {
      const retryable = err?.status === 429 || err?.status === 404 || (err?.status ?? 0) >= 500;
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

  // Guardia post-LLM: eliminar doctores alucinados
  const cfg = clinic.config as unknown as { doctors?: Array<{ name: string }> };
  const validDoctors = cfg.doctors?.map((d) => d.name) ?? [];
  replyText = sanitizeDoctorMentions(replyText, validDoctors);

  // Eliminar markdown del reply (asteriscos, negritas, etc.)
  replyText = replyText
    .replace(/\*\*([^*]+)\*\*/g, "$1")   // **bold** → bold
    .replace(/\*([^*]+)\*/g, "$1")        // *italic* → italic
    .replace(/_{1,2}([^_]+)_{1,2}/g, "$1") // _italic_ / __bold__
    .replace(/^#{1,6}\s+/gm, "")          // # headers
    .replace(/`([^`]+)`/g, "$1")          // `code`
    .trim();

  if (!context) context = extractContextHeuristic(message);

  const mergedContext: PatientContextUpdate = { ...currentContext, ...context };
  if (mergedContext) mergedContext.score = computeScore(mergedContext);

  const isFarewell = Boolean(
    mergedContext.slotBooked && mergedContext.patientName && mergedContext.rut,
  );

  // Si el flujo está completo, usar despedida determinista (no depender del LLM)
  if (isFarewell && !replyText) {
    replyText = `¡Perfecto ${mergedContext.patientName?.split(" ")[0]}! Tu cita está confirmada. Te contactaremos para recordarte. ¡Hasta pronto! 🦷`;
  }

  // Si el modelo retornó solo tool_call sin texto, pedir respuesta conversacional
  if (!replyText && context) {
    console.warn("[AI] Modelo retornó solo tool_call sin texto — pidiendo respuesta conversacional");
    try {
      const followUp = await callOpenRouter(model, [
        ...messages,
        { role: "system", content: "Responde con UN mensaje conversacional corto (máximo 2 oraciones). NO uses markdown. NO uses tools." },
      ]);
      replyText = ((followUp.choices?.[0]?.message?.content as string) ?? "").trim();
    } catch {
      replyText = "Entendido. ¿En qué más te puedo ayudar?";
    }
  }

  if (!replyText) replyText = "Entendido. ¿En qué más te puedo ayudar?";

  // Capa post-LLM: si la respuesta se salió del dominio, reemplazar
  if (isOutOfDomain(replyText)) {
    console.warn("[AI] Respuesta out-of-domain detectada — aplicando fallback");
    replyText = OFF_TOPIC_REPLY;
  }

  appendToHistory(sessionId, "assistant", replyText);

  return {
    reply: replyText,
    context: mergedContext,
    isFarewell,
    usage: { model: usedModel, tier, tokensIn, tokensOut, costUsd: calcCost(usedModel, tokensIn, tokensOut), latencyMs },
  };
}
