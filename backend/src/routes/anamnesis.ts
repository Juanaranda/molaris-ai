import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import prisma from "../config/prisma";
import { verifyToken } from "./auth";
import {
  AnamnesisQuestion, ensureActiveTemplate, computeRedFlags,
} from "../services/anamnesis/anamnesisService";
import { audit } from "../services/audit/auditService";

export async function anamnesisRoutes(app: FastifyInstance) {

  async function guardPatient(req: { headers: { authorization?: string }; params: { patientId: string } }):
    Promise<
      | { ok: true;  payload: ReturnType<typeof verifyToken>; patient: { id: string; clinicId: string } }
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
    return { ok: true, payload, patient };
  }

  function guardClinic(req: { headers: { authorization?: string }; params: { id: string } }):
    | { ok: true;  payload: ReturnType<typeof verifyToken> }
    | { ok: false; status: number; error: string }
  {
    let payload;
    try { payload = verifyToken(req.headers.authorization); }
    catch { return { ok: false, status: 401, error: "No autorizado" }; }
    if (payload.role === "USER") return { ok: false, status: 403, error: "Sin permisos" };
    if (payload.role !== "SUPERADMIN" && payload.clinicId !== req.params.id) {
      return { ok: false, status: 403, error: "Acceso denegado" };
    }
    return { ok: true, payload };
  }

  // ── Template activo de la clínica (crea v1 estándar si no existe) ─────────
  app.get<{ Params: { id: string } }>("/clinics/:id/anamnesis/template", async (req, reply) => {
    const g = guardClinic(req);
    if (!g.ok) return reply.status(g.status).send({ error: g.error });
    const template = await ensureActiveTemplate(req.params.id);
    return reply.send({ template });
  });

  // ── Crear nueva versión del template (admin) ──────────────────────────────
  app.post<{
    Params: { id: string };
    Body:   { questions: AnamnesisQuestion[] };
  }>("/clinics/:id/anamnesis/template", async (req, reply) => {
    const g = guardClinic(req);
    if (!g.ok) return reply.status(g.status).send({ error: g.error });

    const { questions } = req.body ?? {};
    if (!Array.isArray(questions) || questions.length === 0) {
      return reply.status(400).send({ error: "questions debe ser un array no vacío" });
    }
    for (const q of questions) {
      if (!q.code || !q.label || !["boolean", "text", "number", "multiselect"].includes(q.type)) {
        return reply.status(400).send({ error: `Pregunta inválida: ${JSON.stringify(q).slice(0, 80)}` });
      }
    }

    // Desactivar template previo + crear nueva versión
    const latest = await prisma.anamnesisTemplate.findFirst({
      where: { clinicId: req.params.id },
      orderBy: { version: "desc" },
    });
    const newVersion = (latest?.version ?? 0) + 1;

    if (latest) {
      await prisma.anamnesisTemplate.update({ where: { id: latest.id }, data: { active: false } });
    }
    const template = await prisma.anamnesisTemplate.create({
      data: {
        clinicId:  req.params.id,
        version:   newVersion,
        questions: questions as unknown as Prisma.InputJsonValue,
        active:    true,
      },
    });
    return reply.status(201).send({ template });
  });

  // ── Listar respuestas del paciente ────────────────────────────────────────
  app.get<{ Params: { patientId: string } }>(
    "/patients/:patientId/anamnesis-responses",
    async (req, reply) => {
      const g = await guardPatient(req);
      if (!g.ok) return reply.status(g.status).send({ error: g.error });

      const responses = await prisma.anamnesisResponse.findMany({
        where:   { patientId: req.params.patientId },
        orderBy: { completedAt: "desc" },
        include: {
          recordedBy: { select: { id: true, name: true, occupation: true } },
          template:   { select: { version: true, questions: true } },
        },
      });
      return reply.send({ responses });
    }
  );

  // ── Crear nueva respuesta (siempre vinculada al template activo) ──────────
  app.post<{
    Params: { patientId: string };
    Body:   { answers: Record<string, unknown> };
  }>("/patients/:patientId/anamnesis-responses", async (req, reply) => {
    const g = await guardPatient(req);
    if (!g.ok) return reply.status(g.status).send({ error: g.error });

    const { answers } = req.body ?? {};
    if (!answers || typeof answers !== "object") {
      return reply.status(400).send({ error: "answers requeridas" });
    }

    const template = await ensureActiveTemplate(g.patient.clinicId);
    const questions = template.questions as unknown as AnamnesisQuestion[];
    const redFlags  = computeRedFlags(questions, answers);

    const response = await prisma.anamnesisResponse.create({
      data: {
        clinicId:        g.patient.clinicId,
        patientId:       g.patient.id,
        templateId:      template.id,
        templateVersion: template.version,
        answers:         answers as Prisma.InputJsonValue,
        redFlags,
        recordedById:    g.payload.userId,
      },
      include: {
        recordedBy: { select: { id: true, name: true, occupation: true } },
      },
    });

    audit({
      req, actorId: g.payload.userId, clinicId: g.patient.clinicId,
      action: "create", resourceType: "ClinicalRecord", resourceId: response.id,
      snapshotAfter: { templateVersion: template.version, redFlagsCount: redFlags.length },
    });

    return reply.status(201).send({ response });
  });
}
