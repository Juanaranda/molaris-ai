import { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../config/prisma";
import { config } from "../config/env";

export interface PatientJwtPayload {
  patientUserId: string;
  identityId: string;
  clinicId: string;
  type: "patient";
}

export function verifyPatientToken(authHeader: string | undefined): PatientJwtPayload {
  if (!authHeader?.startsWith("Bearer ")) throw new Error("No token");
  const payload = jwt.verify(authHeader.slice(7), config.jwtSecret) as PatientJwtPayload;
  if (payload.type !== "patient") throw new Error("Token type mismatch");
  return payload;
}

function issueToken(patientUserId: string, identityId: string, clinicId: string): string {
  return jwt.sign(
    { patientUserId, identityId, clinicId, type: "patient" } satisfies PatientJwtPayload,
    config.jwtSecret,
    { expiresIn: "30d" }
  );
}

export async function patientAuthRoutes(app: FastifyInstance) {

  // POST /api/auth/patient/register
  app.post<{
    Body: {
      rut: string;
      firstName: string;
      lastName: string;
      email?: string;
      phone?: string;
      password: string;
      clinicSlug: string;
    };
  }>("/auth/patient/register", async (req, reply) => {
    const { rut, firstName, lastName, email, phone, password, clinicSlug } = req.body ?? {};

    if (!rut || !firstName || !lastName || !password || !clinicSlug) {
      return reply.status(400).send({ error: "Faltan campos requeridos" });
    }
    if (password.length < 6) {
      return reply.status(400).send({ error: "La contraseña debe tener al menos 6 caracteres" });
    }

    const clinic = await prisma.clinic.findUnique({ where: { slug: clinicSlug } });
    if (!clinic || !clinic.active) {
      return reply.status(404).send({ error: "Clínica no encontrada" });
    }

    // Buscar o crear Identity por RUT
    let identity = await prisma.identity.findUnique({ where: { rut: rut.trim().toUpperCase() } });

    if (!identity) {
      // Si el email ya existe en otra identidad, error
      if (email) {
        const emailTaken = await prisma.identity.findUnique({ where: { email: email.toLowerCase().trim() } });
        if (emailTaken) {
          return reply.status(409).send({ error: "El email ya está registrado con otro RUT" });
        }
      }
      identity = await prisma.identity.create({
        data: {
          rut: rut.trim().toUpperCase(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email ? email.toLowerCase().trim() : undefined,
          phone: phone?.trim(),
        },
      });
    }

    // Verificar que no exista ya un PatientUser para esta clínica
    const existing = await prisma.patientUser.findUnique({
      where: { identityId_clinicId: { identityId: identity.id, clinicId: clinic.id } },
    });
    if (existing) {
      return reply.status(409).send({ error: "Ya tienes una cuenta en esta clínica. Inicia sesión." });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const patientUser = await prisma.patientUser.create({
      data: { identityId: identity.id, clinicId: clinic.id, passwordHash },
    });

    const token = issueToken(patientUser.id, identity.id, clinic.id);
    return reply.status(201).send({
      token,
      patient: {
        id: patientUser.id,
        firstName: identity.firstName,
        lastName: identity.lastName,
        rut: identity.rut,
        email: identity.email,
        clinicId: clinic.id,
      },
    });
  });


  // POST /api/auth/patient/login
  app.post<{ Body: { rut?: string; email?: string; password: string; clinicSlug: string } }>(
    "/auth/patient/login",
    async (req, reply) => {
      const { rut, email, password, clinicSlug } = req.body ?? {};

      if ((!rut && !email) || !password || !clinicSlug) {
        return reply.status(400).send({ error: "Faltan campos requeridos" });
      }

      const clinic = await prisma.clinic.findUnique({ where: { slug: clinicSlug } });
      if (!clinic || !clinic.active) {
        return reply.status(404).send({ error: "Clínica no encontrada" });
      }

      const identity = rut
        ? await prisma.identity.findUnique({ where: { rut: rut.trim().toUpperCase() } })
        : await prisma.identity.findUnique({ where: { email: email!.toLowerCase().trim() } });

      if (!identity) {
        return reply.status(401).send({ error: "Credenciales incorrectas" });
      }

      const patientUser = await prisma.patientUser.findUnique({
        where: { identityId_clinicId: { identityId: identity.id, clinicId: clinic.id } },
      });

      if (!patientUser || !patientUser.active || !patientUser.passwordHash) {
        return reply.status(401).send({ error: "Credenciales incorrectas" });
      }

      const valid = await bcrypt.compare(password, patientUser.passwordHash);
      if (!valid) {
        return reply.status(401).send({ error: "Credenciales incorrectas" });
      }

      await prisma.patientUser.update({
        where: { id: patientUser.id },
        data: { lastVisit: new Date() },
      });

      const token = issueToken(patientUser.id, identity.id, clinic.id);
      return reply.send({
        token,
        patient: {
          id: patientUser.id,
          firstName: identity.firstName,
          lastName: identity.lastName,
          rut: identity.rut,
          email: identity.email,
          clinicId: clinic.id,
        },
      });
    }
  );


  // GET /api/auth/patient/me
  app.get("/auth/patient/me", async (req, reply) => {
    let payload: PatientJwtPayload;
    try {
      payload = verifyPatientToken(req.headers.authorization);
    } catch {
      return reply.status(401).send({ error: "No autorizado" });
    }

    const patientUser = await prisma.patientUser.findUnique({
      where: { id: payload.patientUserId },
      include: { identity: true, clinic: { select: { id: true, slug: true, name: true } } },
    });

    if (!patientUser || !patientUser.active) {
      return reply.status(401).send({ error: "No autorizado" });
    }

    return reply.send({
      patient: {
        id: patientUser.id,
        firstName: patientUser.identity.firstName,
        lastName: patientUser.identity.lastName,
        rut: patientUser.identity.rut,
        email: patientUser.identity.email,
        phone: patientUser.identity.phone,
        clinicId: patientUser.clinicId,
        enrolledAt: patientUser.enrolledAt,
        lastVisit: patientUser.lastVisit,
      },
      clinic: patientUser.clinic,
    });
  });
}
