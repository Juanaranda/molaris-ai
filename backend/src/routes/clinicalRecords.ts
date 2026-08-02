/**
 * Ficha clínica del paciente — Issue #17.
 * Implementa los requisitos del Decreto 41 MINSAL + Ley 20.584.
 *
 * Endpoints:
 *   GET    /api/patients/:id/clinical-record   — ficha completa
 *   GET    /api/patients/:id/clinical-notes    — listar notas
 *   POST   /api/patients/:id/clinical-notes    — crear nota (append-only)
 *   PATCH  /api/patients/:id/identity          — actualizar datos persona
 *   PATCH  /api/patients/:id/insurance         — actualizar previsión
 *
 * Las notas son inmutables. Cualquier corrección requiere una nueva nota.
 * Audit log granular pendiente en Issue #34.
 */

import type { FastifyInstance } from "fastify";
import prisma from "../config/prisma";
import { verifyToken } from "./auth";
import { buildPatientOdontogram } from "../services/dental/odontogramService";
import { audit } from "../services/audit/auditService";
import { redFlagsToAlerts, AnamnesisQuestion } from "../services/anamnesis/anamnesisService";
import { canPerform } from "../services/auth/clinicalPermissions";

const REASON_CATEGORIES = ["urgencia", "dolor", "control", "estetica", "derivacion", "otro"] as const;
const INSURANCE_PROVIDERS = ["fonasa", "isapre", "particular", "otro"] as const;
const FONASA_TIERS = ["A", "B", "C", "D"];

export async function clinicalRecordRoutes(app: FastifyInstance) {

  // ── Resolver Patient.id desde un rut o phone dentro de la clínica ─────────
  // Crea el Patient si no existe pero hay un booking previo con esos datos.
  // Usado por la UI para abrir la ficha desde el listado agregado.
  app.get<{
    Params: { clinicId: string };
    Querystring: { rut?: string; phone?: string };
  }>("/clinics/:clinicId/patients/ensure", async (req, reply) => {
    let payload;
    try { payload = verifyToken(req.headers.authorization); }
    catch { return reply.status(401).send({ error: "No autorizado" }); }
    if (payload.role !== "SUPERADMIN" && payload.clinicId !== req.params.clinicId) {
      return reply.status(403).send({ error: "Acceso denegado" });
    }

    const rut   = req.query.rut?.trim();
    const phone = req.query.phone?.replace(/\D/g, "");
    if (!rut && !phone) {
      return reply.status(400).send({ error: "Falta rut o phone" });
    }

    // 1. Buscar Identity por rut (si está)
    let identity = rut
      ? await prisma.identity.findUnique({ where: { rut } })
      : null;

    // 2. Buscar Patient existente
    let patient = await prisma.patient.findFirst({
      where: {
        clinicId: req.params.clinicId,
        OR: [
          ...(identity ? [{ identityId: identity.id }] : []),
          ...(phone    ? [{ phone }] : []),
        ],
      },
    });

    // 3. Si no existe Patient pero hay bookings con esos datos → crearlo
    if (!patient) {
      const booking = await prisma.booking.findFirst({
        where: {
          clinicId: req.params.clinicId,
          OR: [
            ...(rut   ? [{ patientRut: rut }] : []),
            ...(phone ? [{ patientPhone: phone }] : []),
          ],
        },
        orderBy: { date: "desc" },
      });
      if (!booking) {
        return reply.status(404).send({ error: "Paciente no encontrado en esta clínica" });
      }

      // Si no hay Identity pero tenemos RUT, crear una
      if (!identity && rut && booking.patientName) {
        const parts = booking.patientName.split(" ");
        identity = await prisma.identity.create({
          data: {
            rut,
            firstName: parts[0] ?? "Paciente",
            lastName:  parts.slice(1).join(" ") || "—",
            phone:     phone ?? null,
          },
        });
      }

      patient = await prisma.patient.create({
        data: {
          clinicId:   req.params.clinicId,
          identityId: identity?.id ?? null,
          // Los paréntesis importan: "??" liga más fuerte que "? :", así que
          // sin ellos la condición era (patientName ?? identity) y un paciente
          // CON nombre terminaba guardado como "undefined undefined".
          name:       booking.patientName ?? (identity ? `${identity.firstName} ${identity.lastName}` : null),
          phone:      phone ?? booking.patientPhone,
          email:      booking.patientEmail,
          channel:    "manual",
        },
      });
    }

    return reply.send({ patientId: patient.id });
  });

  async function guardPatient(
    req: { headers: { authorization?: string }; params: { patientId: string } },
    requiredAction: "read_clinical" | "write_clinical" = "read_clinical",
  ): Promise<
      | { ok: true;  payload: ReturnType<typeof verifyToken>; patient: { id: string; clinicId: string; identityId: string | null } }
      | { ok: false; status: number; error: string }
    >
  {
    let payload;
    try { payload = verifyToken(req.headers.authorization); }
    catch { return { ok: false, status: 401, error: "No autorizado" }; }

    const patient = await prisma.patient.findUnique({
      where:  { id: req.params.patientId },
      select: { id: true, clinicId: true, identityId: true },
    });
    if (!patient) return { ok: false, status: 404, error: "Paciente no encontrado" };
    if (payload.role !== "SUPERADMIN" && payload.clinicId !== patient.clinicId) {
      return { ok: false, status: 403, error: "Acceso denegado" };
    }

    // Validar clinicalRole para acciones sensibles (Issue #32)
    const me = await prisma.partnerUser.findUnique({
      where:  { id: payload.userId },
      select: { role: true, clinicalRole: true },
    });
    if (!me || !canPerform(me.role, me.clinicalRole, requiredAction)) {
      return { ok: false, status: 403, error: "Sin permisos clínicos para esta acción" };
    }

    return { ok: true, payload, patient };
  }

  // ── Ficha completa del paciente ─────────────────────────────────────────────
  app.get<{ Params: { patientId: string } }>(
    "/patients/:patientId/clinical-record",
    async (req, reply) => {
      const g = await guardPatient(req);
      if (!g.ok) return reply.status(g.status).send({ error: g.error });

      const [patient, dentalEvents, notes, images, latestAnamnesis] = await Promise.all([
        prisma.patient.findUnique({
          where:   { id: req.params.patientId },
          include: {
            identity: {
              include: {
                guardian: { select: { id: true, firstName: true, lastName: true, rut: true, phone: true } },
              },
            },
          },
        }),
        prisma.dentalEvent.findMany({
          where:   { patientId: req.params.patientId },
          orderBy: { occurredAt: "desc" },
          include: { surfaces: true },
        }),
        prisma.clinicalNote.findMany({
          where:   { patientId: req.params.patientId },
          orderBy: { occurredAt: "desc" },
          include: { professional: { select: { id: true, name: true, occupation: true } } },
        }),
        prisma.toothImage.findMany({
          where:   { patientId: req.params.patientId },
          orderBy: { takenAt: "desc" },
          select:  { id: true, toothFDI: true, imageType: true, url: true, takenAt: true },
        }),
        prisma.anamnesisResponse.findFirst({
          where:   { patientId: req.params.patientId },
          orderBy: { completedAt: "desc" },
          include: { template: { select: { questions: true, version: true } } },
        }),
      ]);

      if (!patient) return reply.status(404).send({ error: "Paciente no encontrado" });

      audit({
        req, actorId: g.payload.userId, clinicId: g.patient.clinicId,
        action: "read", resourceType: "ClinicalRecord", resourceId: g.patient.id,
      });

      // PatientUser separado (puede no existir si solo viene de chat)
      const patientUser = patient.identityId
        ? await prisma.patientUser.findUnique({
            where:  { identityId_clinicId: { identityId: patient.identityId, clinicId: patient.clinicId } },
            select: {
              id: true, enrolledAt: true, lastVisit: true,
              insuranceProvider: true, insuranceTier: true, insuranceCompany: true,
              marketingImagesConsent: true,
            },
          })
        : null;

      const odontogram = buildPatientOdontogram(dentalEvents);

      // Alertas combinadas: anamnesis (structured) + keyword en notas (legacy)
      const anamnesisAlerts = latestAnamnesis
        ? redFlagsToAlerts(latestAnamnesis.template.questions as unknown as AnamnesisQuestion[], latestAnamnesis.redFlags)
        : [];
      const noteAlerts = extractAlerts(notes, dentalEvents);
      const allAlerts  = Array.from(new Set([...anamnesisAlerts, ...noteAlerts]));

      // Última atención: quién lo trató y dónde. Abrir una ficha sin saber de
      // quién es ni quién la lleva obliga a salir a buscarlo a otra pantalla.
      const rutPaciente = patient.identity?.rut ?? null;
      const ultimaCita = await prisma.booking.findFirst({
        where: {
          clinicId: patient.clinicId,
          status: { not: "cancelled" },
          ...(rutPaciente
            ? { patientRut: rutPaciente }
            : { patientPhone: patient.phone ?? "___sin_match___" }),
        },
        orderBy: { date: "desc" },
        select: { doctor: true, sede: true, date: true, service: true },
      });

      return reply.send({
        patient: {
          id:       patient.id,
          name:     patient.name,
          phone:    patient.phone,
          email:    patient.email,
          channel:  patient.channel,
          createdAt: patient.createdAt,
        },
        lastVisit: ultimaCita
          ? {
              doctor:  ultimaCita.doctor,
              sede:    ultimaCita.sede,
              date:    ultimaCita.date,
              service: ultimaCita.service,
            }
          : null,
        identity:    patient.identity,
        patientUser,
        odontogram,
        clinicalNotes: notes,
        images,
        latestAnamnesis,
        alerts: allAlerts,
      });
    }
  );

  // ── Listar notas clínicas ──────────────────────────────────────────────────
  app.get<{ Params: { patientId: string } }>(
    "/patients/:patientId/clinical-notes",
    async (req, reply) => {
      const g = await guardPatient(req);
      if (!g.ok) return reply.status(g.status).send({ error: g.error });

      const notes = await prisma.clinicalNote.findMany({
        where:   { patientId: req.params.patientId },
        orderBy: { occurredAt: "desc" },
        include: { professional: { select: { id: true, name: true, occupation: true } } },
      });
      return reply.send({ notes });
    }
  );

  // ── Crear nota clínica (inmutable) ─────────────────────────────────────────
  app.post<{
    Params: { patientId: string };
    Body: {
      sessionId?:      string;
      reason?:         string;
      reasonCategory?: typeof REASON_CATEGORIES[number];
      findings?:       string;
      procedures?:     string;
      prescriptions?:  string;
      nextVisitPlan?:  string;
      occurredAt?:     string;
    };
  }>("/patients/:patientId/clinical-notes", async (req, reply) => {
    const g = await guardPatient(req, "write_clinical");
    if (!g.ok) return reply.status(g.status).send({ error: g.error });

    const { sessionId, reason, reasonCategory, findings, procedures, prescriptions, nextVisitPlan, occurredAt } = req.body ?? {};

    if (reasonCategory && !REASON_CATEGORIES.includes(reasonCategory)) {
      return reply.status(400).send({ error: "reasonCategory inválida" });
    }
    if (!reason && !findings && !procedures) {
      return reply.status(400).send({ error: "Nota vacía — debe tener al menos motivo, hallazgos o procedimientos" });
    }
    // Límites razonables
    for (const [field, value] of Object.entries({ reason, findings, procedures, prescriptions, nextVisitPlan })) {
      if (value && typeof value === "string" && value.length > 5000) {
        return reply.status(400).send({ error: `Campo ${field} supera 5000 caracteres` });
      }
    }

    const note = await prisma.clinicalNote.create({
      data: {
        clinicId:       g.patient.clinicId,
        patientId:      g.patient.id,
        sessionId:      sessionId ?? null,
        professionalId: g.payload.userId,
        reason:         reason ?? null,
        reasonCategory: reasonCategory ?? null,
        findings:       findings ?? null,
        procedures:     procedures ?? null,
        prescriptions:  prescriptions ?? null,
        nextVisitPlan:  nextVisitPlan ?? null,
        occurredAt:     occurredAt ? new Date(occurredAt) : new Date(),
      },
      include: { professional: { select: { id: true, name: true, occupation: true } } },
    });

    audit({
      req, actorId: g.payload.userId, clinicId: g.patient.clinicId,
      action: "create", resourceType: "ClinicalNote", resourceId: note.id,
      snapshotAfter: { reason, reasonCategory, findings, procedures, prescriptions, nextVisitPlan },
    });

    return reply.status(201).send({ note });
  });

  // ── Actualizar datos de Identity (datos personales) ───────────────────────
  app.patch<{
    Params: { patientId: string };
    Body: {
      firstName?: string;
      lastName?:  string;
      email?:     string | null;
      phone?:     string | null;
      birthDate?: string | null;
      gender?:    string | null;
      address?:   string | null;
      emergencyContactName?:     string | null;
      emergencyContactPhone?:    string | null;
      emergencyContactRelation?: string | null;
    };
  }>("/patients/:patientId/identity", async (req, reply) => {
    const g = await guardPatient(req, "write_clinical");
    if (!g.ok) return reply.status(g.status).send({ error: g.error });
    if (!g.patient.identityId) return reply.status(400).send({ error: "Paciente sin identidad enrolada" });

    const body = req.body ?? {};
    const beforeIdentity = await prisma.identity.findUnique({ where: { id: g.patient.identityId } });
    const updated = await prisma.identity.update({
      where: { id: g.patient.identityId },
      data: {
        ...(body.firstName !== undefined && { firstName: body.firstName.trim() }),
        ...(body.lastName  !== undefined && { lastName:  body.lastName.trim() }),
        ...(body.email     !== undefined && { email:     body.email?.trim().toLowerCase() || null }),
        ...(body.phone     !== undefined && { phone:     body.phone?.trim() || null }),
        ...(body.birthDate !== undefined && { birthDate: body.birthDate ? new Date(body.birthDate) : null }),
        ...(body.gender    !== undefined && { gender:    body.gender || null }),
        ...(body.address   !== undefined && { address:   body.address?.trim() || null }),
        ...(body.emergencyContactName     !== undefined && { emergencyContactName:     body.emergencyContactName?.trim() || null }),
        ...(body.emergencyContactPhone    !== undefined && { emergencyContactPhone:    body.emergencyContactPhone?.trim() || null }),
        ...(body.emergencyContactRelation !== undefined && { emergencyContactRelation: body.emergencyContactRelation?.trim() || null }),
      },
    });

    audit({
      req, actorId: g.payload.userId, clinicId: g.patient.clinicId,
      action: "update", resourceType: "Identity", resourceId: updated.id,
      snapshotBefore: beforeIdentity,
      snapshotAfter:  updated,
    });

    return reply.send({ identity: updated });
  });

  // ── Actualizar previsión ──────────────────────────────────────────────────
  app.patch<{
    Params: { patientId: string };
    Body: {
      insuranceProvider?: typeof INSURANCE_PROVIDERS[number] | null;
      insuranceTier?:     string | null;
      insuranceCompany?:  string | null;
      marketingImagesConsent?: boolean;
    };
  }>("/patients/:patientId/insurance", async (req, reply) => {
    const g = await guardPatient(req, "write_clinical");
    if (!g.ok) return reply.status(g.status).send({ error: g.error });
    if (!g.patient.identityId) return reply.status(400).send({ error: "Paciente sin identidad enrolada" });

    const { insuranceProvider, insuranceTier, insuranceCompany, marketingImagesConsent } = req.body ?? {};
    if (insuranceProvider && !INSURANCE_PROVIDERS.includes(insuranceProvider)) {
      return reply.status(400).send({ error: "Previsión inválida" });
    }
    if (insuranceProvider === "fonasa" && insuranceTier && !FONASA_TIERS.includes(insuranceTier)) {
      return reply.status(400).send({ error: "Tramo Fonasa debe ser A, B, C o D" });
    }

    const updated = await prisma.patientUser.update({
      where: { identityId_clinicId: { identityId: g.patient.identityId, clinicId: g.patient.clinicId } },
      data: {
        ...(insuranceProvider !== undefined && { insuranceProvider }),
        ...(insuranceTier     !== undefined && { insuranceTier:     insuranceTier || null }),
        ...(insuranceCompany  !== undefined && { insuranceCompany:  insuranceCompany || null }),
        ...(marketingImagesConsent !== undefined && { marketingImagesConsent: Boolean(marketingImagesConsent) }),
      },
      select: {
        insuranceProvider: true, insuranceTier: true, insuranceCompany: true,
        marketingImagesConsent: true,
      },
    });
    return reply.send({ patientUser: updated });
  });
}

/**
 * Extrae alertas críticas desde notas clínicas y eventos dentales para
 * mostrarlas como banner en el resumen del paciente.
 * v1: keyword matching simple. v2: integrar respuestas estructuradas de anamnesis (#35)
 */
function extractAlerts(
  notes: { findings: string | null; prescriptions: string | null }[],
  _events: unknown[],
): string[] {
  const alerts: string[] = [];
  const haystack = notes.map((n) => `${n.findings ?? ""} ${n.prescriptions ?? ""}`).join(" ").toLowerCase();

  const RED_FLAGS = [
    { kw: ["alergia", "alérgico", "alergico"], label: "⚠️ Alergia registrada — revisar notas" },
    { kw: ["anticoagulante", "warfarina", "acenocumarol", "rivaroxaban"], label: "⚠️ Paciente con anticoagulantes" },
    { kw: ["bifosfonato", "alendronato", "zoledronato"], label: "⚠️ Paciente con bifosfonatos — riesgo osteonecrosis" },
    { kw: ["diabetes"], label: "🩺 Paciente diabético" },
    { kw: ["embarazo", "embarazada", "lactancia"], label: "🤰 Embarazo o lactancia" },
    { kw: ["marcapasos"], label: "⚠️ Marcapasos — evitar ultrasonido" },
  ];

  for (const { kw, label } of RED_FLAGS) {
    if (kw.some((k) => haystack.includes(k))) alerts.push(label);
  }
  return alerts;
}
