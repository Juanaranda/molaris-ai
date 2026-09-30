/**
 * Correo con el presupuesto dental que la clínica le manda a su paciente
 * (MOL-35). Funciones puras: la ruta busca los datos y decide a quién va; acá
 * solo se arma el contenido, para poder probarlo sin base de datos.
 *
 * Todo lo que viene de la base (nombres, prestaciones, notas) lo escribe una
 * persona, así que se escapa antes de meterlo en el HTML.
 */

export interface QuoteEmailItem {
  toothFDI: string | null;
  surfaces: string | null;
  prestacion: string;
  unitPrice: number;
  quantity: number;
  discount: number;
  total: number;
}

export interface QuoteEmailInput {
  clinic: { name: string; phone?: string | null; location?: string | null };
  patientName: string;
  doctor?: string | null;
  discount: number;
  totalAmount: number;
  notes?: string | null;
  paymentInfo?: string | null;
  createdAt: Date;
  items: QuoteEmailItem[];
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const BRAND = {
  teal: "#1A5C7A",
  dark: "#0C1B26",
  cream: "#F7F5F1",
  muted: "#607281",
  border: "#E5E0D9",
};

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

/** Monto en pesos chilenos, sin decimales: 1234567 → "$1.234.567". */
export function formatCLP(amount: number): string {
  return clp.format(Math.round(amount));
}

// El FDI se guarda como "1.8" pero en la clínica se lee "18".
const fdiLabel = (fdi: string) => fdi.replace(".", "");

function detalleDePieza(item: QuoteEmailItem): string {
  if (!item.toothFDI) return "General";
  const caras = item.surfaces ? ` (${item.surfaces.split(",").join(", ")})` : "";
  return `Pieza ${fdiLabel(item.toothFDI)}${caras}`;
}

function detalleDePrecio(item: QuoteEmailItem): string {
  const partes = [formatCLP(item.unitPrice)];
  if (item.quantity > 1) partes[0] += ` × ${item.quantity}`;
  if (item.discount > 0) partes.push(`${item.discount}% dto.`);
  return partes.join(" · ");
}

/**
 * Asunto, HTML y texto plano del presupuesto. El HTML usa estilos en línea y
 * tablas para que se vea bien en los clientes de correo más comunes.
 */
export function renderQuoteEmail(q: QuoteEmailInput): RenderedEmail {
  const clinica = q.clinic.name.trim();
  const nombre = q.patientName.trim();
  const saludo = nombre ? `Hola ${nombre},` : "Hola,";
  const fecha = q.createdAt.toLocaleDateString("es-CL", {
    day: "numeric", month: "long", year: "numeric", timeZone: "America/Santiago",
  });
  const subtotal = q.items.reduce((acc, i) => acc + i.total, 0);
  const contacto = [q.clinic.phone, q.clinic.location].filter((s): s is string => !!s?.trim());

  const subject = `Tu presupuesto dental — ${clinica}`;

  const e = escapeHtml;
  const filas = q.items.map((item) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid ${BRAND.border};">
          <div style="font-weight:600;color:${BRAND.dark};">${e(item.prestacion)}</div>
          <div style="font-size:12px;color:${BRAND.muted};">${e(detalleDePieza(item))} · ${e(detalleDePrecio(item))}</div>
        </td>
        <td style="padding:10px 0 10px 12px;border-bottom:1px solid ${BRAND.border};text-align:right;white-space:nowrap;font-weight:600;color:${BRAND.dark};">${formatCLP(item.total)}</td>
      </tr>`).join("");

  const descuento = q.discount > 0
    ? `
      <tr>
        <td style="padding:10px 0 0;color:${BRAND.muted};">Subtotal</td>
        <td style="padding:10px 0 0 12px;text-align:right;color:${BRAND.muted};">${formatCLP(subtotal)}</td>
      </tr>
      <tr>
        <td style="padding:4px 0 0;color:${BRAND.muted};">Descuento general (${q.discount}%)</td>
        <td style="padding:4px 0 0 12px;text-align:right;color:${BRAND.muted};">−${formatCLP(subtotal - q.totalAmount)}</td>
      </tr>`
    : "";

  const parrafo = (html: string) => `<p style="margin:0 0 14px;">${html}</p>`;

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${e(subject)}</title></head>
<body style="margin:0;padding:0;background:${BRAND.cream};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.cream};padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FDFCFB;border:1px solid ${BRAND.border};border-radius:20px;overflow:hidden;">
      <tr><td style="padding:22px 32px;border-bottom:1px solid ${BRAND.border};font-size:18px;font-weight:800;color:${BRAND.dark};">${e(clinica)}</td></tr>
      <tr><td style="padding:28px 32px;font-size:15px;line-height:1.6;color:${BRAND.muted};">
        <h1 style="margin:0 0 16px;font-size:22px;line-height:1.25;color:${BRAND.dark};">Tu presupuesto dental</h1>
        ${parrafo(e(saludo))}
        ${parrafo(`Te enviamos el detalle del presupuesto que preparamos para ti el ${e(fecha)}${q.doctor ? `, con ${e(q.doctor)}` : ""}.`)}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;margin:8px 0 4px;">
          ${filas}
          ${descuento}
          <tr>
            <td style="padding:14px 0 0;font-weight:800;color:${BRAND.dark};">Total</td>
            <td style="padding:14px 0 0 12px;text-align:right;white-space:nowrap;font-size:18px;font-weight:800;color:${BRAND.teal};">${formatCLP(q.totalAmount)}</td>
          </tr>
        </table>
        ${q.paymentInfo ? parrafo(`<strong>Forma de pago:</strong> ${e(q.paymentInfo)}`) : ""}
        ${q.notes ? parrafo(`<strong>Notas:</strong> ${e(q.notes)}`) : ""}
        ${parrafo("Si tienes dudas o quieres agendar, responde este correo o contáctanos.")}
      </td></tr>
      <tr><td style="padding:18px 32px;border-top:1px solid ${BRAND.border};font-size:12px;color:${BRAND.muted};">
        ${e([clinica, ...contacto].join(" · "))}
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

  const lineas = q.items.map((item) =>
    `- ${item.prestacion} (${detalleDePieza(item)}): ${detalleDePrecio(item)} = ${formatCLP(item.total)}`);
  const text = [
    saludo,
    "",
    `Te enviamos el detalle del presupuesto que preparamos para ti el ${fecha}${q.doctor ? `, con ${q.doctor}` : ""}.`,
    "",
    ...lineas,
    ...(q.discount > 0
      ? ["", `Subtotal: ${formatCLP(subtotal)}`, `Descuento general (${q.discount}%): −${formatCLP(subtotal - q.totalAmount)}`]
      : []),
    `Total: ${formatCLP(q.totalAmount)}`,
    ...(q.paymentInfo ? ["", `Forma de pago: ${q.paymentInfo}`] : []),
    ...(q.notes ? ["", `Notas: ${q.notes}`] : []),
    "",
    "Si tienes dudas o quieres agendar, responde este correo o contáctanos.",
    "",
    [clinica, ...contacto].join(" · "),
  ].join("\n");

  return { subject, html, text };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * El correo del paciente vive en sus citas (la ficha de pacientes se arma a
 * partir de ellas). Recibe los correos de sus citas de la más reciente a la
 * más antigua y devuelve el primero que parece una dirección válida.
 */
export function pickPatientEmail(candidates: Array<string | null | undefined>): string | null {
  for (const c of candidates) {
    const email = c?.trim();
    if (email && EMAIL_RE.test(email)) return email;
  }
  return null;
}
