const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("admin_token");
}

export function saveToken(token: string) {
  localStorage.setItem("admin_token", token);
}

export function clearToken() {
  localStorage.removeItem("admin_token");
}

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts?.headers },
  });
  if (res.status === 401 || res.status === 403) {
    clearToken();
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const api = {
  login: (email: string, password: string) =>
    req<{ token: string; user: { name: string; email: string; role: string } }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  overview: () => req<AdminOverview>("/api/admin/overview"),
  models:   (days = 30) => req<ModelStats>(`/api/admin/models?days=${days}`),
  errors:   (days = 7, limit = 100) => req<ErrorStats>(`/api/admin/errors?days=${days}&limit=${limit}`),
  clinicUsage: (id: string, days = 30) => req<ClinicUsage>(`/api/admin/clinics/${id}/usage?days=${days}`),
  estado:   () => req<Estado>("/api/admin/estado"),
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdminOverview {
  totals: { clinics: number; sessions: number; leads: number; bookings: number; calls: number; tokensIn: number; tokensOut: number; costUsd: number; avgLatencyMs: number };
  clinics: ClinicRow[];
  modelBreakdown: ModelRow[];
  dailyCost: { day: string; cost: number; calls: number }[];
}

export interface ClinicRow {
  id: string; slug: string; name: string; plan: string | null; active: boolean; createdAt: string;
  _count: { sessions: number; bookings: number; partnerUsers: number };
  usage30d: { calls: number; tokensIn: number; tokensOut: number; costUsd: number };
}

export interface ModelRow { model: string; tier: string; calls: number; tokensIn: number; tokensOut: number; costUsd: number }

export interface ModelStats {
  byModel: (ModelRow & { avgLatencyMs: number; p50Ms: number; p95Ms: number; p99Ms: number })[];
  dailyByTier: { day: string; tier: string; calls: number; cost: number }[];
}

export interface ErrorStats {
  errors: ErrorEvent[];
  byType: { type: string; count: number }[];
  byModel: { model: string; tier: string; count: number }[];
  errorRate: { day: string; total: number; failures: number; rate: number }[];
}

export interface ErrorEvent {
  id: string; model: string; tier: string; errorType: string | null; errorMessage: string | null;
  latencyMs: number | null; channel: string | null; isSandbox: boolean; createdAt: string;
  clinic: { name: string; slug: string };
}

// Espejo de backend/src/services/estado/estadoService.ts
export type Nivel = "ok" | "degradado" | "caido";

export interface EstadoAmbiente {
  nombre: string; api: string; web: string; rama: string;
  nivel: Nivel; motivos: string[];
  salud: {
    alcanzable: boolean; ms: number; status?: "ok" | "degraded" | "down";
    db?: { ok: boolean; latencyMs?: number };
    schedulers?: { name: string; ok: boolean; ageSec: number | null }[];
    ia?: { openRouter: boolean; groq: boolean; credits: string };
    version?: string | null; uptimeSec?: number;
  };
  frontend: { alcanzable: boolean; status?: number; ms: number };
  punta: { sha: string; mensaje: string; fecha: string } | null;
  deploys: { ambiente: string; sha: string; estado: string; fecha: string }[];
  neon: {
    configurado: boolean; error?: string;
    computoHoras?: number; activoHoras?: number; almacenamientoMB?: number; finPeriodo?: string;
    cuota?: { computoHoras?: number; activoHoras?: number; almacenamientoMB?: number };
    endpoints?: { tipo: string; estado: string; deshabilitado: boolean; ultimoUso?: string }[];
  };
}

export interface Estado {
  generado: string;
  ambientes: EstadoAmbiente[];
  chequeos: { conclusion: string | null; estado: string; evento: string; fecha: string; url: string }[];
}

export interface ClinicUsage {
  byDay: { day: string; cost: number; calls: number; tokensIn: number; tokensOut: number }[];
  byModel: ModelRow[];
  recent: { id: string; model: string; tier: string; tokensIn: number; tokensOut: number; costUsd: number; latencyMs: number | null; createdAt: string }[];
}
