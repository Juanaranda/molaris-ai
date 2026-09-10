import { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import prisma from "../config/prisma";
import { verifyToken } from "./auth";
import { generarSecreto, urlOtpauth, verificarCodigo, generarCodigosRespaldo } from "../lib/totp";
import { hashearCodigosRespaldo } from "../services/auth/twoFactor";

/**
 * Activar y desactivar el segundo factor (#68).
 *
 * Va aparte de auth.ts para no seguir engordándolo. El login en dos pasos sí
 * vive allá, porque es parte del login.
 *
 * Todo es opt-in: el issue lo pide explícitamente para no frenar el onboarding.
 */
export async function twoFactorRoutes(app: FastifyInstance) {

  function usuarioDe(req: { headers: { authorization?: string } }): string | null {
    try { return verifyToken(req.headers.authorization).userId; } catch { return null; }
  }

  // GET /api/auth/2fa — estado, para pintar la sección de Configuración.
  app.get("/auth/2fa", async (req, reply) => {
    const userId = usuarioDe(req);
    if (!userId) return reply.status(401).send({ error: "No autorizado" });

    const user = await prisma.partnerUser.findUnique({
      where: { id: userId },
      select: { totpEnabled: true, totpBackupCodes: true },
    });
    if (!user) return reply.status(401).send({ error: "No autorizado" });

    return reply.send({
      activo: user.totpEnabled,
      codigosRespaldoRestantes: user.totpBackupCodes.length,
    });
  });

  // POST /api/auth/2fa/setup — genera el secreto y devuelve el otpauth para el QR.
  app.post("/auth/2fa/setup", async (req, reply) => {
    const userId = usuarioDe(req);
    if (!userId) return reply.status(401).send({ error: "No autorizado" });

    const user = await prisma.partnerUser.findUnique({
      where: { id: userId },
      select: { email: true, totpEnabled: true },
    });
    if (!user) return reply.status(401).send({ error: "No autorizado" });

    // Regenerar el secreto de alguien que ya lo tiene activo lo dejaría afuera
    // en silencio: primero desactiva, después vuelve a configurar.
    if (user.totpEnabled) {
      return reply.status(409).send({ error: "Ya tienes el segundo factor activo. Desactívalo antes de configurarlo de nuevo." });
    }

    const secret = generarSecreto();
    // Se guarda sin activar: recién sirve cuando el usuario prueba que su app
    // genera el código correcto, en /enable.
    await prisma.partnerUser.update({
      where: { id: userId },
      data: { totpSecret: secret, totpLastStep: null },
    });

    return reply.send({
      secret,
      otpauthUrl: urlOtpauth({ secret, cuenta: user.email }),
    });
  });

  // POST /api/auth/2fa/enable — confirma con un código y lo activa.
  app.post<{ Body: { codigo: string } }>("/auth/2fa/enable", async (req, reply) => {
    const userId = usuarioDe(req);
    if (!userId) return reply.status(401).send({ error: "No autorizado" });

    const user = await prisma.partnerUser.findUnique({
      where: { id: userId },
      select: { totpSecret: true, totpEnabled: true },
    });
    if (!user?.totpSecret) {
      return reply.status(400).send({ error: "Primero configura el segundo factor." });
    }
    if (user.totpEnabled) {
      return reply.status(409).send({ error: "El segundo factor ya está activo." });
    }

    const r = verificarCodigo(user.totpSecret, req.body?.codigo ?? "");
    if (!r.valido) {
      // Exigir un código válido antes de activar es lo que evita dejar a alguien
      // fuera de su cuenta por haber escaneado mal el QR.
      return reply.status(400).send({ error: "Ese código no coincide. Revisa que la hora del teléfono esté correcta." });
    }

    const codigos = generarCodigosRespaldo();
    await prisma.partnerUser.update({
      where: { id: userId },
      data: {
        totpEnabled: true,
        totpLastStep: r.paso,
        totpBackupCodes: await hashearCodigosRespaldo(codigos),
      },
    });

    // Única vez que se ven en claro: después solo quedan los hashes.
    return reply.send({ activo: true, codigosRespaldo: codigos });
  });

  // POST /api/auth/2fa/disable — pide contraseña y código, y lo apaga.
  app.post<{ Body: { password: string; codigo: string } }>("/auth/2fa/disable", async (req, reply) => {
    const userId = usuarioDe(req);
    if (!userId) return reply.status(401).send({ error: "No autorizado" });

    const user = await prisma.partnerUser.findUnique({
      where: { id: userId },
      select: { passwordHash: true, totpSecret: true, totpEnabled: true, totpLastStep: true },
    });
    if (!user?.totpEnabled || !user.totpSecret) {
      return reply.status(400).send({ error: "No tienes el segundo factor activo." });
    }

    // Se piden las dos cosas: con la sesión robada pero sin contraseña, o con la
    // contraseña pero sin el teléfono, no se puede bajar la protección.
    const passOk = await bcrypt.compare(req.body?.password ?? "", user.passwordHash);
    if (!passOk) return reply.status(401).send({ error: "Contraseña incorrecta" });

    const r = verificarCodigo(user.totpSecret, req.body?.codigo ?? "", { ultimoPaso: user.totpLastStep });
    if (!r.valido) return reply.status(400).send({ error: "Código incorrecto" });

    await prisma.partnerUser.update({
      where: { id: userId },
      data: { totpEnabled: false, totpSecret: null, totpLastStep: null, totpBackupCodes: [] },
    });

    return reply.send({ activo: false });
  });
}
