import { FastifyInstance } from "fastify";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../config/prisma";
import { config } from "../config/env";
import { sendEmail } from "../services/email/emailService";
import { issueVerificationCode, verifyEmailCode } from "../services/auth/emailVerification";
import { emitirTokenPendiente, validarTokenPendiente, consumirCodigoRespaldo } from "../services/auth/twoFactor";
import { verificarCodigo } from "../lib/totp";
import { Prisma } from "@prisma/client";

interface JwtPayload {
  userId: string;
  role: string;
  clinicId: string | null;
}

// Tokens de reset de un solo uso (#60): el token lleva un fragmento HMAC del
// passwordHash vigente al emitirlo. Al cambiar la contraseña cambia el hash,
// por lo que todo token emitido antes deja de validar — sin tocar el esquema.
function passwordFingerprint(passwordHash: string): string {
  return crypto.createHmac("sha256", config.jwtSecret).update(passwordHash).digest("hex").slice(0, 16);
}

export function verifyToken(authHeader: string | undefined): JwtPayload {
  if (!authHeader?.startsWith("Bearer ")) throw new Error("No token");
  return jwt.verify(authHeader.slice(7), config.jwtSecret) as JwtPayload;
}

type UsuarioConClinica = Prisma.PartnerUserGetPayload<{ include: { clinic: true } }>;

/**
 * La respuesta de sesión, una sola vez.
 *
 * El login normal y el segundo paso del 2FA tienen que devolver exactamente lo
 * mismo: si se escriben por separado, el front termina viendo una sesión a
 * medias según por dónde entró.
 */
function construirSesion(user: UsuarioConClinica) {
  const token = jwt.sign(
    { userId: user.id, role: user.role, clinicId: user.clinicId },
    config.jwtSecret,
    { expiresIn: "7d" }
  );

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      clinicId: user.clinicId,
      mustChangePassword: user.mustChangePassword,
      emailVerified: user.emailVerifiedAt !== null,
      totpEnabled: user.totpEnabled,
    },
    clinic: user.clinic ? {
      id:       user.clinic.id,
      slug:     user.clinic.slug,
      name:     user.clinic.name,
      plan:     user.clinic.plan,
      active:   user.clinic.active,
      phone:    user.clinic.phone,
      whatsapp: user.clinic.whatsapp,
      instagram: user.clinic.instagram,
      location: user.clinic.location,
      config:   user.clinic.config,
      accountType: user.clinic.accountType,
      verificationStatus: user.clinic.verificationStatus,
      rejectionReason:    user.clinic.rejectionReason,
    } : null,
  };
}

export async function authRoutes(app: FastifyInstance) {
  // POST /api/auth/login
  app.post<{ Body: { email: string; password: string } }>("/auth/login", async (req, reply) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return reply.status(400).send({ error: "Email y contraseña requeridos" });
    }

    const user = await prisma.partnerUser.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { clinic: true },
    });

    if (!user || !user.active) {
      return reply.status(401).send({ error: "Credenciales incorrectas" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: "Credenciales incorrectas" });
    }

    // Con segundo factor activo la contraseña sola no abre sesión: se entrega
    // un token intermedio, corto y firmado con otra clave, que solo sirve para
    // canjear el código en /auth/login/2fa.
    if (user.totpEnabled) {
      return reply.send({
        requiere2FA: true,
        pendingToken: emitirTokenPendiente(user.id),
      });
    }

    return reply.send(construirSesion(user));
  });

  // POST /api/auth/login/2fa — segundo paso del login (#68).
  app.post<{ Body: { pendingToken: string; codigo: string } }>("/auth/login/2fa", async (req, reply) => {
    const { pendingToken, codigo } = req.body ?? {};

    const userId = validarTokenPendiente(pendingToken);
    if (!userId) {
      return reply.status(401).send({ error: "La sesión expiró. Vuelve a ingresar tu contraseña." });
    }

    const user = await prisma.partnerUser.findUnique({ where: { id: userId }, include: { clinic: true } });
    if (!user || !user.active || !user.totpEnabled || !user.totpSecret) {
      return reply.status(401).send({ error: "No autorizado" });
    }

    const r = verificarCodigo(user.totpSecret, codigo, { ultimoPaso: user.totpLastStep });
    if (r.valido) {
      // Se registra la ventana usada para que ese mismo código no entre otra vez.
      await prisma.partnerUser.update({ where: { id: user.id }, data: { totpLastStep: r.paso } });
      return reply.send(construirSesion(user));
    }

    // Si no calzó el código de la app, puede ser uno de respaldo — el caso de
    // "perdí el teléfono", que es justamente cuando más se necesita entrar.
    const respaldo = await consumirCodigoRespaldo(codigo, user.totpBackupCodes);
    if (respaldo.valido) {
      await prisma.partnerUser.update({
        where: { id: user.id },
        data: { totpBackupCodes: respaldo.restantes },
      });
      return reply.send({ ...construirSesion(user), codigosRespaldoRestantes: respaldo.restantes.length });
    }

    return reply.status(401).send({ error: "Código incorrecto" });
  });

  // POST /api/auth/forgot-password — manda link de recuperación (Issue #55)
  app.post<{ Body: { email: string } }>("/auth/forgot-password", async (req, reply) => {
    const email = req.body?.email?.toLowerCase().trim();
    // Responder 200 SIEMPRE (no filtrar si el email existe o no)
    if (email) {
      const user = await prisma.partnerUser.findUnique({ where: { email } });
      if (user && user.active) {
        const token = jwt.sign(
          { userId: user.id, type: "reset", pwf: passwordFingerprint(user.passwordHash) },
          config.jwtSecret,
          { expiresIn: "1h" }
        );
        const link = `${config.frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;
        await sendEmail({
          to: user.email,
          subject: "Recupera tu contraseña — molari.ai",
          html: `<p>Hola ${user.name},</p>
<p>Recibimos una solicitud para restablecer tu contraseña. Haz clic en el botón (el enlace expira en 1 hora):</p>
<p><a href="${link}" style="background:#1A5C7A;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none;font-weight:bold">Crear nueva contraseña</a></p>
<p>O copia este enlace: <br>${link}</p>
<p style="color:#888">Si no pediste esto, ignora este correo — tu contraseña no cambió.</p>`,
          text: `Hola ${user.name}, restablece tu contraseña acá (expira en 1h): ${link}`,
        });
      }
    }
    return reply.send({ ok: true });
  });

  // POST /api/auth/reset-password — fija nueva contraseña con el token del email
  app.post<{ Body: { token: string; newPassword: string } }>("/auth/reset-password", async (req, reply) => {
    const { token, newPassword } = req.body ?? {};
    if (!token || !newPassword) return reply.status(400).send({ error: "Token y nueva contraseña requeridos" });
    if (newPassword.length < 8) return reply.status(400).send({ error: "La contraseña debe tener al menos 8 caracteres" });

    let payload: { userId: string; type: string; pwf?: string };
    try {
      payload = jwt.verify(token, config.jwtSecret) as { userId: string; type: string; pwf?: string };
      if (payload.type !== "reset") throw new Error("tipo inválido");
    } catch {
      return reply.status(400).send({ error: "El enlace es inválido o expiró. Pide uno nuevo." });
    }

    const user = await prisma.partnerUser.findUnique({ where: { id: payload.userId } });
    if (!user || !user.active) return reply.status(400).send({ error: "Usuario no encontrado" });

    // Un solo uso (#60): si la contraseña cambió después de emitir el token
    // (por este mismo flujo o por change-password), el fingerprint ya no calza.
    if (payload.pwf !== passwordFingerprint(user.passwordHash)) {
      return reply.status(400).send({ error: "El enlace ya fue usado o expiró. Pide uno nuevo." });
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await prisma.partnerUser.update({
      where: { id: user.id },
      data:  { passwordHash: hash, mustChangePassword: false },
    });
    return reply.send({ ok: true });
  });

  // POST /api/auth/change-password
  app.post<{ Body: { currentPassword: string; newPassword: string } }>(
    "/auth/change-password",
    async (req, reply) => {
      let payload: JwtPayload;
      try { payload = verifyToken(req.headers.authorization); }
      catch { return reply.status(401).send({ error: "No autorizado" }); }

      const { currentPassword, newPassword } = req.body ?? {};
      if (!currentPassword || !newPassword) {
        return reply.status(400).send({ error: "Contraseña actual y nueva son requeridas" });
      }
      if (newPassword.length < 8) {
        return reply.status(400).send({ error: "La nueva contraseña debe tener al menos 8 caracteres" });
      }
      if (newPassword === currentPassword) {
        return reply.status(400).send({ error: "La nueva contraseña debe ser distinta a la actual" });
      }

      const user = await prisma.partnerUser.findUnique({ where: { id: payload.userId } });
      if (!user || !user.active) return reply.status(401).send({ error: "No autorizado" });

      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) return reply.status(401).send({ error: "Contraseña actual incorrecta" });

      const newHash = await bcrypt.hash(newPassword, 12);
      await prisma.partnerUser.update({
        where: { id: user.id },
        data:  { passwordHash: newHash, mustChangePassword: false },
      });

      return reply.send({ ok: true });
    }
  );

  // POST /api/auth/send-verification — (re)envía el código de 6 dígitos al correo
  app.post("/auth/send-verification", async (req, reply) => {
    let payload: JwtPayload;
    try { payload = verifyToken(req.headers.authorization); }
    catch { return reply.status(401).send({ error: "No autorizado" }); }

    const result = await issueVerificationCode(payload.userId);
    if (result.ok) return reply.send({ ok: true, expiresAt: result.expiresAt });

    switch (result.reason) {
      case "already_verified":
        return reply.send({ ok: true, alreadyVerified: true });
      case "cooldown":
        return reply.status(429).send({
          error: `Espera ${result.retryInSec} segundos antes de pedir otro código.`,
          retryInSec: result.retryInSec,
        });
      case "send_failed":
        return reply.status(502).send({
          error: "No pudimos enviar el correo. Reintenta en un momento o escríbenos si sigue fallando.",
        });
      case "not_found":
        return reply.status(401).send({ error: "No autorizado" });
    }
  });

  // POST /api/auth/verify-email — confirma el código
  app.post<{ Body: { code: string } }>("/auth/verify-email", async (req, reply) => {
    let payload: JwtPayload;
    try { payload = verifyToken(req.headers.authorization); }
    catch { return reply.status(401).send({ error: "No autorizado" }); }

    const code = req.body?.code?.trim();
    if (!code || !/^\d{6}$/.test(code)) {
      return reply.status(400).send({ error: "Ingresa el código de 6 dígitos que te enviamos." });
    }

    const result = await verifyEmailCode(payload.userId, code);
    if (result.ok) return reply.send({ ok: true });

    switch (result.reason) {
      case "invalid":
        return reply.status(400).send({
          error: `Código incorrecto. Te quedan ${result.attemptsLeft} ${result.attemptsLeft === 1 ? "intento" : "intentos"}.`,
          attemptsLeft: result.attemptsLeft,
        });
      case "expired":
        return reply.status(400).send({ error: "El código expiró. Pide uno nuevo.", needsNewCode: true });
      case "too_many_attempts":
        return reply.status(429).send({ error: "Demasiados intentos fallidos. Pide un código nuevo.", needsNewCode: true });
      case "no_code":
        return reply.status(400).send({ error: "No hay un código pendiente. Pide uno nuevo.", needsNewCode: true });
      case "not_found":
        return reply.status(401).send({ error: "No autorizado" });
    }
  });

  // GET /api/auth/me
  app.get("/auth/me", async (req, reply) => {
    let payload: JwtPayload;
    try {
      payload = verifyToken(req.headers.authorization);
    } catch {
      return reply.status(401).send({ error: "No autorizado" });
    }

    const user = await prisma.partnerUser.findUnique({
      where: { id: payload.userId },
      include: { clinic: true },
    });

    if (!user || !user.active) {
      return reply.status(401).send({ error: "No autorizado" });
    }

    return reply.send({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        clinicalRole: user.clinicalRole,
        clinicId: user.clinicId,
        mustChangePassword: user.mustChangePassword,
        emailVerified: user.emailVerifiedAt !== null,
        photoUrl:   user.photoUrl,
        occupation: user.occupation,
        phone:      user.phone,
        bio:        user.bio,
      },
      clinic: user.clinic ? {
        id:       user.clinic.id,
        slug:     user.clinic.slug,
        name:     user.clinic.name,
        plan:     user.clinic.plan,
        active:   user.clinic.active,
        phone:    user.clinic.phone,
        whatsapp: user.clinic.whatsapp,
        instagram: user.clinic.instagram,
        location: user.clinic.location,
        config:   user.clinic.config,
        accountType: user.clinic.accountType,
        verificationStatus: user.clinic.verificationStatus,
        rejectionReason:    user.clinic.rejectionReason,
      } : null,
    });
  });

  // PATCH /api/auth/me — actualizar el propio perfil
  app.patch<{
    Body: {
      name?: string;
      photoUrl?: string | null;
      occupation?: string | null;
      phone?: string | null;
      bio?: string | null;
    };
  }>("/auth/me", async (req, reply) => {
    let payload: JwtPayload;
    try {
      payload = verifyToken(req.headers.authorization);
    } catch {
      return reply.status(401).send({ error: "No autorizado" });
    }

    const { name, photoUrl, occupation, phone, bio } = req.body ?? {};

    // Validaciones de tamaño
    if (typeof photoUrl === "string" && photoUrl.length > 850_000) {
      return reply.status(400).send({ error: "La foto es demasiado grande (máx 600 KB)" });
    }
    if (typeof bio === "string" && bio.length > 500) {
      return reply.status(400).send({ error: "Bio supera el máximo de 500 caracteres" });
    }
    if (typeof name === "string" && name.trim().length === 0) {
      return reply.status(400).send({ error: "El nombre no puede estar vacío" });
    }

    const updated = await prisma.partnerUser.update({
      where: { id: payload.userId },
      data: {
        ...(name       !== undefined && { name: name.trim() }),
        ...(photoUrl   !== undefined && { photoUrl }),
        ...(occupation !== undefined && { occupation }),
        ...(phone      !== undefined && { phone }),
        ...(bio        !== undefined && { bio }),
      },
    });

    return reply.send({
      id:         updated.id,
      name:       updated.name,
      email:      updated.email,
      role:       updated.role,
      clinicId:   updated.clinicId,
      photoUrl:   updated.photoUrl,
      occupation: updated.occupation,
      phone:      updated.phone,
      bio:        updated.bio,
    });
  });
}
