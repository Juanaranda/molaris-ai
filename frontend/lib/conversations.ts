import { getToken } from "./auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface ConversationContext {
  patientName: string | null;
  rut: string | null;
  email: string | null;
  serviceInterest: string | null;
  intent: string | null;
  urgency: string | null;
  score: number | null;
  slotBooked: boolean | null;
  notes: string | null;
}

export interface ConversationSummary {
  id: string;
  channel: string;
  status: string;
  leadScore: number | null;
  createdAt: string;
  updatedAt: string;
  context: ConversationContext | null;
  _count: { messages: number };
}

export interface ConversationMessage {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

export interface ConversationDetail {
  id: string;
  channel: string;
  status: string;
  leadScore: number | null;
  createdAt: string;
  updatedAt: string;
  context: ConversationContext | null;
  messages: ConversationMessage[];
}

export async function listConversations(limit = 50): Promise<ConversationSummary[]> {
  const token = getToken();
  const res = await fetch(`${API}/api/sessions?limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Error al cargar conversaciones");
  const data = await res.json();
  return data.sessions ?? [];
}

export async function getConversation(id: string): Promise<ConversationDetail> {
  const token = getToken();
  const res = await fetch(`${API}/api/sessions/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Error al cargar la conversación");
  const data = await res.json();
  return data.session;
}
