import { getToken } from "./auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface RecallRule {
  id:              string;
  triggerService:  string;
  intervalDays:    number;
  messageTemplate: string;
  active:          boolean;
  createdAt:       string;
  updatedAt:       string;
}

export interface RecallEvent {
  id:           string;
  patientName:  string | null;
  patientPhone: string;
  patientRut:   string | null;
  lastBookingAt: string;
  sentAt:       string;
  channel:      string;
  success:      boolean;
  errorMessage: string | null;
  rule:         { triggerService: string; intervalDays: number };
}

export async function listRecallRules(clinicId: string): Promise<RecallRule[]> {
  const res = await fetch(`${API}/api/clinics/${clinicId}/recall/rules`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Error cargando reglas");
  const data = await res.json();
  return data.rules;
}

export async function createRecallRule(
  clinicId: string,
  data: { triggerService: string; intervalDays: number; messageTemplate: string }
): Promise<RecallRule> {
  const res = await fetch(`${API}/api/clinics/${clinicId}/recall/rules`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? "Error");
  return (json as { rule: RecallRule }).rule;
}

export async function updateRecallRule(
  clinicId: string,
  ruleId: string,
  data: Partial<{ triggerService: string; intervalDays: number; messageTemplate: string; active: boolean }>
): Promise<RecallRule> {
  const res = await fetch(`${API}/api/clinics/${clinicId}/recall/rules/${ruleId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? "Error");
  return (json as { rule: RecallRule }).rule;
}

export async function deleteRecallRule(clinicId: string, ruleId: string): Promise<void> {
  const res = await fetch(`${API}/api/clinics/${clinicId}/recall/rules/${ruleId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Error");
  }
}

export async function listRecallEvents(clinicId: string, limit = 100): Promise<RecallEvent[]> {
  const res = await fetch(`${API}/api/clinics/${clinicId}/recall/events?limit=${limit}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Error cargando eventos");
  const data = await res.json();
  return data.events;
}

export async function triggerRecallCheck(clinicId: string): Promise<void> {
  const res = await fetch(`${API}/api/clinics/${clinicId}/recall/trigger`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok && res.status !== 202) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Error");
  }
}
