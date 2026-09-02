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
  emailVerified?: boolean;
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
  accountType?: "clinic" | "solo";
  verificationStatus?: "PENDING" | "AUTO_VERIFIED" | "MANUAL_APPROVED" | "REJECTED";
  rejectionReason?: string | null;
}

/* ─── KYC (#66): verificación de clínicas — solo SUPERADMIN ───────────────── */
export interface PendingClinic {
  id: string;
  slug: string;
  name: string;
  phone: string | null;
  location: string | null;
  professionalRut: string | null;
  professionalRegNumber: string | null;
  rnpiCertUrl: string | null;
  createdAt: string;
  partnerUsers: { name: string; email: string }[];
}

export async function listPendingClinics(): Promise<PendingClinic[]> {
  const res = await fetch(`${API}/api/admin/clinics/pending`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Error cargando clínicas por revisar");
  const data = await res.json();
  return data.clinics ?? [];
}

export async function approveClinic(id: string): Promise<void> {
  const res = await fetch(`${API}/api/admin/clinics/${id}/approve`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Error al aprobar la clínica");
}

export async function rejectClinic(id: string, reason: string): Promise<void> {
  const res = await fetch(`${API}/api/admin/clinics/${id}/reject`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new Error("Error al rechazar la clínica");
}

/** Elimina una clínica y TODOS sus datos (cascada, irreversible). Solo SUPERADMIN. */
export async function deleteClinicAsAdmin(id: string): Promise<void> {
  const res = await fetch(`${API}/api/clinics/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? "Error al eliminar la clínica");
}

export interface Sesion {
  token: string;
  user: AuthUser;
  clinic: ClinicData | null;
  /** Cuántos códigos de respaldo quedan, si se entró con uno. */
  codigosRespaldoRestantes?: number;
}

/**
 * Con segundo factor activo la contraseña no abre sesión: el backend devuelve
 * un token intermedio que solo sirve para canjear el código. Va como unión
 * discriminada para que el llamador no pueda leer `token` sin comprobar antes
 * — antes esto guardaba "undefined" en localStorage y la sesión quedaba rota.
 */
export type ResultadoLogin =
  | { requiere2FA: true; pendingToken: string }
  | ({ requiere2FA?: false } & Sesion);

export async function login(email: string, password: string): Promise<ResultadoLogin> {
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
  if (data.requiere2FA) return { requiere2FA: true, pendingToken: data.pendingToken };

  localStorage.setItem("molari_token", data.token);
  return data as ResultadoLogin;
}

/** Segundo paso: canjea el código (o uno de respaldo) por la sesión. */
export async function loginSegundoFactor(pendingToken: string, codigo: string): Promise<Sesion> {
  const res = await fetch(`${API}/api/auth/login/2fa`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pendingToken, codigo }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Código incorrecto");
  localStorage.setItem("molari_token", data.token);
  return data as Sesion;
}

/* ── Segundo factor: activar y desactivar (#68) ─────────────────────────── */

function conToken(): HeadersInit {
  return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` };
}

async function pedir2FA<T>(ruta: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}/api/auth/2fa${ruta}`, {
    method: body === undefined ? "GET" : "POST",
    headers: conToken(),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "No se pudo completar la operación");
  return data as T;
}

export const estado2FA = () => pedir2FA<{ activo: boolean; codigosRespaldoRestantes: number }>("");
export const setup2FA  = () => pedir2FA<{ secret: string; otpauthUrl: string }>("/setup", {});
export const activar2FA = (codigo: string) =>
  pedir2FA<{ activo: boolean; codigosRespaldo: string[] }>("/enable", { codigo });
export const desactivar2FA = (password: string, codigo: string) =>
  pedir2FA<{ activo: boolean }>("/disable", { password, codigo });

export async function forgotPassword(email: string): Promise<void> {
  const res = await fetch(`${API}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error("Error enviando el correo");
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const res = await fetch(`${API}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, newPassword }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Error al cambiar la contraseña");
  }
}

/* ─── Verificación de correo (#66) ────────────────────────────────────────── */

/** Pide (o reenvía) el código de 6 dígitos. Lanza si está en cooldown. */
export async function sendVerificationCode(): Promise<void> {
  const res = await fetch(`${API}/api/auth/send-verification`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "No pudimos enviar el código");
  }
}

/**
 * Confirma el código. Devuelve `needsNewCode` para que la UI sepa cuándo el
 * problema no se arregla reintentando (expiró / se agotaron los intentos).
 */
export async function verifyEmailCode(code: string): Promise<void> {
  const res = await fetch(`${API}/api/auth/verify-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const e = new Error(err.error ?? "Código incorrecto") as Error & { needsNewCode?: boolean };
    e.needsNewCode = Boolean(err.needsNewCode);
    throw e;
  }
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
