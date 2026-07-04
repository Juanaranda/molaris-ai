import { getToken } from "./auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type LabOrderStatus = "pending" | "in_transit" | "received" | "installed" | "rejected";
export type LabOrderType   = "corona" | "protesis" | "placa" | "puente" | "implante_corona" | "blanqueamiento" | "otro";

export interface LabOrder {
  id:               string;
  patientId:        string | null;
  toothFDI:         string | null;
  labName:          string;
  orderType:        LabOrderType;
  description:      string | null;
  sentAt:           string;
  expectedReturnAt: string | null;
  receivedAt:       string | null;
  installedAt:      string | null;
  status:           LabOrderStatus;
  cost:             number | null;
  notes:            string | null;
  createdAt:        string;
  patient:          { id: string; name: string | null; identity: { firstName: string; lastName: string; rut: string } | null } | null;
  createdBy:        { id: string; name: string };
}

export async function listLabOrders(
  clinicId: string,
  params: { status?: string; patientId?: string; overdue?: boolean; limit?: number } = {}
): Promise<LabOrder[]> {
  const q = new URLSearchParams();
  if (params.status)    q.set("status",    params.status);
  if (params.patientId) q.set("patientId", params.patientId);
  if (params.overdue)   q.set("overdue",   "true");
  if (params.limit)     q.set("limit",     String(params.limit));

  const res = await fetch(`${API}/api/clinics/${clinicId}/lab-orders?${q}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Error cargando órdenes");
  const data = await res.json();
  return data.orders;
}

export async function createLabOrder(
  clinicId: string,
  data: {
    patientId?:       string;
    toothFDI?:        string;
    labName:          string;
    orderType:        LabOrderType;
    description?:     string;
    sentAt?:          string;
    expectedReturnAt?: string;
    cost?:            number;
    notes?:           string;
  }
): Promise<LabOrder> {
  const res = await fetch(`${API}/api/clinics/${clinicId}/lab-orders`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body:    JSON.stringify(data),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? "Error");
  return (json as { order: LabOrder }).order;
}

export async function updateLabOrder(
  clinicId: string,
  orderId: string,
  data: { status?: LabOrderStatus; receivedAt?: string | null; installedAt?: string | null; expectedReturnAt?: string | null; cost?: number | null; notes?: string | null }
): Promise<LabOrder> {
  const res = await fetch(`${API}/api/clinics/${clinicId}/lab-orders/${orderId}`, {
    method:  "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body:    JSON.stringify(data),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? "Error");
  return (json as { order: LabOrder }).order;
}

export async function deleteLabOrder(clinicId: string, orderId: string): Promise<void> {
  const res = await fetch(`${API}/api/clinics/${clinicId}/lab-orders/${orderId}`, {
    method:  "DELETE",
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Error");
  }
}

export const ORDER_TYPE_LABELS: Record<LabOrderType, string> = {
  corona:           "Corona",
  protesis:         "Prótesis",
  placa:            "Placa",
  puente:           "Puente",
  implante_corona:  "Corona sobre implante",
  blanqueamiento:   "Blanqueamiento",
  otro:             "Otro",
};
