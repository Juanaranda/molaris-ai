import prisma from "../../config/prisma";
import { telefonoE164 } from "../../lib/telefono";
import { enviarCodigoPorTelefono, type CanalCodigo } from "../notifications/codigoPorTelefono";
import {
  CODE_TTL_MIN, MAX_ATTEMPTS,
  generarCodigo, hashCodigo, codigoCoincide, esperaParaReenviar,
} from "./codigoVerificacion";
import { marcarContactoVerificado } from "./contactoVerificado";

/**
 * Verificación de la cuenta por teléfono (MOL-52): la alternativa al correo.
 * Basta con uno de los dos. Mismas protecciones que el correo: código
 * hasheado, 5 intentos, 15 minutos y espera entre reenvíos.
 */

export type IssuePhoneResult =
  | { ok: true; expiresAt: Date; canal: CanalCodigo; telefono: string }
  | { ok: false; reason: "invalid_phone" }
  | { ok: false; reason: "cooldown"; retryInSec: number }
  | { ok: false; reason: "already_verified" }
  | { ok: false; reason: "send_failed" }
  | { ok: false; reason: "not_found" };

/** Guarda el celular (normalizado) y le manda un código nuevo. */
export async function issuePhoneCode(userId: string, telefonoCrudo: string): Promise<IssuePhoneResult> {
  const telefono = telefonoE164(telefonoCrudo);
  if (!telefono) return { ok: false, reason: "invalid_phone" };

  const user = await prisma.partnerUser.findUnique({ where: { id: userId } });
  if (!user || !user.active) return { ok: false, reason: "not_found" };
  if (user.phoneVerifiedAt && user.phone === telefono) return { ok: false, reason: "already_verified" };

  const espera = esperaParaReenviar(user.phoneVerifySentAt);
  if (espera > 0) return { ok: false, reason: "cooldown", retryInSec: espera };

  const codigo = generarCodigo();
  const expiresAt = new Date(Date.now() + CODE_TTL_MIN * 60_000);
  await prisma.partnerUser.update({
    where: { id: user.id },
    data: {
      // Un número nuevo deja de estar verificado hasta que llegue su código.
      phone: telefono,
      phoneVerifiedAt: user.phone === telefono ? user.phoneVerifiedAt : null,
      phoneVerifyCodeHash: hashCodigo(codigo),
      phoneVerifyExpiresAt: expiresAt,
      phoneVerifyAttempts: 0,
      phoneVerifySentAt: new Date(),
    },
  });

  const envio = await enviarCodigoPorTelefono(telefono, codigo);
  if (!envio.delivered) {
    // Falla nuestra: sin espera para reintentar.
    await prisma.partnerUser.update({ where: { id: user.id }, data: { phoneVerifySentAt: null } });
    return { ok: false, reason: "send_failed" };
  }
  return { ok: true, expiresAt, canal: envio.canal, telefono };
}

export type VerifyPhoneResult =
  | { ok: true }
  | { ok: false; reason: "no_code" }
  | { ok: false; reason: "expired" }
  | { ok: false; reason: "too_many_attempts" }
  | { ok: false; reason: "invalid"; attemptsLeft: number }
  | { ok: false; reason: "not_found" };

export async function verifyPhoneCode(userId: string, codigo: string): Promise<VerifyPhoneResult> {
  const user = await prisma.partnerUser.findUnique({ where: { id: userId } });
  if (!user || !user.active) return { ok: false, reason: "not_found" };
  if (!user.phoneVerifyCodeHash || !user.phoneVerifyExpiresAt) {
    return user.phoneVerifiedAt ? { ok: true } : { ok: false, reason: "no_code" };
  }
  if (user.phoneVerifyExpiresAt.getTime() < Date.now()) return { ok: false, reason: "expired" };
  if (user.phoneVerifyAttempts >= MAX_ATTEMPTS) return { ok: false, reason: "too_many_attempts" };

  if (!codigoCoincide(codigo, user.phoneVerifyCodeHash)) {
    const u = await prisma.partnerUser.update({
      where: { id: user.id },
      data: { phoneVerifyAttempts: { increment: 1 } },
      select: { phoneVerifyAttempts: true },
    });
    const attemptsLeft = Math.max(0, MAX_ATTEMPTS - u.phoneVerifyAttempts);
    return attemptsLeft === 0 ? { ok: false, reason: "too_many_attempts" } : { ok: false, reason: "invalid", attemptsLeft };
  }

  await prisma.partnerUser.update({
    where: { id: user.id },
    data: { phoneVerifiedAt: new Date(), phoneVerifyCodeHash: null, phoneVerifyExpiresAt: null, phoneVerifyAttempts: 0 },
  });
  await marcarContactoVerificado(user.id);
  return { ok: true };
}
