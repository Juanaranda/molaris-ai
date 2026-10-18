import crypto from "crypto";
import { config } from "../../config/env";

/**
 * Lo común a los códigos de verificación de 6 dígitos, por correo o por
 * teléfono (#66, MOL-52).
 *
 * El código nunca se guarda en claro: se almacena un HMAC-SHA256 con el
 * jwtSecret. Con solo un millón de combinaciones posibles, lo que protege la
 * cuenta no es el largo del código sino el límite de intentos y la expiración
 * — por eso ambos son parte del contrato, no un extra.
 */

export const CODE_TTL_MIN = 15;
export const MAX_ATTEMPTS = 5;
export const RESEND_COOLDOWN_SEC = 60;

export function hashCodigo(codigo: string): string {
  return crypto.createHmac("sha256", config.jwtSecret).update(codigo).digest("hex");
}

/** randomInt es criptográficamente seguro; Math.random() no serviría acá. */
export function generarCodigo(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Compara en tiempo constante, para no filtrar por cuánto tarda. */
export function codigoCoincide(codigo: string, hashGuardado: string): boolean {
  const dado = hashCodigo(codigo.trim());
  return dado.length === hashGuardado.length &&
    crypto.timingSafeEqual(Buffer.from(dado, "hex"), Buffer.from(hashGuardado, "hex"));
}

/** Segundos que faltan para poder reenviar, o 0 si ya se puede. */
export function esperaParaReenviar(enviadoEn: Date | null, ahora = Date.now()): number {
  if (!enviadoEn) return 0;
  const transcurrido = (ahora - enviadoEn.getTime()) / 1000;
  return transcurrido < RESEND_COOLDOWN_SEC ? Math.ceil(RESEND_COOLDOWN_SEC - transcurrido) : 0;
}
