import { getToken } from "./auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface PaymentLink {
  paymentId: string;
  initPoint: string;
  amount:    number;
}

export async function createBookingPaymentLink(
  bookingId: string,
  data: { amount?: number; description?: string }
): Promise<PaymentLink> {
  const res = await fetch(`${API}/api/bookings/${bookingId}/payment-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Error generando link de pago");
  }
  return res.json();
}

export interface PaymentRow {
  id:           string;
  amount:       number;
  currency:     string;
  status:       "pending" | "approved" | "rejected" | "cancelled" | "refunded";
  payerEmail:   string | null;
  initPoint:    string | null;
  description:  string | null;
  paidAt:       string | null;
  createdAt:    string;
  booking:      { id: string; patientName: string | null; date: string; time: string; service: string | null } | null;
}

export async function listPayments(clinicId: string, params: { status?: string; limit?: number } = {}): Promise<PaymentRow[]> {
  const q = new URLSearchParams();
  if (params.status) q.set("status", params.status);
  if (params.limit)  q.set("limit", String(params.limit));
  const res = await fetch(`${API}/api/clinics/${clinicId}/payments?${q}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Error cargando pagos");
  }
  const data = await res.json();
  return data.payments;
}
