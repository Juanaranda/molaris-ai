export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const sessions = new Map<string, ChatMessage[]>();

const MAX_MESSAGES = 20;

export function getHistory(sessionId: string): ChatMessage[] {
  return sessions.get(sessionId) ?? [];
}

export function appendToHistory(sessionId: string, role: "user" | "assistant", content: string) {
  const history = sessions.get(sessionId) ?? [];
  history.push({ role, content });

  if (history.length > MAX_MESSAGES) {
    history.splice(0, history.length - MAX_MESSAGES);
  }

  sessions.set(sessionId, history);
}

export function clearSession(sessionId: string) {
  sessions.delete(sessionId);
}
