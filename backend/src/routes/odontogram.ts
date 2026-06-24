import type { FastifyInstance } from "fastify";
import type { DentalSurface } from "@prisma/client";
import prisma from "../config/prisma";
import { verifyToken } from "./auth";
import {
  isValidFDI, isValidConditionCode, CONDITION_CATALOG,
  buildPatientOdontogram,
} from "../services/dental/odontogramService";
import { audit } from "../services/audit/auditService";
import { canPerform, isAllowedConditionFor } from "../services/auth/clinicalPermissions";

const VALID_SURFACES: DentalSurface[] = ["V", "P", "L", "M", "D", "O", "I"];
const VALID_EVENT_TYPES = ["DIAGNOSIS", "TREATMENT", "OBSERVATION"] as const;

export async function odontogramRoutes(app: FastifyInstance) {

  // Helper: verifica acceso al paciente + permiso clínico (Issue #32)
  async function guardPatientAccess(
    req: { headers: { authorization?: string }; params: { patientId: string } },
    action: "read_clinical" | "write_clinical" | "limpieza_only" = "read_clinical",
  ): Promise<
      | { ok: true; payload: ReturnType<typeof verifyToken>; patient: { id: string; clinicId: string }; clinicalRole: import("@prisma/client").ClinicalRole | null }
      | { ok: false; status: number; error: string }
    >
  {
    let payload;
    try { payload = verifyToken(req.headers.authorization); }
    catch { return { ok: false, status: 401, error: "No autorizado" }; }

    const patient = await prisma.patient.findUnique({
      where:  { id: req.params.patientId },
      select: { id: true, clinicId: true },
    });
    if (!patient) return { ok: false, status: 404, error: "Paciente no encontrado" };
    if (payload.role !== "SUPERADMIN" && payload.clinicId !== patient.clinicId) {
      return { ok: false, status: 403, error: "Acceso denegado" };
    }

    const me = await prisma.partnerUser.findUnique({
      where:  { id: payload.userId },
      select: { role: true, clinicalRole: true },
    });
    if (!me || !canPerform(me.role, me.clinicalRole, action)) {
      return { ok: false, status: 403, error: "Sin permisos clínicos para esta acción" };
    }
    return { ok: true, payload, patient, clinicalRole: me.clinicalRole };
  }

  // ── Catálogo de condiciones ────────────────────────────────────────────────
  app.get("/dental/catalog", async (_req, reply) => {
    return reply.send({ conditions: CONDITION_CATALOG, surfaces: VALID_SURFACES });
  });

  // ── Historial completo de eventos por paciente ─────────────────────────────
  app.get<{
    Params:      { patientId: string };
    Querystring: { from?: string; to?: string; toothFDI?: string; limit?: string };
  }>("/patients/:patientId/dental-events", async (req, reply) => {
    const g = await guardPatientAccess(req);
    if (!g.ok) return reply.status(g.status).send({ error: g.error });

    const { from, to, toothFDI, limit } = req.query;
    if (toothFDI && !isValidFDI(toothFDI)) {
      return reply.status(400).send({ error: "FDI inválido" });
    }

    const events = await prisma.dentalEvent.findMany({
      where: {
        patientId: req.params.patientId,
        ...(toothFDI ? { toothFDI } : {}),
        ...(from || to ? {
          occurredAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to   ? { lte: new Date(to)   } : {}),
          },
        } : {}),
      },
      orderBy:  { occurredAt: "desc" },
      take:     Math.min(Math.max(Number(limit ?? 500), 1), 2000),
      include:  {
        surfaces:     true,
        professional: { select: { id: true, name: true, occupation: true } },
      },
    });

    return reply.send({ events });
  });

  // ── Proyección del odontograma actual ─────────────────────────────────────
  app.get<{ Params: { patientId: string } }>(
    "/patients/:patientId/odontogram",
    async (req, reply) => {
      const g = await guardPatientAccess(req);
      if (!g.ok) return reply.status(g.status).send({ error: g.error });

      const events = await prisma.dentalEvent.findMany({
        where:   { patientId: req.params.patientId },
        orderBy: { occurredAt: "desc" },
        include: { surfaces: true },
      });

      const projection = buildPatientOdontogram(events);
      return reply.send({ patientId: req.params.patientId, teeth: projection });
    }
  );

  // ── Crear evento clínico (inmutable) ──────────────────────────────────────
  app.post<{
    Params: { patientId: string };
    Body: {
      toothFDI:       string;
      eventType:      "DIAGNOSIS" | "TREATMENT" | "OBSERVATION";
      conditionCode:  string;
      surfaces?:      DentalSurface[];
      severity?:      number;
      notes?:         string;
      sessionId?:     string;
      occurredAt?:    string;
    };
  }>("/patients/:patientId/dental-events", async (req, reply) => {
    const g = await guardPatientAccess(req, "limpieza_only");
    if (!g.ok) return reply.status(g.status).send({ error: g.error });

    const { toothFDI, eventType, conditionCode, surfaces, severity, notes, sessionId, occurredAt } = req.body ?? {};

    // Restricción por clinicalRole (Issue #32): higienista solo registra limpieza/sellante/obturacion/sano
    if (conditionCode && !isAllowedConditionFor(g.clinicalRole, conditionCode)) {
      return reply.status(403).send({
        error: `Tu rol clínico no permite registrar "${conditionCode}". Pide a un dentista que lo registre.`,
      });
    }

    if (!toothFDI || !isValidFDI(toothFDI)) {
      return reply.status(400).send({ error: "toothFDI inválido — usar notación FDI (11-48)" });
    }
    if (!eventType || !VALID_EVENT_TYPES.includes(eventType)) {
      return reply.status(400).send({ error: "eventType inválido" });
    }
    if (!conditionCode || !isValidConditionCode(conditionCode)) {
      return reply.status(400).send({ error: "conditionCode no está en el catálogo" });
    }
    if (surfaces && (!Array.isArray(surfaces) || surfaces.some((s) => !VALID_SURFACES.includes(s)))) {
      return reply.status(400).send({ error: "surfaces inválidas — usar V/P/L/M/D/O/I" });
    }
    if (severity !== undefined && (!Number.isInteger(severity) || severity < 0 || severity > 20)) {
      return reply.status(400).send({ error: "severity debe ser entero entre 0 y 20" });
    }
    if (notes && notes.length > 2000) {
      return reply.status(400).send({ error: "notes supera 2000 caracteres" });
    }

    const event = await prisma.dentalEvent.create({
      data: {
        clinicId:       g.patient.clinicId,
        patientId:      req.params.patientId,
        sessionId:      sessionId ?? null,
        professionalId: g.payload.userId,
        toothFDI,
        eventType,
        conditionCode,
        severity:       severity ?? null,
        notes:          notes ?? null,
        occurredAt:     occurredAt ? new Date(occurredAt) : new Date(),
        ...(surfaces && surfaces.length > 0 ? {
          surfaces: { create: surfaces.map((s) => ({ surface: s })) },
        } : {}),
      },
      include: {
        surfaces:     true,
        professional: { select: { id: true, name: true, occupation: true } },
      },
    });

    audit({
      req, actorId: g.payload.userId, clinicId: g.patient.clinicId,
      action: "create", resourceType: "DentalEvent", resourceId: event.id,
      snapshotAfter: { toothFDI, eventType, conditionCode, surfaces, severity },
    });

    return reply.status(201).send({ event });
  });

  // ── Imágenes (radiografías / fotos) ────────────────────────────────────────
  app.get<{ Params: { patientId: string } }>(
    "/patients/:patientId/tooth-images",
    async (req, reply) => {
      const g = await guardPatientAccess(req);
      if (!g.ok) return reply.status(g.status).send({ error: g.error });

      const images = await prisma.toothImage.findMany({
        where:   { patientId: req.params.patientId },
        orderBy: { takenAt: "desc" },
        select: {
          id: true, toothFDI: true, imageType: true, url: true, notes: true,
          takenAt: true, createdAt: true,
          professional: { select: { id: true, name: true } },
        },
      });
      return reply.send({ images });
    }
  );

  app.post<{
    Params: { patientId: string };
    Body: {
      url:        string;     // data URL en v1; máximo ~1.2MB (~900KB binario)
      imageType:  string;     // "panoramic" | "periapical" | "bitewing" | "photo" | "other"
      toothFDI?:  string;     // null/omit = panorámica/general
      sessionId?: string;
      takenAt?:   string;
      notes?:     string;
    };
  }>("/patients/:patientId/tooth-images", async (req, reply) => {
    const g = await guardPatientAccess(req);
    if (!g.ok) return reply.status(g.status).send({ error: g.error });

    const { url, imageType, toothFDI, sessionId, takenAt, notes } = req.body ?? {};

    if (!url || !url.startsWith("data:image/")) {
      return reply.status(400).send({ error: "url debe ser un data URL de imagen" });
    }
    if (url.length > 1_700_000) {
      return reply.status(400).send({ error: "Imagen demasiado grande (máx ~1.2 MB)" });
    }
    const allowedTypes = ["panoramic", "periapical", "bitewing", "photo", "other"];
    if (!imageType || !allowedTypes.includes(imageType)) {
      return reply.status(400).send({ error: `imageType inválido (${allowedTypes.join("|")})` });
    }
    if (toothFDI && !isValidFDI(toothFDI)) {
      return reply.status(400).send({ error: "toothFDI inválido" });
    }

    const image = await prisma.toothImage.create({
      data: {
        clinicId:       g.patient.clinicId,
        patientId:      req.params.patientId,
        professionalId: g.payload.userId,
        sessionId:      sessionId ?? null,
        toothFDI:       toothFDI ?? null,
        imageType,
        url,
        notes:          notes ?? null,
        takenAt:        takenAt ? new Date(takenAt) : new Date(),
      },
      select: {
        id: true, toothFDI: true, imageType: true, url: true, notes: true,
        takenAt: true, createdAt: true,
      },
    });

    audit({
      req, actorId: g.payload.userId, clinicId: g.patient.clinicId,
      action: "create", resourceType: "ToothImage", resourceId: image.id,
      snapshotAfter: { toothFDI, imageType, takenAt: image.takenAt },
    });

    return reply.status(201).send({ image });
  });
}
