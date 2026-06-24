import { getToken } from "./auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface IntegrationsStatus {
  whatsapp:    { configured: boolean; verified: boolean };
  mercadopago: { verified: boolean; oauthAvailable?: boolean };
  sii: {
    verified:     boolean;
    rutEmisor:    string | null;
    razonSocial:  string | null;
    giro:         string | null;
    documentType: number | null;
    exenta:       boolean;
  };
}

export async function getIntegrationsStatus(clinicId: string): Promise<IntegrationsStatus> {
  const res = await fetch(`${API}/api/clinics/${clinicId}/integrations`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Error cargando integraciones");
  }
  return res.json();
}

/* ─── Mercado Pago ─────────────────────────────────────────────────────── */

export async function updateMercadoPagoConfig(
  clinicId: string,
  data: { accessToken: string | null }
): Promise<void> {
  const res = await fetch(`${API}/api/clinics/${clinicId}/integrations/mercadopago`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Error guardando configuración MP");
  }
}

/** Inicia el flujo OAuth "conectar con 1 click" — devuelve la URL de autorización de MP. */
export async function startMercadoPagoOAuth(clinicId: string): Promise<string> {
  const res = await fetch(`${API}/api/clinics/${clinicId}/integrations/mercadopago/oauth/start`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const json = await res.json().catch(() => ({})) as { authUrl?: string; error?: string };
  if (!res.ok || !json.authUrl) throw new Error(json.error ?? "No se pudo iniciar la conexión con Mercado Pago");
  return json.authUrl;
}

export async function verifyMercadoPago(clinicId: string): Promise<{ id?: number; email?: string; nickname?: string }> {
  const res = await fetch(`${API}/api/clinics/${clinicId}/integrations/mercadopago/verify`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const json = await res.json().catch(() => ({})) as { mpUser?: { id?: number; email?: string; nickname?: string }; error?: string; detail?: string };
  if (!res.ok) {
    throw new Error(json.detail ?? json.error ?? "Mercado Pago rechazó la conexión");
  }
  return json.mpUser ?? {};
}

/* ─── SII / OpenFactura ────────────────────────────────────────────────── */

export interface SiiConfigUpdate {
  apiKey?:       string | null;
  rutEmisor?:    string | null;
  razonSocial?:  string | null;
  giro?:         string | null;
  documentType?: 39 | 41;
  exenta?:       boolean;
}

export async function updateSiiConfig(clinicId: string, data: SiiConfigUpdate): Promise<void> {
  const res = await fetch(`${API}/api/clinics/${clinicId}/integrations/sii`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Error guardando configuración SII");
  }
}

export async function verifySii(clinicId: string): Promise<{ message: string }> {
  const res = await fetch(`${API}/api/clinics/${clinicId}/integrations/sii/verify`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const json = await res.json().catch(() => ({})) as { message?: string; error?: string; missing?: string[] };
  if (!res.ok) {
    const missing = json.missing?.length ? ` (faltan: ${json.missing.join(", ")})` : "";
    throw new Error((json.error ?? "Validación falló") + missing);
  }
  return { message: json.message ?? "Verificado" };
}

/* ─── WhatsApp (Meta Cloud API) ────────────────────────────────────────── */

export async function updateWhatsappConfig(
  clinicId: string,
  data: { phoneId?: string | null; token?: string | null }
): Promise<void> {
  const res = await fetch(`${API}/api/clinics/${clinicId}/integrations/whatsapp`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Error guardando configuración WhatsApp");
  }
}

export async function verifyWhatsapp(clinicId: string): Promise<{ displayPhone?: string; verifiedName?: string }> {
  const res = await fetch(`${API}/api/clinics/${clinicId}/integrations/whatsapp/verify`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const json = await res.json().catch(() => ({})) as { waNumber?: { displayPhone?: string; verifiedName?: string }; error?: string; detail?: string };
  if (!res.ok) {
    throw new Error(json.detail ?? json.error ?? "Meta rechazó la conexión");
  }
  return json.waNumber ?? {};
}
