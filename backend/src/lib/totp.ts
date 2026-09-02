import crypto from "node:crypto";

/**
 * TOTP (RFC 6238) para el segundo factor de los admins (#68).
 *
 * Va implementado con `crypto` y no con una dependencia porque son ~60 líneas
 * de algoritmo cerrado y con vectores de prueba oficiales: se puede demostrar
 * que está bien. Sumar un paquete de terceros al camino del login es más
 * superficie de la que ahorra.
 *
 * Compatible con Google Authenticator, Authy y 1Password: HMAC-SHA1, 6 dígitos,
 * ventanas de 30 segundos, que es lo que asumen por defecto.
 */

const ALFABETO_B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export const PERIODO_SEGUNDOS = 30;
export const DIGITOS = 6;

/**
 * Cuántas ventanas hacia atrás y adelante se aceptan.
 *
 * 1 = ±30 segundos. Cubre el reloj corrido del teléfono y al usuario que tipea
 * el código justo cuando cambia, sin ampliar de más el margen para adivinarlo.
 */
export const VENTANA = 1;

export function base32Encode(buf: Buffer): string {
  let bits = 0, valor = 0, salida = "";
  for (const byte of buf) {
    valor = (valor << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      salida += ALFABETO_B32[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) salida += ALFABETO_B32[(valor << (5 - bits)) & 31];
  return salida;
}

export function base32Decode(texto: string): Buffer {
  // Se toleran espacios y minúsculas: la gente copia el secreto a mano desde la
  // pantalla, y el "=" de relleno sobra en otpauth.
  const limpio = texto.toUpperCase().replace(/[\s-]/g, "").replace(/=+$/, "");
  let bits = 0, valor = 0;
  const bytes: number[] = [];
  for (const c of limpio) {
    const i = ALFABETO_B32.indexOf(c);
    if (i === -1) throw new Error("Secreto inválido: no es base32");
    valor = (valor << 5) | i;
    bits += 5;
    if (bits >= 8) {
      bytes.push((valor >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** Secreto nuevo. 20 bytes es el largo que recomienda el RFC 4226 para SHA1. */
export function generarSecreto(bytes = 20): string {
  return base32Encode(crypto.randomBytes(bytes));
}

/** En qué ventana de 30 segundos cae un instante. */
export function pasoDe(t: Date | number, periodo = PERIODO_SEGUNDOS): number {
  const segundos = Math.floor((t instanceof Date ? t.getTime() : t) / 1000);
  return Math.floor(segundos / periodo);
}

/** El código de un paso concreto. Separado para poder probar los vectores. */
export function codigoDelPaso(secretBase32: string, paso: number, digitos = DIGITOS): string {
  const clave = base32Decode(secretBase32);

  // El contador va como entero de 64 bits big-endian.
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(paso));

  const hmac = crypto.createHmac("sha1", clave).update(contador).digest();

  // Truncado dinámico del RFC 4226: los 4 bits bajos del último byte dicen
  // desde dónde leer los 4 bytes que se convierten en el código.
  const desplazamiento = hmac[hmac.length - 1] & 0x0f;
  const binario =
    ((hmac[desplazamiento] & 0x7f) << 24) |
    ((hmac[desplazamiento + 1] & 0xff) << 16) |
    ((hmac[desplazamiento + 2] & 0xff) << 8) |
    (hmac[desplazamiento + 3] & 0xff);

  return String(binario % 10 ** digitos).padStart(digitos, "0");
}

/** El código vigente ahora. */
export function generarCodigo(secretBase32: string, t: Date = new Date(), digitos = DIGITOS): string {
  return codigoDelPaso(secretBase32, pasoDe(t), digitos);
}

export interface ResultadoTOTP {
  valido: boolean;
  /** Ventana que calzó. Se guarda para no dejar reusar el mismo código. */
  paso: number | null;
}

/**
 * Valida un código contra las ventanas vecinas.
 *
 * `ultimoPaso` es el del último código aceptado para este usuario: cualquier
 * paso igual o anterior se rechaza. Sin eso, alguien que ve el código por
 * encima del hombro lo puede reusar durante el minuto que sigue valiendo.
 */
export function verificarCodigo(
  secretBase32: string,
  codigo: string,
  opciones: { t?: Date; ventana?: number; ultimoPaso?: number | null } = {},
): ResultadoTOTP {
  const { t = new Date(), ventana = VENTANA, ultimoPaso = null } = opciones;

  const limpio = (codigo ?? "").replace(/\s/g, "");
  if (!/^\d+$/.test(limpio) || limpio.length !== DIGITOS) return { valido: false, paso: null };

  const actual = pasoDe(t);
  for (let d = -ventana; d <= ventana; d++) {
    const paso = actual + d;
    if (ultimoPaso !== null && paso <= ultimoPaso) continue; // ya se usó
    const esperado = codigoDelPaso(secretBase32, paso);
    // Comparación de tiempo constante: comparar strings con === filtra por el
    // primer dígito distinto y filtra tiempo.
    const a = Buffer.from(esperado), b = Buffer.from(limpio);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      return { valido: true, paso };
    }
  }
  return { valido: false, paso: null };
}

/** URL otpauth:// que el front convierte en QR. */
export function urlOtpauth({ secret, cuenta, emisor = "molari.ai" }: {
  secret: string; cuenta: string; emisor?: string;
}): string {
  const etiqueta = encodeURIComponent(`${emisor}:${cuenta}`);
  const params = new URLSearchParams({
    secret,
    issuer: emisor,
    algorithm: "SHA1",
    digits: String(DIGITOS),
    period: String(PERIODO_SEGUNDOS),
  });
  return `otpauth://totp/${etiqueta}?${params.toString()}`;
}

/**
 * Códigos de respaldo, para cuando se pierde el teléfono.
 *
 * Se devuelven en claro una sola vez y se guardan hasheados: si la base se
 * filtra, no sirven para entrar. Formato agrupado porque se copian a mano.
 */
export function generarCodigosRespaldo(cantidad = 8): string[] {
  return Array.from({ length: cantidad }, () => {
    const n = crypto.randomInt(0, 1_0000_0000).toString().padStart(8, "0");
    return `${n.slice(0, 4)}-${n.slice(4)}`;
  });
}
