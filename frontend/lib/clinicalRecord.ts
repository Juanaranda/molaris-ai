import { getToken } from "./auth";
import type { ToothProjection } from "./odontogram";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface IdentityFull {
  id: string;
  rut: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  birthDate: string | null;
  gender: string | null;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
  guardianIdentityId: string | null;
  guardian: { id: string; firstName: string; lastName: string; rut: string; phone: string | null } | null;
}

export interface PatientUserInfo {
  id: string;
  enrolledAt: string;
  lastVisit: string | null;
  insuranceProvider: string | null;
  insuranceTier: string | null;
  insuranceCompany: string | null;
  marketingImagesConsent: boolean;
}

export interface ClinicalNote {
  id: string;
  reason: string | null;
  reasonCategory: string | null;
  findings: string | null;
  procedures: string | null;
  prescriptions: string | null;
  nextVisitPlan: string | null;
  occurredAt: string;
  createdAt: string;
  sessionId: string | null;
  professional: { id: string; name: string; occupation: string | null };
}

export interface ToothImageSummary {
  id: string;
  toothFDI: string | null;
  imageType: string;
  url: string;
  takenAt: string;
}

export interface ClinicalRecord {
  patient: {
    id: string;
    name: string | null;
    phone: string | null;
    email: string | null;
    channel: string | null;
    createdAt: string;
  };
  identity: IdentityFull | null;
  patientUser: PatientUserInfo | null;
  odontogram: Record<string, ToothProjection>;
  clinicalNotes: ClinicalNote[];
  images: ToothImageSummary[];
  alerts: string[];
}

export async function ensurePatientId(
  clinicId: string,
  params: { rut?: string; phone?: string }
): Promise<string> {
  const q = new URLSearchParams();
  if (params.rut)   q.set("rut",   params.rut);
  if (params.phone) q.set("phone", params.phone);
  const res = await fetch(`${API}/api/clinics/${clinicId}/patients/ensure?${q}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? "Paciente no encontrado");
  return (json as { patientId: string }).patientId;
}

export async function getClinicalRecord(patientId: string): Promise<ClinicalRecord> {
  const res = await fetch(`${API}/api/patients/${patientId}/clinical-record`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Error cargando ficha");
  }
  return res.json();
}

export async function createClinicalNote(
  patientId: string,
  data: {
    reason?: string;
    reasonCategory?: "urgencia" | "dolor" | "control" | "estetica" | "derivacion" | "otro";
    findings?: string;
    procedures?: string;
    prescriptions?: string;
    nextVisitPlan?: string;
    sessionId?: string;
    occurredAt?: string;
  }
): Promise<ClinicalNote> {
  const res = await fetch(`${API}/api/patients/${patientId}/clinical-notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? "Error creando nota");
  return (json as { note: ClinicalNote }).note;
}

export async function updateIdentity(
  patientId: string,
  data: Partial<Omit<IdentityFull, "id" | "rut" | "guardianIdentityId" | "guardian">>
): Promise<IdentityFull> {
  const res = await fetch(`${API}/api/patients/${patientId}/identity`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? "Error actualizando datos");
  return (json as { identity: IdentityFull }).identity;
}

export async function updateInsurance(
  patientId: string,
  data: {
    insuranceProvider?: "fonasa" | "isapre" | "particular" | "otro" | null;
    insuranceTier?: string | null;
    insuranceCompany?: string | null;
    marketingImagesConsent?: boolean;
  }
): Promise<PatientUserInfo> {
  const res = await fetch(`${API}/api/patients/${patientId}/insurance`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? "Error");
  return (json as { patientUser: PatientUserInfo }).patientUser;
}

/* ─── Cuenta corriente del paciente (Issue #43) ──────────────────────────── */

export interface AccountEntry {
  id: string;
  date: string;
  kind: "charge" | "payment" | "adjustment";
  amount: number;
  description: string;
  source: "booking" | "manual";
  method?: string | null;
}

export interface PatientAccount {
  rut: string;
  saldo: number;
  totalCharged: number;
  totalPaid: number;
  entries: AccountEntry[];
}

export async function getPatientAccount(rut: string): Promise<PatientAccount> {
  const res = await fetch(`${API}/api/patients/${encodeURIComponent(rut)}/account`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? "Error cargando cuenta");
  return json as PatientAccount;
}

export async function registerPatientPayment(
  rut: string,
  data: { amount: number; method?: string; description?: string }
): Promise<void> {
  const res = await fetch(`${API}/api/patients/${encodeURIComponent(rut)}/account/payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? "Error registrando abono");
}
