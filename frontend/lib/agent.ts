import { getToken } from "./auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface AgentStatus {
  agentEnabled: boolean;
  agentDisabledAt: string | null;
  agentDisabledReason: string | null;
}

export async function getAgentStatus(clinicId: string): Promise<AgentStatus> {
  const res = await fetch(`${API}/api/clinics/${clinicId}/agent`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Error cargando estado del agente");
  return res.json();
}

export async function setAgentEnabled(
  clinicId: string,
  enabled: boolean,
  reason?: string
): Promise<AgentStatus> {
  const res = await fetch(`${API}/api/clinics/${clinicId}/agent`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify({ enabled, reason }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? "Error cambiando el agente");
  return json as AgentStatus;
}
