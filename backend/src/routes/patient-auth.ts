import { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../config/prisma";
import { config } from "../config/env";
import { audit } from "../services/audit/auditService";

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

  // GET /api/auth/patient/purposes — catálogo de propósitos de tratamiento de
  // datos para mostrar en el signup (público, Ley 21.719).
  app.get("/auth/patient/purposes", async (_req, reply) => {
    const purposes = await prisma.dataProcessingPurpose.findMany({
      where: { active: true },
      orderBy: { displayOrder: "asc" },
      select: { key: true, label: true, description: true, legalBasis: true, required: true },
    });
    return reply.send({ purposes });
  });

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
      consents?: Record<string, boolean>;  // { [purposeKey]: granted } (Ley 21.719)
    };
  }>("/auth/patient/register", async (req, reply) => {
    const { rut, firstName, lastName, email, phone, password, clinicSlug, consents } = req.body ?? {};

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
    const marketingConsent = consents?.marketing === true;
    const patientUser = await prisma.patientUser.create({
      data: {
        identityId: identity.id,
        clinicId: clinic.id,
        passwordHash,
        marketingImagesConsent: marketingConsent,
      },
    });

    // Registrar el consentimiento por propósito (base legal — Ley 21.719)
    if (consents && typeof consents === "object") {
      const validKeys = new Set(
        (await prisma.dataProcessingPurpose.findMany({ where: { active: true }, select: { key: true } }))
          .map((p) => p.key)
      );
      const rows = Object.entries(consents)
        .filter(([key]) => validKeys.has(key))
        .map(([purposeKey, granted]) => ({ patientUserId: patientUser.id, purposeKey, granted: Boolean(granted) }));
      if (rows.length > 0) {
        await prisma.patientConsent.createMany({ data: rows });
      }
    }

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


  // PATCH /api/auth/patient/me — el paciente edita SU propio perfil
  app.patch<{
    Body: {
      firstName?: string;
      lastName?:  string;
      email?:     string | null;
      phone?:     string | null;
      address?:   string | null;
      emergencyContactName?:     string | null;
      emergencyContactPhone?:    string | null;
      emergencyContactRelation?: string | null;
    };
  }>("/auth/patient/me", async (req, reply) => {
    let payload: PatientJwtPayload;
    try { payload = verifyPatientToken(req.headers.authorization); }
    catch { return reply.status(401).send({ error: "No autorizado" }); }

    const body = req.body ?? {};
    // Email único — si lo cambia, validar que no esté en otra Identity
    if (body.email !== undefined && body.email) {
      const normalized = body.email.toLowerCase().trim();
      const taken = await prisma.identity.findFirst({
        where: { email: normalized, NOT: { id: payload.identityId } },
      });
      if (taken) return reply.status(409).send({ error: "Ese email ya está registrado con otro RUT" });
    }

    const updated = await prisma.identity.update({
      where: { id: payload.identityId },
      data: {
        ...(body.firstName !== undefined && { firstName: body.firstName.trim() }),
        ...(body.lastName  !== undefined && { lastName:  body.lastName.trim() }),
        ...(body.email     !== undefined && { email:     body.email?.toLowerCase().trim() || null }),
        ...(body.phone     !== undefined && { phone:     body.phone?.trim() || null }),
        ...(body.address   !== undefined && { address:   body.address?.trim() || null }),
        ...(body.emergencyContactName     !== undefined && { emergencyContactName:     body.emergencyContactName?.trim() || null }),
        ...(body.emergencyContactPhone    !== undefined && { emergencyContactPhone:    body.emergencyContactPhone?.trim() || null }),
        ...(body.emergencyContactRelation !== undefined && { emergencyContactRelation: body.emergencyContactRelation?.trim() || null }),
      },
    });
    return reply.send({
      patient: {
        id:        payload.patientUserId,
        firstName: updated.firstName,
        lastName:  updated.lastName,
        rut:       updated.rut,
        email:     updated.email,
        phone:     updated.phone,
        address:   updated.address,
        emergencyContactName:     updated.emergencyContactName,
        emergencyContactPhone:    updated.emergencyContactPhone,
        emergencyContactRelation: updated.emergencyContactRelation,
        clinicId:  payload.clinicId,
      },
    });
  });

  // GET /api/auth/patient/boletas — listar las boletas del paciente autenticado
  app.get("/auth/patient/boletas", async (req, reply) => {
    let payload: PatientJwtPayload;
    try { payload = verifyPatientToken(req.headers.authorization); }
    catch { return reply.status(401).send({ error: "No autorizado" }); }

    // Buscar la Identity para obtener el RUT
    const identity = await prisma.identity.findUnique({
      where: { id: payload.identityId },
      select: { rut: true },
    });
    if (!identity) return reply.status(404).send({ error: "Identidad no encontrada" });

    const boletas = await prisma.boleta.findMany({
      where: {
        clinicId: payload.clinicId,
        rutReceptor: identity.rut,
        status: { in: ["issued", "accepted"] },
      },
      orderBy: { emittedAt: "desc" },
      take: 50,
      select: {
        id: true, folio: true, totalAmount: true, netAmount: true, iva: true,
        description: true, pdfUrl: true, emittedAt: true,
      },
    });
    return reply.send({ boletas });
  });

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
        birthDate: patientUser.identity.birthDate,
        address: patientUser.identity.address,
        emergencyContactName:     patientUser.identity.emergencyContactName,
        emergencyContactPhone:    patientUser.identity.emergencyContactPhone,
        emergencyContactRelation: patientUser.identity.emergencyContactRelation,
        clinicId: patientUser.clinicId,
        enrolledAt: patientUser.enrolledAt,
        lastVisit: patientUser.lastVisit,
      },
      clinic: patientUser.clinic,
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // DERECHOS DEL TITULAR — ARCO+ (Ley 21.719, Issue #38)
  // ════════════════════════════════════════════════════════════════════════════

  // GET /api/auth/patient/my-data — derecho de acceso y portabilidad: el paciente
  // descarga TODO lo que la clínica mantiene sobre él en un JSON.
  app.get("/auth/patient/my-data", async (req, reply) => {
    let payload: PatientJwtPayload;
    try { payload = verifyPatientToken(req.headers.authorization); }
    catch { return reply.status(401).send({ error: "No autorizado" }); }

    const patientUser = await prisma.patientUser.findUnique({
      where: { id: payload.patientUserId },
      include: { identity: true, clinic: { select: { id: true, name: true, slug: true } } },
    });
    if (!patientUser) return reply.status(404).send({ error: "Paciente no encontrado" });

    // La ficha clínica vive en Patient (ligado por identity + clínica)
    const patient = await prisma.patient.findFirst({
      where: { clinicId: payload.clinicId, identityId: payload.identityId },
      include: {
        dentalEvents:       { include: { surfaces: true } },
        clinicalNotes:      true,
        anamnesisResponses: true,
        consentSignatures:  true,
        labOrders:          true,
        toothImages: {       // metadata, NO el binario (url excluido)
          select: { id: true, toothFDI: true, imageType: true, notes: true, takenAt: true, createdAt: true },
        },
      },
    });

    const bookings = await prisma.booking.findMany({
      where: { patientUserId: patientUser.id },
      orderBy: { date: "desc" },
    });

    const boletas = await prisma.boleta.findMany({
      where: { clinicId: payload.clinicId, rutReceptor: patientUser.identity.rut, status: { in: ["issued", "accepted"] } },
      select: { id: true, folio: true, totalAmount: true, netAmount: true, iva: true, description: true, emittedAt: true },
    });

    // Registrar el ejercicio del derecho de acceso (auditoría)
    audit({
      req, actorId: null, clinicId: payload.clinicId,
      action: "read", resourceType: "Identity", resourceId: payload.identityId,
      snapshotAfter: { arco: "acceso/portabilidad export" },
    });

    const id = patientUser.identity;
    return reply.send({
      generatedAt: new Date().toISOString(),
      clinica: patientUser.clinic,
      datosPersonales: {
        rut: id.rut, firstName: id.firstName, lastName: id.lastName,
        email: id.email, phone: id.phone, birthDate: id.birthDate, address: id.address,
        emergencyContactName: id.emergencyContactName,
        emergencyContactPhone: id.emergencyContactPhone,
        emergencyContactRelation: id.emergencyContactRelation,
      },
      cuenta: {
        enrolledAt: patientUser.enrolledAt, lastVisit: patientUser.lastVisit,
        insuranceProvider: patientUser.insuranceProvider,
        insuranceTier: patientUser.insuranceTier,
        insuranceCompany: patientUser.insuranceCompany,
        marketingImagesConsent: patientUser.marketingImagesConsent,
      },
      citas: bookings,
      fichaClinica: patient
        ? {
            dentalEvents: patient.dentalEvents,
            clinicalNotes: patient.clinicalNotes,
            anamnesisResponses: patient.anamnesisResponses,
            consentSignatures: patient.consentSignatures,
            labOrders: patient.labOrders,
            imagenes: patient.toothImages,
          }
        : null,
      boletas,
      nota: "Estos son los datos personales y clínicos que la clínica mantiene sobre ti, conforme a la Ley 21.719. Las imágenes se listan como metadata; puedes solicitar los archivos a tu clínica.",
    });
  });

  // DELETE /api/auth/patient/my-data — derecho de cancelación/supresión.
  // Flujo legal: los datos clínicos tienen retención obligatoria (Ley 20.584, 15
  // años), por lo que NO se eliminan automáticamente. Lo que SÍ se ejecuta de
  // inmediato: revocar consentimientos de marketing y registrar la solicitud para
  // que la clínica procese la baja de datos de contacto no obligatorios.
  app.delete("/auth/patient/my-data", async (req, reply) => {
    let payload: PatientJwtPayload;
    try { payload = verifyPatientToken(req.headers.authorization); }
    catch { return reply.status(401).send({ error: "No autorizado" }); }

    const patientUser = await prisma.patientUser.findUnique({
      where: { id: payload.patientUserId },
      select: { id: true, marketingImagesConsent: true },
    });
    if (!patientUser) return reply.status(404).send({ error: "Paciente no encontrado" });

    // Acción inmediata y reversible: revocar marketing
    await prisma.patientUser.update({
      where: { id: patientUser.id },
      data:  { marketingImagesConsent: false },
    });

    // Registrar la solicitud de supresión para revisión de la clínica
    audit({
      req, actorId: null, clinicId: payload.clinicId,
      action: "delete", resourceType: "Identity", resourceId: payload.identityId,
      snapshotBefore: { marketingImagesConsent: patientUser.marketingImagesConsent },
      snapshotAfter:  { arco: "solicitud de supresión", marketingImagesConsent: false },
    });

    return reply.send({
      ok: true,
      message:
        "Solicitud registrada. Revocamos de inmediato el uso de tus datos para marketing. " +
        "Tus datos clínicos se conservan por obligación legal (Ley 20.584, 15 años); " +
        "la clínica procesará la baja de tus datos de contacto no obligatorios y te contactará.",
    });
  });
}
