const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type PartnerRole  = "SUPERADMIN" | "ADMIN" | "USER";
export type ClinicalRole = "HYGIENIST" | "GENERAL_DENTIST" | "SPECIALIST" | "RECEPTION" | "CLINIC_ADMIN";

export const CLINICAL_ROLE_LABELS: Record<ClinicalRole, string> = {
  HYGIENIST:       "Higienista",
  GENERAL_DENTIST: "Odontólogo general",
  SPECIALIST:      "Especialista",
  CLINIC_ADMIN:    "Admin clínico",
  RECEPTION:       "Recepción / Admin no-clínico",
};

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: PartnerRole;
  clinicalRole?: ClinicalRole | null;
  clinicId: string | null;
  mustChangePassword?: boolean;
  photoUrl?: string | null;
  occupation?: string | null;
  phone?: string | null;
  bio?: string | null;
}

export interface ClinicData {
  id: string;
  slug: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  location: string | null;
  plan: string;
  config: Record<string, unknown>;
  active: boolean;
}

export async function login(email: string, password: string) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Error al iniciar sesión");
  }
  const data = await res.json();
  localStorage.setItem("molari_token", data.token);
  return data as { token: string; user: AuthUser; clinic: ClinicData | null };
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("molari_token");
}

export function logout() {
  localStorage.removeItem("molari_token");
}

export async function getMe(): Promise<{ user: AuthUser; clinic: ClinicData | null } | null> {
  const token = getToken();
  if (!token) return null;
  const res = await fetch(`${API}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    logout();
    return null;
  }
  return res.json();
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API}/api/auth/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Error al cambiar contraseña");
  }
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: PartnerRole;
  clinicalRole: ClinicalRole | null;
  active: boolean;
  photoUrl: string | null;
  occupation: string | null;
  phone: string | null;
  bio: string | null;
  createdAt: string;
}

export async function listTeam(clinicId: string): Promise<TeamMember[]> {
  const token = getToken();
  const res = await fetch(`${API}/api/clinics/${clinicId}/users`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Error al cargar equipo");
  }
  const data = await res.json();
  return data.users;
}

export async function inviteTeamMember(
  clinicId: string,
  data: { name: string; email: string; role?: "USER" | "ADMIN"; occupation?: string }
): Promise<{ user: TeamMember; tempPassword: string }> {
  const token = getToken();
  const res = await fetch(`${API}/api/clinics/${clinicId}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Error al invitar");
  }
  return res.json();
}

export async function updateTeamMember(
  clinicId: string,
  userId: string,
  data: { role?: "USER" | "ADMIN"; clinicalRole?: ClinicalRole | null; active?: boolean }
): Promise<TeamMember> {
  const token = getToken();
  const res = await fetch(`${API}/api/clinics/${clinicId}/users/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Error al actualizar");
  }
  const result = await res.json();
  return result.user;
}

export async function updateMe(
  data: Partial<Pick<AuthUser, "name" | "photoUrl" | "occupation" | "phone" | "bio">>
): Promise<AuthUser> {
  const token = getToken();
  const res = await fetch(`${API}/api/auth/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Error al guardar");
  }
  return res.json();
}

export async function updateClinic(
  clinicId: string,
  data: Partial<Pick<ClinicData, "name" | "phone" | "whatsapp" | "instagram" | "location" | "config">>
): Promise<ClinicData> {
  const token = getToken();
  const res = await fetch(`${API}/api/clinics/${clinicId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Error al guardar");
  }
  return res.json();
}
