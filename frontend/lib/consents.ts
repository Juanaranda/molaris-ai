import { getToken } from "./auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type SignatureMethod = "zapsign" | "manual_upload" | "in_person_pad";
export type SignatureStatus = "pending" | "signed" | "rejected" | "expired" | "cancelled";

export interface ConsentTemplate {
  id:            string;
  title:         string;
  body:          string;
  procedureCode: string | null;
  version:       number;
  active:        boolean;
}

export interface ConsentSignature {
  id:                string;
  templateId:        string;
  templateVersion:   number;
  patientName:       string;
  patientRut:        string | null;
  signatureMethod:   SignatureMethod;
  externalRef:       string | null;
  signedAt:          string | null;
  signedDocumentUrl: string | null;
  requestedAt:       string;
  status:            SignatureStatus;
  notes:             string | null;
  template:          { title: string; procedureCode: string | null };
  requestedBy:       { id: string; name: string };
}

export async function listConsentTemplates(clinicId: string): Promise<ConsentTemplate[]> {
  const res = await fetch(`${API}/api/clinics/${clinicId}/consent-templates`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Error cargando templates");
  const data = await res.json();
  return data.templates;
}

export async function listConsentSignatures(patientId: string): Promise<ConsentSignature[]> {
  const res = await fetch(`${API}/api/patients/${patientId}/consent-signatures`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Error cargando firmas");
  const data = await res.json();
  return data.signatures;
}

export async function requestSignature(
  patientId: string,
  body: { templateId: string; signatureMethod: SignatureMethod; notes?: string; signerEmail?: string; signerPhone?: string }
): Promise<{ signature: ConsentSignature; signUrl: string | null }> {
  const res = await fetch(`${API}/api/patients/${patientId}/consent-signatures`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body:    JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? "Error");
  return json as { signature: ConsentSignature; signUrl: string | null };
}

export async function updateSignature(
  signatureId: string,
  body: { signedDocumentUrl?: string; signedAt?: string; status?: SignatureStatus; notes?: string }
): Promise<ConsentSignature> {
  const res = await fetch(`${API}/api/consent-signatures/${signatureId}`, {
    method:  "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body:    JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? "Error");
  return (json as { signature: ConsentSignature }).signature;
}

export async function renderConsent(patientId: string, templateId: string): Promise<{ title: string; body: string }> {
  const res = await fetch(`${API}/api/patients/${patientId}/consent-render`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body:    JSON.stringify({ templateId }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? "Error");
  return json as { title: string; body: string };
}
