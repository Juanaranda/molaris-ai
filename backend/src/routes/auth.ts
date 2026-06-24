import { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../config/prisma";
import { config } from "../config/env";

interface JwtPayload {
  userId: string;
  role: string;
  clinicId: string | null;
}

export function verifyToken(authHeader: string | undefined): JwtPayload {
  if (!authHeader?.startsWith("Bearer ")) throw new Error("No token");
  return jwt.verify(authHeader.slice(7), config.jwtSecret) as JwtPayload;
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

    const token = jwt.sign(
      { userId: user.id, role: user.role, clinicId: user.clinicId },
      config.jwtSecret,
      { expiresIn: "7d" }
    );

    return reply.send({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        clinicId: user.clinicId,
        mustChangePassword: user.mustChangePassword,
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
      } : null,
    });
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
