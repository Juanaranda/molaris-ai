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
      },
      clinic: user.clinic,
    });
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
        clinicId: user.clinicId,
      },
      clinic: user.clinic,
    });
  });
}
