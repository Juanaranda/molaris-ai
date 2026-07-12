import { getToken } from "./auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type AnamnesisQuestionType = "boolean" | "text" | "number" | "multiselect";
export type AnamnesisSection = "medical" | "allergies" | "medications" | "lifestyle" | "dental";

export interface AnamnesisQuestion {
  code:     string;
  label:    string;
  type:     AnamnesisQuestionType;
  section:  AnamnesisSection;
  redFlag?: boolean;
  options?: string[];
}

export interface AnamnesisTemplate {
  id:        string;
  version:   number;
  questions: AnamnesisQuestion[];
  active:    boolean;
  createdAt: string;
}

export interface AnamnesisResponse {
  id:              string;
  templateVersion: number;
  answers:         Record<string, unknown>;
  redFlags:        string[];
  completedAt:     string;
  recordedBy:      { id: string; name: string; occupation: string | null };
  template?:       { version: number; questions: AnamnesisQuestion[] };
}

export async function getActiveTemplate(clinicId: string): Promise<AnamnesisTemplate> {
  const res = await fetch(`${API}/api/clinics/${clinicId}/anamnesis/template`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Error cargando template");
  const data = await res.json();
  return data.template;
}

export async function listAnamnesisResponses(patientId: string): Promise<AnamnesisResponse[]> {
  const res = await fetch(`${API}/api/patients/${patientId}/anamnesis-responses`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Error cargando respuestas");
  const data = await res.json();
  return data.responses;
}

export async function submitAnamnesisResponse(
  patientId: string,
  answers: Record<string, unknown>,
): Promise<AnamnesisResponse> {
  const res = await fetch(`${API}/api/patients/${patientId}/anamnesis-responses`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body:    JSON.stringify({ answers }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? "Error");
  return (json as { response: AnamnesisResponse }).response;
}

export const SECTION_LABELS: Record<AnamnesisSection, string> = {
  medical:     "Antecedentes médicos",
  allergies:   "Alergias",
  medications: "Medicamentos",
  lifestyle:   "Hábitos",
  dental:      "Antecedentes odontológicos",
};
