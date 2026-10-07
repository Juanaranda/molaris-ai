import { describe, it, expect } from "vitest";
import {
  escapeHtml, formatCLP, pickPatientEmail, renderQuoteEmail, type QuoteEmailInput,
} from "../services/email/quoteEmail";

/**
 * Presupuesto por correo (MOL-35). El botón del panel llamaba a una ruta que
 * no existía; ahora el correo se arma acá y la ruta solo decide a quién va.
 */

function base(overrides: Partial<QuoteEmailInput> = {}): QuoteEmailInput {
  return {
    clinic: { name: "Galana Clínica Dental", phone: "+56 9 1234 5678", location: "Providencia" },
    patientName: "Ana Pérez",
    doctor: "Dr. Juan Garcés",
    discount: 0,
    totalAmount: 1_350_000,
    notes: null,
    paymentInfo: null,
    createdAt: new Date("2026-09-15T15:00:00Z"),
    items: [
      { toothFDI: "3.6", surfaces: "O,D", prestacion: "Endodoncia", unitPrice: 250_000, quantity: 1, discount: 0, total: 250_000 },
      { toothFDI: null, surfaces: null, prestacion: "Implante", unitPrice: 550_000, quantity: 2, discount: 0, total: 1_100_000 },
    ],
    ...overrides,
  };
}

describe("formatCLP", () => {
  it("usa separador de miles chileno y sin decimales", () => {
    expect(formatCLP(1_234_567)).toBe("$1.234.567");
    expect(formatCLP(990.6)).toBe("$991");
  });
});

describe("escapeHtml", () => {
  it("neutraliza etiquetas y comillas", () => {
    expect(escapeHtml(`<b onclick="x">'&'</b>`)).toBe("&lt;b onclick=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/b&gt;");
  });
});

describe("renderQuoteEmail", () => {
  it("resume ítems, total en CLP y la clínica", () => {
    const { subject, html, text } = renderQuoteEmail(base());
    expect(subject).toBe("Tu presupuesto dental — Galana Clínica Dental");
    expect(html).toContain("Hola Ana Pérez,");
    expect(html).toContain("Endodoncia");
    expect(html).toContain("Pieza 36 (O, D)");
    expect(html).toContain("$550.000 × 2");
    expect(html).toContain("$1.350.000");
    expect(html).toContain("Galana Clínica Dental · +56 9 1234 5678 · Providencia");
    expect(text).toContain("- Implante (General): $550.000 × 2 = $1.100.000");
    expect(text).toContain("Total: $1.350.000");
  });

  it("muestra el descuento general cuando hay", () => {
    const { html, text } = renderQuoteEmail(base({ discount: 10, totalAmount: 1_215_000 }));
    expect(html).toContain("Descuento general (10%)");
    expect(text).toContain("Subtotal: $1.350.000");
    expect(text).toContain("Descuento general (10%): −$135.000");
    expect(text).toContain("Total: $1.215.000");
  });

  it("sin descuento no muestra subtotal", () => {
    expect(renderQuoteEmail(base()).text).not.toContain("Subtotal");
  });

  it("escapa en el HTML todo lo que viene de la base", () => {
    const { html, subject } = renderQuoteEmail(base({
      clinic: { name: "Clínica <script>alert(1)</script>" },
      patientName: `"><img src=x onerror=alert(1)>`,
      notes: "<a href='http://malo.cl'>paga aquí</a>",
      paymentInfo: "3 cuotas & sin interés",
      items: [{ toothFDI: null, surfaces: null, prestacion: "<b>Limpieza</b>", unitPrice: 30_000, quantity: 1, discount: 0, total: 30_000 }],
      totalAmount: 30_000,
    }));
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<a href");
    expect(html).not.toContain("<b>Limpieza</b>");
    expect(html).toContain("&lt;b&gt;Limpieza&lt;/b&gt;");
    expect(html).toContain("3 cuotas &amp; sin interés");
    // El asunto va como texto plano al proveedor; en el <title> sí se escapa.
    expect(subject).toContain("<script>");
    expect(html).toContain("<title>Tu presupuesto dental — Clínica &lt;script&gt;");
  });

  it("incluye forma de pago y notas cuando existen", () => {
    const { text } = renderQuoteEmail(base({ paymentInfo: "Transferencia", notes: "Válido por 30 días" }));
    expect(text).toContain("Forma de pago: Transferencia");
    expect(text).toContain("Notas: Válido por 30 días");
  });
});

describe("pickPatientEmail", () => {
  it("toma el primer correo válido, de la cita más reciente a la más antigua", () => {
    expect(pickPatientEmail([null, "  ", "no-es-correo", " ana@correo.cl ", "vieja@correo.cl"])).toBe("ana@correo.cl");
  });

  it("sin correos válidos devuelve null", () => {
    expect(pickPatientEmail([])).toBeNull();
    expect(pickPatientEmail([null, undefined, ""])).toBeNull();
  });
});
