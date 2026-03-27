export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface SessionData {
  messages: ChatMessage[];
  messageCount: number;   // total acumulado (no se resetea al truncar)
  createdAt: number;      // timestamp ms
  lastActivityAt: number;
}

const sessions = new Map<string, SessionData>();

const MAX_HISTORY   = 20;   // mensajes en memoria para contexto
const MAX_MESSAGES  = 30;   // límite total de mensajes por sesión
const SESSION_TTL   = 60 * 60 * 1000; // 1 hora de inactividad → sesión expirada

function getOrCreate(sessionId: string): SessionData {
  const now = Date.now();
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, { messages: [], messageCount: 0, createdAt: now, lastActivityAt: now });
  }
  return sessions.get(sessionId)!;
}

export function getHistory(sessionId: string): ChatMessage[] {
  return sessions.get(sessionId)?.messages ?? [];
}

export function getMessageCount(sessionId: string): number {
  return sessions.get(sessionId)?.messageCount ?? 0;
}

export function isSessionExpired(sessionId: string): boolean {
  const s = sessions.get(sessionId);
  if (!s) return false;
  return Date.now() - s.lastActivityAt > SESSION_TTL;
}

export function appendToHistory(sessionId: string, role: "user" | "assistant", content: string) {
  const s = getOrCreate(sessionId);
  s.messages.push({ role, content });
  s.messageCount++;
  s.lastActivityAt = Date.now();

  // Mantener solo los últimos MAX_HISTORY para no inflar el contexto
  if (s.messages.length > MAX_HISTORY) {
    s.messages.splice(0, s.messages.length - MAX_HISTORY);
  }
}

export function clearSession(sessionId: string) {
  sessions.delete(sessionId);
}

export { MAX_MESSAGES };

// Limpiar sesiones expiradas cada 30 min
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions.entries()) {
    if (now - s.lastActivityAt > SESSION_TTL) sessions.delete(id);
  }
}, 30 * 60 * 1000);
