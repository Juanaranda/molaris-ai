const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type PartnerRole = "SUPERADMIN" | "ADMIN" | "USER";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: PartnerRole;
  clinicId: string | null;
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
  localStorage.setItem("molaris_token", data.token);
  return data as { token: string; user: AuthUser; clinic: ClinicData | null };
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("molaris_token");
}

export function logout() {
  localStorage.removeItem("molaris_token");
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
