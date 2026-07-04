import { config } from "../../config/env";

const GROQ_BASE = "https://api.groq.com/openai/v1/chat/completions";

interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GroqDirectResult {
  content: string;
  tokensIn: number;
  tokensOut: number;
  model: string;
  latencyMs: number;
}

export function isGroqConfigured(): boolean {
  return Boolean(config.groq.apiKey);
}

/**
 * Fallback fuera de OpenRouter. Usa el endpoint directo de Groq con un modelo
 * Llama gratis. No soporta function-calling: el caller debe tolerar respuesta
 * solo de texto y aplicar heurísticas propias de extracción de contexto.
 */
export async function callGroqDirect(messages: GroqMessage[]): Promise<GroqDirectResult> {
  if (!config.groq.apiKey) throw new Error("GROQ_API_KEY no configurada");

  const model = config.groq.model;
  const t0 = Date.now();
  const res = await fetch(GROQ_BASE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.groq.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages, max_tokens: 600 }),
  });
  const latencyMs = Date.now() - t0;

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw Object.assign(new Error(`Groq ${res.status}`), { status: res.status, body });
  }

  const data: any = await res.json();
  return {
    content: data.choices?.[0]?.message?.content ?? "",
    tokensIn: data.usage?.prompt_tokens ?? 0,
    tokensOut: data.usage?.completion_tokens ?? 0,
    model,
    latencyMs,
  };
}
