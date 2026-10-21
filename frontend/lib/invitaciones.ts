import { getToken } from "@/lib/auth";

/**
 * Invitar a un profesional para que complete su perfil y cree su cuenta (MOL-54).
 */
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type ResultadoInvitacion = {
  link: string;
  expiresAt: string;
  /** El correo al que salió, o null si no tenía correo o no se pudo enviar. */
  enviadaA: string | null;
  /** En modo prueba (sin dominio), el correo real al que se redirigió. */
  redirigidaA: string | null;
};

export async function invitarProfesional(clinicId: string, doctorId: string): Promise<ResultadoInvitacion> {
  const res = await fetch(`${API}/api/clinics/${clinicId}/doctores/${encodeURIComponent(doctorId)}/invitacion`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: "{}",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "No pudimos crear la invitación");
  return data;
}

export type InvitacionAbierta = {
  clinica: string;
  profesional: { nombres: string; apellidos: string; specialty: string; days: string[]; email: string };
};

export async function leerInvitacion(token: string): Promise<{ ok: true; datos: InvitacionAbierta } | { ok: false; error: string }> {
  const res = await fetch(`${API}/api/invitaciones/${encodeURIComponent(token)}`);
  const data = await res.json().catch(() => ({}));
  return res.ok ? { ok: true, datos: data } : { ok: false, error: data.error ?? "No pudimos abrir la invitación." };
}

export type DatosProfesional = {
  nombres: string;
  apellidos: string;
  rut: string;
  phone: string;
  email: string;
  password: string;
  specialty: string;
  days: string[];
  aceptaTerminos: boolean;
};

/** Crea la cuenta y deja la sesión abierta. */
export async function aceptarInvitacion(token: string, datos: DatosProfesional): Promise<void> {
  const res = await fetch(`${API}/api/invitaciones/${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "No pudimos crear tu cuenta. Intenta de nuevo.");
  localStorage.setItem("molari_token", data.token);
}

/* ── Su perfil de profesional, después de aceptar ─────────────────────────── */

export type MiPerfil = { nombres: string; apellidos: string; rut: string; phone: string; specialty: string; days: string[] };

/** null si esta cuenta no es un profesional de la clínica (recepción, admin). */
export async function getMiPerfil(): Promise<{ clinica: string; perfil: MiPerfil } | null> {
  const res = await fetch(`${API}/api/profesional/perfil`, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!res.ok) return null;
  const data = await res.json();
  return data.perfil ? data : null;
}

export async function guardarMiPerfil(perfil: MiPerfil): Promise<{ clinica: string; perfil: MiPerfil }> {
  const res = await fetch(`${API}/api/profesional/perfil`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(perfil),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "No pudimos guardar tu perfil.");
  return data;
}
