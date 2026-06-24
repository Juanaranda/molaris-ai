import { getToken } from "./auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface EmittedBoleta {
  id:           string;
  folio:        number | null;
  pdfUrl:       string | null;
  totalAmount:  number;
  status:       "draft" | "issued" | "accepted" | "rejected" | "error";
}

export async function emitBoletaForBooking(
  bookingId: string,
  data: { amount?: number; rutReceptor?: string; description?: string }
): Promise<EmittedBoleta> {
  const res = await fetch(`${API}/api/bookings/${bookingId}/boleta`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => ({} as Record<string, unknown>));
  if (!res.ok) {
    throw new Error((json as { error?: string; detail?: string }).detail ?? (json as { error?: string }).error ?? "Error emitiendo boleta");
  }
  return (json as { boleta: EmittedBoleta }).boleta;
}

export interface BoletaRow {
  id:          string;
  folio:       number | null;
  status:      string;
  totalAmount: number;
  netAmount:   number;
  iva:         number;
  rutReceptor: string | null;
  patientName: string | null;
  description: string | null;
  pdfUrl:      string | null;
  emittedAt:   string | null;
  createdAt:   string;
  errorMessage: string | null;
  bookingId:   string | null;
}

export async function listBoletas(clinicId: string, params: { status?: string; limit?: number } = {}): Promise<BoletaRow[]> {
  const q = new URLSearchParams();
  if (params.status) q.set("status", params.status);
  if (params.limit)  q.set("limit", String(params.limit));
  const res = await fetch(`${API}/api/clinics/${clinicId}/boletas?${q}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Error cargando boletas");
  }
  const data = await res.json();
  return data.boletas;
}
