import { getToken } from "./auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type DentalSurface = "V" | "P" | "L" | "M" | "D" | "O" | "I";
export type DentalEventType = "DIAGNOSIS" | "TREATMENT" | "OBSERVATION";

export interface DentalEvent {
  id:             string;
  toothFDI:       string;
  eventType:      DentalEventType;
  conditionCode:  string;
  severity:       number | null;
  notes:          string | null;
  occurredAt:     string;
  createdAt:      string;
  sessionId:      string | null;
  professionalId: string;
  surfaces:       { surface: DentalSurface }[];
  professional:   { id: string; name: string; occupation: string | null };
}

export interface ToothProjection {
  toothFDI:    string;
  events:      DentalEvent[];
  activeConditions: {
    conditionCode:  string;
    eventId:        string;
    occurredAt:     string;
    surfaces:       DentalSurface[];
    severity:       number | null;
    professionalId: string;
  }[];
  isExtracted: boolean;
}

export interface OdontogramResponse {
  patientId: string;
  teeth:     Record<string, ToothProjection>;
}

export interface ConditionMeta {
  code: string;
  label: string;
  allowsSeverity: boolean;
  severityScale?: string;
  severityMin?: number;
  severityMax?: number;
  severityLabels?: Record<string, string>;
}

export interface CatalogResponse {
  conditions: ConditionMeta[];
  surfaces:   DentalSurface[];
}

/* ── API helpers ───────────────────────────────────────────────────────── */

export async function getCatalog(): Promise<CatalogResponse> {
  const res = await fetch(`${API}/api/dental/catalog`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Error cargando catálogo");
  return res.json();
}

export async function getOdontogram(patientId: string): Promise<OdontogramResponse> {
  const res = await fetch(`${API}/api/patients/${patientId}/odontogram`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Error cargando odontograma");
  return res.json();
}

export async function listDentalEvents(
  patientId: string,
  params: { toothFDI?: string; from?: string; to?: string; limit?: number } = {}
): Promise<DentalEvent[]> {
  const q = new URLSearchParams();
  if (params.toothFDI) q.set("toothFDI", params.toothFDI);
  if (params.from)     q.set("from", params.from);
  if (params.to)       q.set("to", params.to);
  if (params.limit)    q.set("limit", String(params.limit));
  const res = await fetch(`${API}/api/patients/${patientId}/dental-events?${q}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Error cargando historial");
  const data = await res.json();
  return data.events;
}

export async function createDentalEvent(
  patientId: string,
  body: {
    toothFDI:       string;
    eventType:      DentalEventType;
    conditionCode:  string;
    surfaces?:      DentalSurface[];
    severity?:      number;
    notes?:         string;
    sessionId?:     string;
    occurredAt?:    string;
  }
): Promise<DentalEvent> {
  const res = await fetch(`${API}/api/patients/${patientId}/dental-events`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body:    JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((json as { error?: string }).error ?? "Error creando evento");
  }
  return (json as { event: DentalEvent }).event;
}
