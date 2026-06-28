import { config } from "../../config/env";
import { buildSystemPrompt } from "./promptBuilder";
import { buildContextHint } from "./contextInjector";
import { getHistory, appendToHistory, ensureCached, getMessageCount, MAX_MESSAGES } from "./sessionStore";
import { checkTopic, isOutOfDomain, OFF_TOPIC_REPLY, JAILBREAK_REPLY, TOO_LONG_REPLY } from "./topicGuard";
import { computeScore } from "./leadScoring";
import { callGroqDirect, isGroqConfigured } from "./groqDirectService";
import { triggerAlert } from "../alerts/alertService";
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
  availabilityHint?: string;
  overrideSystemPrompt?: string;
}

export interface BookingAction {
  doctor: string;
  date: string;
  time: string;
  patientName: string;
  patientRut: string;
  service?: string;
}

export interface AIResponse {
  reply: string;
  context: PatientContextUpdate | null;
  isFarewell: boolean;
  bookingAction?: BookingAction;
  usage?: { model: string; tier: string; tokensIn: number; tokensOut: number; costUsd: number; latencyMs: number };
  /** true = todos los proveedores LLM fallaron y se devolvió respuesta estática (#50) */
  failed?: boolean;
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
    Boolean(ctx.slotBooked) ||
    ctx.intent === "booking_via_chat" ||
    USER_GAVE_TIME_RE.test(lower); // usuario da día/hora → recoger datos críticos

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
          intent:          { type: "string", enum: ["ready_to_book", "booking_via_chat", "evaluating", "just_browsing"] },
          score:           { type: "number" },
          notes:           { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_booking",
      description:
        "Crea una cita confirmada cuando el paciente eligió agendar por el chat y ya tienes TODOS los datos: doctor, fecha (YYYY-MM-DD), hora (HH:MM), nombre completo y RUT del paciente. NO llames esta función si falta algún dato.",
      parameters: {
        type: "object",
        required: ["doctor", "date", "time", "patientName", "patientRut"],
        properties: {
          doctor:      { type: "string", description: "Nombre exacto del doctor, tal como aparece en la lista del equipo médico" },
          date:        { type: "string", description: "Fecha en formato YYYY-MM-DD" },
          time:        { type: "string", description: "Hora en formato HH:MM (ej: 10:30)" },
          patientName: { type: "string", description: "Nombre completo del paciente" },
          patientRut:  { type: "string", description: "RUT del paciente sin puntos ni guión" },
          service:     { type: "string", description: "Tipo de consulta (opcional)" },
        },
      },
    },
  },
];

// Modelos que soportan function calling vía OpenRouter
const TOOLS_SUPPORTED = ["meta-llama", "anthropic", "openai", "mistral", "cohere"];

function supportsTools(model: string): boolean {
  return TOOLS_SUPPORTED.some((prefix) => model.startsWith(prefix));
}

async function callOpenRouter(model: string, messages: ORMessage[]) {
  const withTools = supportsTools(model);
  const body: Record<string, unknown> = {
    model,
    messages,
    max_tokens: 600,
    usage: { include: true },
  };
  if (withTools) {
    body.tools = TOOLS;
    body.tool_choice = "auto";
  }

  const res = await fetch(OPENROUTER_BASE, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.openRouter.apiKey}`,
      "Content-Type":  "application/json",
      "HTTP-Referer":  "https://molari.ai",
      "X-Title":       "Molaris AI",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => res.statusText);
    throw Object.assign(new Error(`OpenRouter ${res.status}`), { status: res.status, body: errBody });
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

// Matches a concrete HH:MM time, a day-of-week name, or a scheduling-intent
// temporal word. "mañana" and "pasado" are only matched when they are NOT
// preceded by "de la" (which would make them mean "morning/afternoon", not
// "tomorrow/the day after"). This prevents "9 de la mañana" from triggering
// the chat-booking flow incorrectly.
const USER_GAVE_TIME_RE =
  /\b\d{1,2}:\d{2}\b|\b(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|pr[oó]ximo)|(?<!de\s+la\s+)\b(ma[nñ]ana|pasado\s+ma[nñ]ana)/i;

function buildStateHint(ctx: Partial<PatientContextUpdate>, currentMessage?: string): string {
  const lines = ["## ESTADO DE LA CONVERSACIÓN"];

  if (ctx.patientName) lines.push(`- Nombre: ${ctx.patientName} (NO volver a pedir)`);
  if (ctx.rut)         lines.push(`- RUT: ${ctx.rut} (NO volver a pedir)`);
  if (ctx.email)       lines.push(`- Email: ${ctx.email} (NO volver a pedir)`);

  // Flujo por chat: usuario ya indicó hora/día, o intención es booking_via_chat
  const userGaveTimeNow = currentMessage ? USER_GAVE_TIME_RE.test(currentMessage) : false;
  const isChatBooking   = ctx.intent === "booking_via_chat" || userGaveTimeNow;

  if (isChatBooking) {
    const missing: string[] = [];
    if (!ctx.patientName) missing.push("nombre completo");
    if (!ctx.rut)         missing.push("RUT (formato XX.XXX.XXX-X)");

    if (missing.length > 0) {
      lines.push(`\nFLUJO CHAT ACTIVO: El paciente está agendando por el chat. El ÚNICO dato que debes pedir AHORA es: "${missing[0]}". Pide solo ese dato. NO mandes link. NO muestres picker.`);
    } else {
      lines.push(`\nFLUJO CHAT ACTIVO: Tienes doctor + fecha + hora + nombre + RUT. Llama create_booking inmediatamente.`);
    }
    return lines.join("\n");
  }

  // Flujo picker/link: usuario quiere agendar pero no ha dado fecha/hora por chat
  if (ctx.intent === "ready_to_book" && !ctx.slotBooked) {
    lines.push("\nEl paciente quiere agendar. El selector de horario aparecerá automáticamente. Responde con UNA frase corta y natural (ej: '¡Claro! Aquí puedes elegir el horario que mejor te quede:' o 'Perfecto, elige el día y hora que prefieras:'). NO pidas datos personales.");
  }

  // Flujo legacy (widget embebido): slotBooked viene del frontend
  if (ctx.slotBooked) {
    lines.push("\n- Slot ya seleccionado — NO preguntes fecha/hora");
    const missing: string[] = [];
    if (!ctx.patientName) missing.push("nombre completo");
    if (!ctx.rut)         missing.push("RUT (formato XX.XXX.XXX-X)");
    if (missing.length > 0) {
      lines.push(`Falta para confirmar: ${missing.join(" y ")}. Pídelo de forma natural.`);
    } else {
      lines.push("Todos los datos completos. Despídete con calidez.");
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
  availabilityHint,
  overrideSystemPrompt,
}: AIRequestParams): Promise<AIResponse> {

  // Capa 1: rate limit por sesión (async — puede recuperar desde DB)
  if ((await getMessageCount(sessionId)) >= MAX_MESSAGES) {
    return {
      reply: "Has alcanzado el límite de mensajes de esta sesión. Para continuar, contáctanos directamente o inicia una nueva conversación.",
      context: null,
      isFarewell: false,
    };
  }

  // Capa 2: pre-filtro de tópico (sin costo de LLM) — Juan en modo demo lo salta
  // Ensure the session is warm in the cache BEFORE any appendToHistory call so
  // that a synchronous write on a post-restart cold session does not create a
  // blank entry that warmUp would later overwrite (losing the appended message).
  await ensureCached(sessionId);
  const guard = overrideSystemPrompt ? { allowed: true as const } : checkTopic(message);
  if (!guard.allowed) {
    appendToHistory(sessionId, "user", message);
    const reply =
      guard.reason === "too_long"  ? TOO_LONG_REPLY  :
      guard.reason === "jailbreak" ? JAILBREAK_REPLY :
      OFF_TOPIC_REPLY;
    appendToHistory(sessionId, "assistant", reply);
    return { reply, context: null, isFarewell: false };
  }

  const systemPrompt = overrideSystemPrompt ?? buildSystemPrompt(clinic);
  const contextHint  = overrideSystemPrompt ? undefined : buildContextHint(message, clinic.config);
  const stateHint    = buildStateHint(currentContext, message);
  appendToHistory(sessionId, "user", message);
  const history = await getHistory(sessionId);

  // Capa 3: orquestación por tier de complejidad
  const tier  = classifyTier(message, currentContext, history.length);
  const model = config.openRouter.models[tier];
  console.log(`[AI] tier=${tier} model=${model}`);

  // Cadena de fallback siempre con al menos 3 opciones: primario → balanced → reserve
  // De esta forma cualquier fallo (400, 429, 5xx) siempre tiene siguiente
  const seen = new Set<string>();
  const fallbackChain: string[] = [];
  for (const m of [model, config.openRouter.models.balanced, config.openRouter.models.smart, config.openRouter.models.reserve]) {
    if (m && !seen.has(m)) { fallbackChain.push(m); seen.add(m); }
  }

  const messages: ORMessage[] = [
    { role: "system", content: systemPrompt },
    ...(contextHint ? [{ role: "system" as const, content: contextHint }] : []),
    { role: "system", content: stateHint },
    ...(availabilityHint ? [{ role: "system" as const, content: availabilityHint }] : []),
    ...history,
  ];

  let orMsg: any;
  let usedModel = model;
  let tokensIn = 0, tokensOut = 0, latencyMs = 0;
  let creditExhausted = false;

  for (const m of fallbackChain) {
    try {
      const t0 = Date.now();
      const data = await callOpenRouter(m, messages);
      latencyMs = Date.now() - t0;
      orMsg = data.choices?.[0]?.message;
      tokensIn  = data.usage?.prompt_tokens     ?? 0;
      tokensOut = data.usage?.completion_tokens ?? 0;
      usedModel = m;
      if (m !== model) {
        console.warn(`[AI] Usando fallback: ${m}`);
        triggerAlert({
          kind: "ai_fallback_used",
          severity: "info",
          message: `Modelo primario (${model}) falló — usando fallback ${m}`,
          detail: { clinic: clinic.slug, tier },
        }).catch(() => {});
      }
      break;
    } catch (err: any) {
      const status = err?.status ?? 0;
      const bodyStr = String(err?.body ?? err?.message ?? "").toLowerCase();
      // 401/402/403 + texto de "credit"/"insufficient" → cuenta OpenRouter sin saldo o key inválida.
      // No tiene sentido reintentar otros modelos del MISMO proveedor — cortar y saltar a Groq.
      const looksLikeCredits =
        status === 402 ||
        ((status === 401 || status === 403) && /credit|insufficient|balance|quota/.test(bodyStr));
      if (looksLikeCredits) {
        creditExhausted = true;
        console.error(`[AI] OpenRouter ${status} — créditos agotados o key inválida. Abortando cadena OpenRouter.`);
        triggerAlert({
          kind: "ai_credits_exhausted",
          severity: "critical",
          message: `OpenRouter retornó ${status}. Revisa saldo/API key en openrouter.ai/account.`,
          detail: { clinic: clinic.slug, model: m, body: bodyStr.slice(0, 200) },
        }).catch(() => {});
        break;
      }
      const retryable = status === 429 || status === 404 || status >= 400;
      console.warn(`[AI] ${m} falló (${status}): ${err?.body ?? err?.message} — ${retryable ? "reintentando" : "propagando"}`);
      if (!retryable) throw err;
    }
  }

  // Último recurso: Groq directo (proveedor independiente de OpenRouter)
  if (!orMsg && isGroqConfigured()) {
    try {
      console.warn("[AI] Cadena OpenRouter agotada — intentando Groq directo");
      const groqResult = await callGroqDirect(messages);
      orMsg = { content: groqResult.content, tool_calls: [] };
      tokensIn  = groqResult.tokensIn;
      tokensOut = groqResult.tokensOut;
      latencyMs = groqResult.latencyMs;
      usedModel = `groq:${groqResult.model}`;
      triggerAlert({
        kind: "ai_provider_degraded",
        severity: "warn",
        message: "OpenRouter caído — sirviendo con Groq directo (sin function calling)",
        detail: { clinic: clinic.slug, creditExhausted },
      }).catch(() => {});
    } catch (err: any) {
      console.error("[AI] Groq directo también falló:", err?.body ?? err?.message);
    }
  }

  if (!orMsg) {
    console.error("[AI] Todos los modelos fallaron. Usando respuesta estática.");
    triggerAlert({
      kind: "ai_all_providers_down",
      severity: "critical",
      message: "Todos los proveedores LLM están caídos — el chat responde solo con mensaje estático.",
      detail: { clinic: clinic.slug, creditExhausted, hasGroq: isGroqConfigured() },
    }).catch(() => {});
    return { reply: STATIC_FALLBACK, context: null, isFarewell: false, failed: true };
  }

  const rawContent = orMsg.content ?? "";

  // Extraer tool calls — puede haber múltiples (update_patient_context + create_booking)
  let context: PatientContextUpdate | null = null;
  let bookingAction: BookingAction | undefined;

  for (const tc of orMsg.tool_calls ?? []) {
    if (!tc?.function?.arguments) continue;
    try {
      const args = JSON.parse(tc.function.arguments);
      if (tc.function.name === "update_patient_context") {
        context = args as PatientContextUpdate;
      } else if (tc.function.name === "create_booking") {
        bookingAction = args as BookingAction;
      }
    } catch {}
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

  // Si el modelo retornó sin texto (solo tool_call o respuesta vacía), generar confirmación
  if (!replyText) {
    // Si había una acción de booking, el caller (webhook/chat) construye la confirmación
    // Para el widget (que no usa bookingAction), generar mensaje apropiado según contexto
    if (bookingAction) {
      replyText = ""; // el caller construye la confirmación con los datos reales
    } else {
      console.warn("[AI] Respuesta vacía del modelo — pidiendo follow-up conversacional");
      try {
        const followUp = await callOpenRouter(config.openRouter.models.smart, [
          ...messages,
          { role: "system", content: "Responde con UN mensaje conversacional corto (máximo 2 oraciones). NO uses markdown. NO uses tools. NO llames ninguna función." },
        ]);
        replyText = ((followUp.choices?.[0]?.message?.content as string) ?? "").trim();
      } catch {
        replyText = "Entendido, ya tengo tus datos. ¿Hay algo más en que te pueda ayudar?";
      }
    }
  }

  if (!replyText && !bookingAction) replyText = "Entendido, ya tengo tus datos. ¿Hay algo más en que te pueda ayudar?";

  // Capa post-LLM: si la respuesta se salió del dominio, reemplazar (Juan lo salta — habla de molari.ai)
  if (!overrideSystemPrompt && isOutOfDomain(replyText)) {
    console.warn("[AI] Respuesta out-of-domain detectada — aplicando fallback");
    replyText = OFF_TOPIC_REPLY;
  }

  appendToHistory(sessionId, "assistant", replyText);

  return {
    reply: replyText,
    context: mergedContext,
    isFarewell,
    bookingAction,
    usage: { model: usedModel, tier, tokensIn, tokensOut, costUsd: calcCost(usedModel, tokensIn, tokensOut), latencyMs },
  };
}
