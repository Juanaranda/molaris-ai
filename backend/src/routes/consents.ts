import type { FastifyInstance } from "fastify";
import prisma from "../config/prisma";
import { verifyToken } from "./auth";
import {
  ensureDefaultConsentTemplates, renderTemplate, createZapSignDoc,
} from "../services/consents/consentService";
import { audit } from "../services/audit/auditService";

const VALID_METHODS = ["zapsign", "manual_upload", "in_person_pad"] as const;
type SignatureMethod = typeof VALID_METHODS[number];

export async function consentRoutes(app: FastifyInstance) {

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

  async function guardPatient(req: { headers: { authorization?: string }; params: { patientId: string } }):
    Promise<
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
    return { ok: true, payload, patient };
  }

  // ── Listar templates (auto-seed defaults si no hay) ──────────────────────
  app.get<{ Params: { id: string } }>("/clinics/:id/consent-templates", async (req, reply) => {
    const g = guardClinic(req);
    if (!g.ok) return reply.status(g.status).send({ error: g.error });

    await ensureDefaultConsentTemplates(req.params.id);
    const templates = await prisma.consentTemplate.findMany({
      where:   { clinicId: req.params.id, active: true },
      orderBy: { createdAt: "asc" },
    });
    return reply.send({ templates });
  });

  // ── Listar firmas de un paciente ─────────────────────────────────────────
  app.get<{ Params: { patientId: string } }>(
    "/patients/:patientId/consent-signatures",
    async (req, reply) => {
      const g = await guardPatient(req);
      if (!g.ok) return reply.status(g.status).send({ error: g.error });

      const signatures = await prisma.consentSignature.findMany({
        where:   { patientId: req.params.patientId },
        orderBy: { requestedAt: "desc" },
        include: {
          template:    { select: { title: true, procedureCode: true } },
          requestedBy: { select: { id: true, name: true } },
        },
      });
      return reply.send({ signatures });
    }
  );

  // ── Solicitar firma de un consentimiento ─────────────────────────────────
  app.post<{
    Params: { patientId: string };
    Body: {
      templateId:      string;
      signatureMethod: SignatureMethod;
      sessionId?:      string;
      notes?:          string;
      signerEmail?:    string;
      signerPhone?:    string;
    };
  }>("/patients/:patientId/consent-signatures", async (req, reply) => {
    const g = await guardPatient(req);
    if (!g.ok) return reply.status(g.status).send({ error: g.error });

    const { templateId, signatureMethod, sessionId, notes, signerEmail, signerPhone } = req.body ?? {};
    if (!templateId || !VALID_METHODS.includes(signatureMethod)) {
      return reply.status(400).send({ error: "templateId y signatureMethod válidos requeridos" });
    }

    const [template, patient] = await Promise.all([
      prisma.consentTemplate.findUnique({ where: { id: templateId } }),
      prisma.patient.findUnique({
        where: { id: g.patient.id },
        include: { identity: true, clinic: { select: { name: true, zapsignApiKey: true, zapsignVerified: true } } },
      }),
    ]);
    if (!template || template.clinicId !== g.patient.clinicId) {
      return reply.status(404).send({ error: "Template no encontrado" });
    }
    if (!patient) return reply.status(404).send({ error: "Paciente no encontrado" });

    const patientName = patient.identity
      ? `${patient.identity.firstName} ${patient.identity.lastName}`
      : (patient.name ?? "Paciente");
    const patientRut = patient.identity?.rut ?? null;

    // Crear el registro local primero
    const signature = await prisma.consentSignature.create({
      data: {
        clinicId:        g.patient.clinicId,
        templateId,
        templateVersion: template.version,
        patientId:       g.patient.id,
        patientName,
        patientRut,
        sessionId:       sessionId ?? null,
        signatureMethod,
        status:          signatureMethod === "in_person_pad" ? "signed" : "pending",
        signedAt:        signatureMethod === "in_person_pad" ? new Date() : null,
        requestedById:   g.payload.userId,
        notes:           notes ?? null,
      },
    });

    let signUrl: string | null = null;

    // Si es ZapSign y la clínica está configurada, crear el doc remoto
    if (signatureMethod === "zapsign") {
      if (!patient.clinic.zapsignVerified || !patient.clinic.zapsignApiKey) {
        return reply.status(400).send({
          error: "La clínica no tiene ZapSign configurado. Usa manual_upload o in_person_pad.",
          signatureId: signature.id,
        });
      }
      const rendered = renderTemplate(template.body, {
        paciente: patientName,
        rut:      patientRut ?? "",
        clinica:  patient.clinic.name,
      });
      const result = await createZapSignDoc({
        apiKey:      patient.clinic.zapsignApiKey,
        name:        template.title,
        text:        rendered,
        signerName:  patientName,
        signerEmail: signerEmail ?? patient.email ?? undefined,
        signerPhone: signerPhone ?? patient.phone ?? undefined,
      });
      if (result.status === "error") {
        await prisma.consentSignature.update({
          where: { id: signature.id },
          data:  { status: "rejected", notes: result.errorMessage ?? "Error ZapSign" },
        });
        return reply.status(502).send({ error: "Error creando documento en ZapSign", detail: result.errorMessage });
      }
      await prisma.consentSignature.update({
        where: { id: signature.id },
        data:  { externalRef: result.externalRef },
      });
      signUrl = result.signUrl;
    }

    audit({
      req, actorId: g.payload.userId, clinicId: g.patient.clinicId,
      action: "create", resourceType: "ClinicalRecord", resourceId: signature.id,
      snapshotAfter: { templateTitle: template.title, method: signatureMethod, status: signature.status },
    });

    return reply.status(201).send({ signature, signUrl });
  });

  // ── Marcar firma como completada manualmente (manual_upload) ────────────
  app.patch<{
    Params: { signatureId: string };
    Body:   { signedDocumentUrl?: string; signedAt?: string; status?: "signed" | "rejected" | "expired" | "cancelled"; notes?: string };
  }>("/consent-signatures/:signatureId", async (req, reply) => {
    let payload;
    try { payload = verifyToken(req.headers.authorization); }
    catch { return reply.status(401).send({ error: "No autorizado" }); }

    const sig = await prisma.consentSignature.findUnique({
      where: { id: req.params.signatureId },
    });
    if (!sig) return reply.status(404).send({ error: "Firma no encontrada" });
    if (payload.role !== "SUPERADMIN" && payload.clinicId !== sig.clinicId) {
      return reply.status(403).send({ error: "Acceso denegado" });
    }

    const { signedDocumentUrl, signedAt, status, notes } = req.body ?? {};

    // Validación: si subimos PDF, limitar tamaño (data URL ~1.2 MB)
    if (signedDocumentUrl && signedDocumentUrl.length > 1_700_000) {
      return reply.status(400).send({ error: "PDF demasiado grande (máx ~1.2 MB)" });
    }

    const updated = await prisma.consentSignature.update({
      where: { id: req.params.signatureId },
      data: {
        ...(signedDocumentUrl !== undefined && { signedDocumentUrl }),
        ...(signedAt          !== undefined && { signedAt: signedAt ? new Date(signedAt) : null }),
        ...(status            !== undefined && { status }),
        ...(notes             !== undefined && { notes }),
        // Si suben PDF pero no marcaron status, asumir signed + now
        ...(signedDocumentUrl && !status ? { status: "signed", signedAt: new Date() } : {}),
      },
    });

    audit({
      req, actorId: payload.userId, clinicId: sig.clinicId,
      action: "update", resourceType: "ClinicalRecord", resourceId: sig.id,
      snapshotBefore: { status: sig.status, signedAt: sig.signedAt },
      snapshotAfter:  { status: updated.status, signedAt: updated.signedAt },
    });

    return reply.send({ signature: updated });
  });

  // ── Renderizar template (para descargar/imprimir antes de firma física) ──
  app.post<{
    Params: { patientId: string };
    Body:   { templateId: string };
  }>("/patients/:patientId/consent-render", async (req, reply) => {
    const g = await guardPatient(req);
    if (!g.ok) return reply.status(g.status).send({ error: g.error });

    const { templateId } = req.body ?? {};
    if (!templateId) return reply.status(400).send({ error: "templateId requerido" });

    const [template, patient] = await Promise.all([
      prisma.consentTemplate.findUnique({ where: { id: templateId } }),
      prisma.patient.findUnique({ where: { id: g.patient.id }, include: { identity: true, clinic: { select: { name: true } } } }),
    ]);
    if (!template || template.clinicId !== g.patient.clinicId) {
      return reply.status(404).send({ error: "Template no encontrado" });
    }
    if (!patient) return reply.status(404).send({ error: "Paciente no encontrado" });

    const patientName = patient.identity
      ? `${patient.identity.firstName} ${patient.identity.lastName}`
      : (patient.name ?? "Paciente");
    const rendered = renderTemplate(template.body, {
      paciente: patientName,
      rut:      patient.identity?.rut ?? "",
      clinica:  patient.clinic.name,
    });
    return reply.send({ title: template.title, body: rendered });
  });

  // ── Webhook ZapSign — recibe notificación cuando el paciente firma ──────
  // Por ahora: marca status='signed' + guarda URL del doc firmado.
  app.post("/webhooks/zapsign", async (req, reply) => {
    reply.status(200).send({ ok: true });

    const body = req.body as {
      event_type?: string;
      token?:      string;
      signed_file_url?: string;
    } | undefined;
    if (!body?.event_type || !body.token) return;
    if (body.event_type !== "doc_signed") return;

    const sig = await prisma.consentSignature.findFirst({
      where: { externalRef: body.token },
    });
    if (!sig) {
      console.warn(`[ZapSign webhook] No signature found for token ${body.token}`);
      return;
    }
    await prisma.consentSignature.update({
      where: { id: sig.id },
      data: {
        status:            "signed",
        signedAt:          new Date(),
        signedDocumentUrl: body.signed_file_url ?? sig.signedDocumentUrl,
      },
    });
    console.info(`[ZapSign webhook] Signature ${sig.id} marked as signed`);
  });
}
