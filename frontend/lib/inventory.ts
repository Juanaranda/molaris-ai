import { getToken } from "./auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface InventoryItem {
  id: string;
  name: string;
  category: string | null;
  unit: string;
  currentStock: number;
  minStock: number;
  cost: number | null;
  active: boolean;
  lowStock?: boolean;
}

function headers(json = false): HeadersInit {
  const h: Record<string, string> = { Authorization: `Bearer ${getToken()}` };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

export async function getInventory(): Promise<{ items: InventoryItem[]; lowStockCount: number }> {
  const res = await fetch(`${API}/api/inventory`, { headers: headers() });
  if (!res.ok) throw new Error("Error cargando inventario");
  return res.json();
}

export async function createInventoryItem(data: {
  name: string; category?: string; unit?: string; currentStock?: number; minStock?: number; cost?: number;
}): Promise<void> {
  const res = await fetch(`${API}/api/inventory`, { method: "POST", headers: headers(true), body: JSON.stringify(data) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})) as { error?: string }).error ?? "Error creando insumo");
}

export async function updateInventoryItem(id: string, data: {
  name?: string; category?: string | null; unit?: string; minStock?: number; cost?: number | null;
}): Promise<void> {
  const res = await fetch(`${API}/api/inventory/${id}`, { method: "PATCH", headers: headers(true), body: JSON.stringify(data) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})) as { error?: string }).error ?? "Error actualizando insumo");
}

export async function deleteInventoryItem(id: string): Promise<void> {
  const res = await fetch(`${API}/api/inventory/${id}`, { method: "DELETE", headers: headers() });
  if (!res.ok) throw new Error("Error eliminando insumo");
}

export async function registerMovement(id: string, data: {
  kind: "in" | "out" | "adjustment"; quantity: number; reason?: string;
}): Promise<void> {
  const res = await fetch(`${API}/api/inventory/${id}/movement`, { method: "POST", headers: headers(true), body: JSON.stringify(data) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})) as { error?: string }).error ?? "Error registrando movimiento");
}
