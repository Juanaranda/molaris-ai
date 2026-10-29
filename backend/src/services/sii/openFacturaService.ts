/**
 * OpenFactura (Haulmer): emisión de boletas electrónicas ante el SII.
 *
 * Cada clínica usa su propia API key. OpenFactura asigna el folio, firma el
 * documento y lo envía al SII. Base configurable con OPENFACTURA_BASE_URL:
 *   producción  https://api.haulmer.com
 *   pruebas     https://dev-api.haulmer.com (por defecto)
 *
 * El formato se probó contra el ambiente de pruebas con la clave demo pública
 * (MOL-63). Lo que difiere de una factura y hay que respetar en la boleta:
 * - Emisor con RznSocEmisor y GiroEmisor (no RznSoc/GiroEmis), más dirección
 *   y comuna, que se sacan de GET /organization.
 * - Receptor obligatorio: 66666666-6 si es consumidor final.
 * - Montos del detalle con IVA incluido; Totales sin TasaIVA.
 * - El PDF llega en base64 y se pide aparte con el TOKEN del documento: no
 *   está listo apenas se emite, así que se pide cuando alguien lo abre.
 *
 * Docs: https://docsapi-openfactura.haulmer.com/
 */

const BASE = process.env.OPENFACTURA_BASE_URL ?? "https://dev-api.haulmer.com";
const BASE_URL = `${BASE}/v2/dte`;
/** En el ambiente de pruebas las boletas no llegan al SII: la pantalla lo avisa. */
export const AMBIENTE_PRUEBAS = BASE.includes("dev-api");
const RUT_CONSUMIDOR_FINAL = "66666666-6";

/** Un error de OpenFactura con su código (OF-10…) y un mensaje para la recepción. */
export class ErrorOpenFactura extends Error {
  constructor(
    message: string,
    readonly codigo: string | null,
    /** Sí: OpenFactura respondió y la rechazó. No: no se sabe si quedó emitida (red, 5xx, 429). */
    readonly rechazada: boolean,
    readonly detalles: { field?: string; issue?: string }[] = [],
  ) { super(message); }
}

export interface Emisor {
  rut: string;
  razonSocial: string;
  giro: string;
  direccion: string;
  comuna: string;
  sucursal: string | null;
}

/** El cuerpo de error de OpenFactura: { error: { message, code, details: [{ field, issue }] } }. */
function leerError(data: unknown): { mensaje: string; codigo: string | null; detalles: { field?: string; issue?: string }[] } {
  const e = (data as { error?: { message?: string; code?: string; details?: unknown } })?.error
    ?? (data as { message?: string; code?: string; details?: unknown });
  const detalles = Array.isArray(e?.details) ? (e.details as { field?: string; issue?: string }[]) : [];
  return { mensaje: e?.message ?? "Error desconocido", codigo: e?.code ?? null, detalles };
}

async function pedir(apiKey: string, ruta: string, init: RequestInit = {}): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${ruta}`, {
      ...init,
      headers: { "Content-Type": "application/json", apikey: apiKey, ...init.headers },
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new ErrorOpenFactura("No hubo respuesta de OpenFactura. Revisa en un rato si la boleta quedó emitida antes de reintentar.", null, false);
  }
  const texto = await res.text();
  let data: unknown = texto;
  try { data = JSON.parse(texto); } catch { /* respuesta no JSON */ }
  if (res.ok) return data;

  if (res.status === 401 || res.status === 403) {
    throw new ErrorOpenFactura("OpenFactura no reconoce la API key de la clínica. Revísala en Configuración → Integraciones.", null, true);
  }
  const { mensaje, codigo, detalles } = leerError(data);
  const detalle = detalles.map((d) => [d.field, d.issue].filter(Boolean).join(": ")).join("; ");
  throw new ErrorOpenFactura(
    `OpenFactura: ${mensaje}${detalle ? ` (${detalle})` : ""}`,
    codigo,
    res.status >= 400 && res.status < 500 && res.status !== 429,
    detalles,
  );
}

/** Los datos del emisor dueño de la API key, como los tiene el SII. */
export async function organizacion(apiKey: string): Promise<Emisor> {
  const o = (await pedir(apiKey, "/organization")) as Record<string, unknown>;
  const texto = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");
  const actividades = Array.isArray(o.actividades) ? (o.actividades as { giro?: string; actividadPrincipal?: boolean }[]) : [];
  const giro = texto(o.glosaDescriptiva) || texto((actividades.find((a) => a.actividadPrincipal) ?? actividades[0])?.giro);
  const emisor = {
    rut: texto(o.rut), razonSocial: texto(o.razonSocial), giro,
    direccion: texto(o.direccion), comuna: texto(o.comuna),
    sucursal: o.cdgSIISucur != null && o.cdgSIISucur !== "" ? String(o.cdgSIISucur) : null,
  };
  const faltan = (["rut", "razonSocial", "giro", "direccion", "comuna"] as const).filter((k) => !emisor[k]);
  if (faltan.length) {
    throw new ErrorOpenFactura(`El SII no tiene estos datos de la clínica en OpenFactura: ${faltan.join(", ")}. Complétalos en OpenFactura.`, null, true);
  }
  return emisor;
}

/** Medio de pago de la caja → código del SII para boletas (1 efectivo, 2 electrónico, 3 transferencia, 5 otro). */
export function medioPagoSii(medio: string): number {
  return ({ cash: 1, card: 2, mercadopago: 2, transfer: 3 } as Record<string, number>)[medio] ?? 5;
}

/** Neto e IVA de una boleta afecta a partir del total con IVA, como los recalcula el SII. */
export function montosBoleta(total: number, exenta: boolean): { neto: number; iva: number; total: number } {
  const t = Math.round(total);
  if (exenta) return { neto: t, iva: 0, total: t };
  const neto = Math.round(t / 1.19);
  return { neto, iva: t - neto, total: t };
}

export interface DatosBoleta {
  exenta: boolean;
  emisor: Emisor;
  /** null = consumidor final. */
  receptor: { rut: string; nombre: string | null } | null;
  /** Monto con IVA incluido (lo que pagó el paciente). */
  items: { nombre: string; monto: number }[];
  fecha: string; // AAAA-MM-DD, día de Chile
  medio: string;
}

/** El DTE de una boleta (39 afecta, 41 exenta) en el JSON de OpenFactura. */
export function armarBoleta(b: DatosBoleta): Record<string, unknown> {
  const total = b.items.reduce((s, it) => s + Math.round(it.monto), 0);
  const m = montosBoleta(total, b.exenta);
  // El SII borra algunos caracteres (un "—" desaparece) y corta el nombre en 80.
  const nombreItem = (n: string) => n.replace(/[—–]/g, "-").replace(/\s+/g, " ").trim().slice(0, 80) || "Atención dental";
  return {
    Encabezado: {
      IdDoc: { TipoDTE: b.exenta ? 41 : 39, Folio: 0, FchEmis: b.fecha, IndServicio: 3, MedioPago: medioPagoSii(b.medio) },
      Emisor: {
        RUTEmisor: b.emisor.rut,
        RznSocEmisor: b.emisor.razonSocial.slice(0, 100),
        GiroEmisor: b.emisor.giro.slice(0, 80),
        DirOrigen: b.emisor.direccion.slice(0, 70),
        CmnaOrigen: b.emisor.comuna.slice(0, 20),
        ...(b.emisor.sucursal ? { CdgSIISucur: b.emisor.sucursal } : {}),
      },
      Receptor: b.receptor
        ? { RUTRecep: b.receptor.rut, ...(b.receptor.nombre ? { RznSocRecep: b.receptor.nombre.slice(0, 100) } : {}) }
        : { RUTRecep: RUT_CONSUMIDOR_FINAL },
      Totales: b.exenta
        ? { MntExe: m.total, MntTotal: m.total, TotalPeriodo: m.total, VlrPagar: m.total }
        : { MntNeto: m.neto, IVA: m.iva, MntTotal: m.total, TotalPeriodo: m.total, VlrPagar: m.total },
    },
    Detalle: b.items.map((it, i) => ({
      NroLinDet: i + 1, NmbItem: nombreItem(it.nombre), QtyItem: 1,
      PrcItem: Math.round(it.monto), MontoItem: Math.round(it.monto),
      ...(b.exenta ? { IndExe: 1 } : {}),
    })),
  };
}

/**
 * Emite el DTE. La Idempotency-Key evita una boleta doble: si se repite
 * dentro de 24 h, OpenFactura no emite otra y devuelve el TOKEN de la que ya
 * emitió (OF-06), que se trata como éxito.
 */
export async function emitirDte(apiKey: string, dte: Record<string, unknown>, idempotencyKey: string): Promise<{ token: string; folio: number | null }> {
  try {
    const r = (await pedir(apiKey, "/document", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ response: ["FOLIO"], dte }),
    })) as { TOKEN?: string; FOLIO?: number | string };
    if (!r?.TOKEN) throw new ErrorOpenFactura("OpenFactura respondió sin el número del documento.", null, false);
    return { token: r.TOKEN, folio: r.FOLIO != null ? Number(r.FOLIO) : null };
  } catch (e) {
    const token = e instanceof ErrorOpenFactura && e.codigo === "OF-06" ? e.detalles.find((d) => d.field === "token")?.issue : undefined;
    if (!token) throw e;
    return { token, folio: await folioDe(apiKey, token).catch(() => null) };
  }
}

/** El folio de un documento ya emitido. */
async function folioDe(apiKey: string, token: string): Promise<number | null> {
  const r = (await pedir(apiKey, `/document/${encodeURIComponent(token)}/json`)) as { json?: { Encabezado?: { IdDoc?: { Folio?: unknown } } } };
  const f = r?.json?.Encabezado?.IdDoc?.Folio;
  return f != null && !isNaN(Number(f)) ? Number(f) : null;
}

/** El PDF de un documento emitido. OpenFactura tarda unos minutos en tenerlo listo. */
export async function pdfDe(apiKey: string, token: string): Promise<Buffer> {
  try {
    const r = (await pedir(apiKey, `/document/${encodeURIComponent(token)}/pdf`)) as { pdf?: string };
    if (!r?.pdf) throw new Error("sin pdf");
    return Buffer.from(r.pdf, "base64");
  } catch (e) {
    if (e instanceof ErrorOpenFactura && e.rechazada && !e.codigo) throw e; // API key
    throw new ErrorOpenFactura("OpenFactura todavía está generando el PDF de esta boleta. Intenta de nuevo en unos minutos.", null, false);
  }
}
