import { getToken } from "./auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface AuditLogEntry {
  id:             string;
  action:         "read" | "create" | "update" | "delete";
  resourceType:   string;
  resourceId:     string;
  snapshotBefore: unknown | null;
  snapshotAfter:  unknown | null;
  ip:             string | null;
  userAgent:      string | null;
  createdAt:      string;
  actor:          { id: string; name: string; email: string } | null;
}

export async function listAuditLog(
  clinicId: string,
  params: { actor?: string; resource?: string; from?: string; to?: string; limit?: number } = {}
): Promise<AuditLogEntry[]> {
  const q = new URLSearchParams();
  if (params.actor)    q.set("actor",    params.actor);
  if (params.resource) q.set("resource", params.resource);
  if (params.from)     q.set("from",     params.from);
  if (params.to)       q.set("to",       params.to);
  if (params.limit)    q.set("limit",    String(params.limit));

  const res = await fetch(`${API}/api/clinics/${clinicId}/audit-log?${q}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Error cargando audit log");
  }
  const data = await res.json();
  return data.logs;
}
