import prisma from "../../config/prisma";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface SessionData {
  messages: ChatMessage[];
  messageCount: number;
  lastActivityAt: number;
}

const cache = new Map<string, SessionData>();

const MAX_HISTORY  = 20;   // mensajes en contexto (ventana deslizante)
const MAX_MESSAGES = 30;   // límite total de mensajes por sesión
const SESSION_TTL  = 60 * 60 * 1000;

function now() { return Date.now(); }

// Cargar historial desde DB si no está en caché (restart recovery)
async function warmUp(sessionId: string): Promise<SessionData> {
  const dbMessages = await prisma.message.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    select: { role: true, content: true },
  });

  const messages = dbMessages
    .filter((m): m is { role: "user" | "assistant"; content: string } =>
      m.role === "user" || m.role === "assistant"
    )
    .slice(-MAX_HISTORY);

  const data: SessionData = {
    messages,
    messageCount: dbMessages.length,
    lastActivityAt: now(),
  };
  cache.set(sessionId, data);
  return data;
}

async function getOrLoad(sessionId: string): Promise<SessionData> {
  return cache.get(sessionId) ?? warmUp(sessionId);
}

export async function getHistory(sessionId: string): Promise<ChatMessage[]> {
  const s = await getOrLoad(sessionId);
  return s.messages;
}

export async function getMessageCount(sessionId: string): Promise<number> {
  const s = await getOrLoad(sessionId);
  return s.messageCount;
}

// appendToHistory is intentionally synchronous for callers that have already
// awaited getHistory/getMessageCount (which guarantees the session is cached).
// For callers that have NOT yet loaded the session (e.g. the topicGuard early-
// exit path in claudeService), they must call ensureCached first to avoid
// creating a blank entry that warmUp will later overwrite.
export async function ensureCached(sessionId: string): Promise<void> {
  await getOrLoad(sessionId);
}

export function appendToHistory(sessionId: string, role: "user" | "assistant", content: string) {
  let s = cache.get(sessionId);
  if (!s) {
    // Session not yet warm — create a minimal entry. This path should only be
    // reached after ensureCached() has been called; if it isn't, the next
    // getHistory call will call warmUp and restore DB data (messages already
    // persisted to DB won't be lost — only this in-memory message is at risk
    // of being orphaned until warmUp re-reads DB).
    s = { messages: [], messageCount: 0, lastActivityAt: now() };
    cache.set(sessionId, s);
  }
  s.messages.push({ role, content });
  s.messageCount++;
  s.lastActivityAt = now();

  if (s.messages.length > MAX_HISTORY) {
    s.messages.splice(0, s.messages.length - MAX_HISTORY);
  }
}

export function clearSession(sessionId: string) {
  cache.delete(sessionId);
}

export { MAX_MESSAGES };

// GC: limpiar entradas inactivas del caché (los datos siguen en DB)
setInterval(() => {
  const cutoff = now() - SESSION_TTL;
  for (const [id, s] of cache.entries()) {
    if (s.lastActivityAt < cutoff) cache.delete(id);
  }
}, 30 * 60 * 1000);
