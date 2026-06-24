/**
 * OpenFactura (Haulmer) — emisión de DTE para SII Chile.
 *
 * API REST. Cada clínica tiene su propio apiKey (después del proceso de
 * certificación con el SII). El provider asigna el folio CAF automáticamente.
 *
 * Base URL configurable vía env OPENFACTURA_BASE_URL (default = dev).
 * Producción: https://api.haulmer.com
 * Desarrollo: https://dev-api.haulmer.com
 *
 * Docs: https://docsapi-openfactura.haulmer.com/
 */

import crypto from "node:crypto";

const DEV_BASE  = "https://dev-api.haulmer.com";
const BASE_URL  = process.env.OPENFACTURA_BASE_URL ?? DEV_BASE;

export interface DTEItem {
  description: string;
  quantity:    number;
  unitPrice:   number;       // CLP, neto
}

export interface EmitDTEInput {
  apiKey:         string;
  documentType:   number;     // 39 = boleta afecta, 41 = exenta
  rutEmisor:      string;     // "76.123.456-7"
  razonSocial:    string;
  giro:           string;
  rutReceptor?:   string;     // opcional — null = boleta consumidor final
  receptorName?:  string;
  items:          DTEItem[];
  exenta?:        boolean;    // si true, IVA = 0 (servicios médicos)
}

export interface EmitDTEResult {
  folio:        number | null;
  providerRef:  string | null;
  status:       "issued" | "accepted" | "rejected" | "error";
  pdfUrl:       string | null;
  timbreUrl:    string | null;
  xml:          string | null;
  netAmount:    number;
  iva:          number;
  totalAmount:  number;
  errorMessage?: string;
  raw:          unknown;
}

export async function emitBoleta(input: EmitDTEInput): Promise<EmitDTEResult> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const taxRate = input.exenta ? 0 : 0.19;

  const detalle = input.items.map((it, idx) => ({
    NroLinDet:  idx + 1,
    NmbItem:    it.description.slice(0, 80),
    QtyItem:    it.quantity,
    PrcItem:    Math.round(it.unitPrice),
    MontoItem:  Math.round(it.quantity * it.unitPrice),
    ...(input.exenta ? { IndExe: 1 } : {}),
  }));

  const netAmount   = detalle.reduce((s, d) => s + d.MontoItem, 0);
  const iva         = Math.round(netAmount * taxRate);
  const totalAmount = netAmount + iva;

  const totales: Record<string, number | string> = input.exenta
    ? { MntExe: netAmount, MntTotal: totalAmount }
    : { MntNeto: netAmount, TasaIVA: "19", IVA: iva, MntTotal: totalAmount };

  const body = {
    response: ["FOLIO", "PDF", "TIMBRE", "XML"],
    dte: {
      Encabezado: {
        IdDoc: {
          TipoDTE: input.documentType,
          Folio:   0,            // 0 = pedir al provider que asigne
          FchEmis: today,
          ...(input.documentType === 39 ? { IndServicio: 3 } : {}), // 3 = servicios
        },
        Emisor: {
          RUTEmisor:   input.rutEmisor,
          RznSoc:      input.razonSocial.slice(0, 100),
          GiroEmis:    input.giro.slice(0, 80),
        },
        ...(input.rutReceptor ? {
          Receptor: {
            RUTRecep:   input.rutReceptor,
            ...(input.receptorName ? { RznSocRecep: input.receptorName.slice(0, 100) } : {}),
          },
        } : {}),
        Totales: totales,
      },
      Detalle: detalle,
    },
  };

  const idempotencyKey = crypto.randomUUID();

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/v2/dte/document`, {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "apikey":            input.apiKey,
        "Idempotency-Key":   idempotencyKey,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return {
      folio: null, providerRef: null, status: "error",
      pdfUrl: null, timbreUrl: null, xml: null,
      netAmount, iva, totalAmount,
      errorMessage: err instanceof Error ? err.message : String(err),
      raw: null,
    };
  }

  let data: unknown;
  try { data = await res.json(); }
  catch { data = await res.text(); }

  if (!res.ok) {
    return {
      folio: null, providerRef: null, status: "error",
      pdfUrl: null, timbreUrl: null, xml: null,
      netAmount, iva, totalAmount,
      errorMessage: `OpenFactura ${res.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`,
      raw: data,
    };
  }

  const obj = data as Record<string, unknown>;
  const folio = typeof obj.FOLIO === "number"
    ? obj.FOLIO
    : (typeof obj.folio === "number" ? obj.folio : null);

  return {
    folio,
    providerRef: typeof obj.id === "string" ? obj.id : null,
    status:      "issued",
    pdfUrl:      typeof obj.PDF === "string" ? obj.PDF : null,
    timbreUrl:   typeof obj.TIMBRE === "string" ? obj.TIMBRE : null,
    xml:         typeof obj.XML === "string" ? obj.XML : null,
    netAmount, iva, totalAmount,
    raw: obj,
  };
}
