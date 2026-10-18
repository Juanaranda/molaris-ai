import prisma from "../../config/prisma";
import { sendMolariEmail } from "../email/molariEmails";
import {
  CODE_TTL_MIN, MAX_ATTEMPTS, RESEND_COOLDOWN_SEC,
  generarCodigo, hashCodigo, codigoCoincide, esperaParaReenviar,
} from "./codigoVerificacion";
import { marcarContactoVerificado } from "./contactoVerificado";

/**
 * Verificación de correo por código de 6 dígitos (#66). Lo común con la
 * verificación por teléfono (hash, intentos, expiración) vive en
 * codigoVerificacion.ts.
 */

export { CODE_TTL_MIN, MAX_ATTEMPTS, RESEND_COOLDOWN_SEC };

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

  const espera = esperaParaReenviar(user.emailVerifySentAt);
  if (espera > 0) return { ok: false, reason: "cooldown", retryInSec: espera };

  const code = generarCodigo();
  const expiresAt = new Date(Date.now() + CODE_TTL_MIN * 60_000);

  await prisma.partnerUser.update({
    where: { id: user.id },
    data: {
      emailVerifyCodeHash: hashCodigo(code),
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

  const match = codigoCoincide(code, user.emailVerifyCodeHash);

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
  await marcarContactoVerificado(user.id);

  return { ok: true };
}
