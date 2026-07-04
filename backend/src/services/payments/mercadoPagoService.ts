/**
 * Mercado Pago — Checkout Pro integration.
 *
 * Cada clínica tiene su propio accessToken. Creamos una preference por pago,
 * recibimos el link `init_point` y se lo entregamos al paciente (vía WhatsApp
 * o frontend). Cuando MP procesa el pago, llama nuestro webhook con un payment
 * ID que re-consultamos para confirmar el monto y estado.
 */

const MP_BASE = "https://api.mercadopago.com";

export interface MPPreferenceItem {
  title:      string;
  quantity:   number;
  unit_price: number;
  currency_id?: string; // default CLP
}

export interface MPCreatePreferenceInput {
  accessToken: string;
  items:       MPPreferenceItem[];
  externalRef: string;
  notificationUrl: string;
  backUrls?: { success?: string; failure?: string; pending?: string };
  payer?: { email?: string; name?: string };
}

export interface MPCreatePreferenceResult {
  id:                 string;
  initPoint:          string;
  sandboxInitPoint:   string;
}

export async function createPreference(input: MPCreatePreferenceInput): Promise<MPCreatePreferenceResult> {
  const body = {
    items:               input.items.map((it) => ({ ...it, currency_id: it.currency_id ?? "CLP" })),
    external_reference:  input.externalRef,
    notification_url:    input.notificationUrl,
    back_urls:           input.backUrls,
    payer:               input.payer,
    auto_return:         "approved",
  };

  const res = await fetch(`${MP_BASE}/checkout/preferences`, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      Authorization:   `Bearer ${input.accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`[MercadoPago] Error creando preference: ${res.status} ${errText}`);
  }

  const data = await res.json() as { id: string; init_point: string; sandbox_init_point: string };
  return {
    id:               data.id,
    initPoint:        data.init_point,
    sandboxInitPoint: data.sandbox_init_point,
  };
}

export interface MPPaymentDetails {
  id:                  number;
  status:              string; // "approved" | "pending" | "rejected" | "in_process" | "cancelled" | "refunded"
  status_detail?:      string;
  transaction_amount?: number;
  currency_id?:        string;
  external_reference?: string;
  date_approved?:      string;
  payer?:              { email?: string; identification?: { number?: string } };
  raw:                 unknown;
}

export async function getPayment(accessToken: string, paymentId: string | number): Promise<MPPaymentDetails> {
  const res = await fetch(`${MP_BASE}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`[MercadoPago] Error consultando payment ${paymentId}: ${res.status} ${errText}`);
  }
  const data = await res.json() as Record<string, unknown>;
  return {
    id:                 data.id as number,
    status:             data.status as string,
    status_detail:      data.status_detail as string | undefined,
    transaction_amount: data.transaction_amount as number | undefined,
    currency_id:        data.currency_id as string | undefined,
    external_reference: data.external_reference as string | undefined,
    date_approved:      data.date_approved as string | undefined,
    payer:              data.payer as MPPaymentDetails["payer"],
    raw:                data,
  };
}

/**
 * Mapea el status de MP al status interno de Payment.
 */
export function mapMpStatusToInternal(mpStatus: string): "pending" | "approved" | "rejected" | "cancelled" | "refunded" {
  switch (mpStatus) {
    case "approved":   return "approved";
    case "rejected":   return "rejected";
    case "cancelled":  return "cancelled";
    case "refunded":
    case "charged_back": return "refunded";
    case "in_process":
    case "pending":
    default:           return "pending";
  }
}
