import crypto from "crypto";
import prisma from "../../config/prisma";
import { config } from "../../config/env";
import { sendMolariEmail } from "../email/molariEmails";

/**
 * Verificación de correo por código de 6 dígitos (#66).
 *
 * El código nunca se guarda en claro: se almacena un HMAC-SHA256 con el
 * jwtSecret. Con solo un millón de combinaciones posibles, lo que protege la
 * cuenta no es el largo del código sino el límite de intentos y la expiración
 * — por eso ambos son parte del contrato, no un extra.
 */

export const CODE_TTL_MIN = 15;
export const MAX_ATTEMPTS = 5;
export const RESEND_COOLDOWN_SEC = 60;

function hashCode(code: string): string {
  return crypto.createHmac("sha256", config.jwtSecret).update(code).digest("hex");
}

function generateCode(): string {
  // randomInt es criptográficamente seguro; Math.random() no serviría acá.
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

export type IssueResult =
  | { ok: true; expiresAt: Date }
  | { ok: false; reason: "cooldown"; retryInSec: number }
  | { ok: false; reason: "already_verified" }
  | { ok: false; reason: "send_failed" }
  | { ok: false; reason: "not_found" };

/**
 * Genera y envía un código nuevo. Invalida cualquier código anterior del mismo
 * usuario (se sobrescribe el hash), así un reenvío deja inservible al primero.
 */
export async function issueVerificationCode(userId: string): Promise<IssueResult> {
  const user = await prisma.partnerUser.findUnique({ where: { id: userId } });
  if (!user || !user.active) return { ok: false, reason: "not_found" };
  if (user.emailVerifiedAt) return { ok: false, reason: "already_verified" };

  if (user.emailVerifySentAt) {
    const elapsedSec = (Date.now() - user.emailVerifySentAt.getTime()) / 1000;
    if (elapsedSec < RESEND_COOLDOWN_SEC) {
      return { ok: false, reason: "cooldown", retryInSec: Math.ceil(RESEND_COOLDOWN_SEC - elapsedSec) };
    }
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MIN * 60_000);

  await prisma.partnerUser.update({
    where: { id: user.id },
    data: {
      emailVerifyCodeHash: hashCode(code),
      emailVerifyExpiresAt: expiresAt,
      emailVerifyAttempts: 0,
      emailVerifySentAt: new Date(),
    },
  });

  const { delivered } = await sendMolariEmail({
    to: user.email,
    toName: user.name,
    message: { type: "verify_email", code, minutes: CODE_TTL_MIN },
  });

  if (!delivered) {
    // Se borra el sentAt para que el cooldown no castigue por una falla nuestra:
    // el usuario puede reintentar de inmediato. El hash queda, por si el correo
    // igual llegó (Resend pudo fallar después de encolarlo).
    await prisma.partnerUser.update({
      where: { id: user.id },
      data: { emailVerifySentAt: null },
    });
    return { ok: false, reason: "send_failed" };
  }

  return { ok: true, expiresAt };
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "already_verified" }
  | { ok: false; reason: "no_code" }
  | { ok: false; reason: "expired" }
  | { ok: false; reason: "too_many_attempts" }
  | { ok: false; reason: "invalid"; attemptsLeft: number }
  | { ok: false; reason: "not_found" };

export async function verifyEmailCode(userId: string, code: string): Promise<VerifyResult> {
  const user = await prisma.partnerUser.findUnique({ where: { id: userId } });
  if (!user || !user.active) return { ok: false, reason: "not_found" };
  if (user.emailVerifiedAt) return { ok: true };
  if (!user.emailVerifyCodeHash || !user.emailVerifyExpiresAt) return { ok: false, reason: "no_code" };
  if (user.emailVerifyExpiresAt.getTime() < Date.now()) return { ok: false, reason: "expired" };
  if (user.emailVerifyAttempts >= MAX_ATTEMPTS) return { ok: false, reason: "too_many_attempts" };

  const given = hashCode(code.trim());
  const expected = user.emailVerifyCodeHash;
  // timingSafeEqual exige buffers del mismo largo; ambos son hex de sha256, así
  // que el largo siempre calza — pero se compara igual para no filtrar por tiempo.
  const match =
    given.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(given, "hex"), Buffer.from(expected, "hex"));

  if (!match) {
    const updated = await prisma.partnerUser.update({
      where: { id: user.id },
      data: { emailVerifyAttempts: { increment: 1 } },
      select: { emailVerifyAttempts: true },
    });
    const attemptsLeft = Math.max(0, MAX_ATTEMPTS - updated.emailVerifyAttempts);
    if (attemptsLeft === 0) return { ok: false, reason: "too_many_attempts" };
    return { ok: false, reason: "invalid", attemptsLeft };
  }

  // Verificado: se limpia el código para que no quede reutilizable.
  await prisma.partnerUser.update({
    where: { id: user.id },
    data: {
      emailVerifiedAt: new Date(),
      emailVerifyCodeHash: null,
      emailVerifyExpiresAt: null,
      emailVerifyAttempts: 0,
    },
  });

  return { ok: true };
}
