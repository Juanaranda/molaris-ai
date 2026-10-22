import type { FastifyInstance } from "fastify";
import prisma from "../config/prisma";
import { verifyToken, construirSesion } from "./auth";
import { audit } from "../services/audit/auditService";
import { crearInvitacion, leerInvitacion, aceptarInvitacion, validarEdicion, miPerfilProfesional, editarMiPerfil } from "../services/equipo/invitaciones";

/**
 * Invitaciones a profesionales (MOL-54). Crearlas es del admin de la clínica;
 * leerlas y aceptarlas es público (el token del link es la credencial).
 */
const MENSAJE: Record<string, string> = {
  no_existe: "Este link no existe o la clínica ya no tiene a este profesional. Pídele uno nuevo a la clínica.",
  vencida: "Este link venció. Pídele uno nuevo a la clínica.",
  usada: "Este link ya se usó. Si ya creaste tu cuenta, inicia sesión.",
  correo_en_uso: "Ya existe una cuenta con ese correo. Usa otro o escríbenos para unirla a esta clínica.",
};

export async function invitacionRoutes(app: FastifyInstance) {
  // POST /api/clinics/:id/doctores/:doctorId/invitacion — genera el link (y lo manda por correo si hay)
  app.post<{ Params: { id: string; doctorId: string } }>("/clinics/:id/doctores/:doctorId/invitacion", async (req, reply) => {
    let payload;
    try { payload = verifyToken(req.headers.authorization); }
    catch { return reply.status(401).send({ error: "No autorizado" }); }
    if (payload.role === "USER") return reply.status(403).send({ error: "Sin permisos" });
    if (payload.role !== "SUPERADMIN" && payload.clinicId !== req.params.id) {
      return reply.status(403).send({ error: "Acceso denegado" });
    }

    const r = await crearInvitacion({ clinicId: req.params.id, doctorId: req.params.doctorId, creadaPor: payload.userId });
    if (!r.ok) {
      return r.motivo === "ya_tiene_cuenta"
        ? reply.status(409).send({ error: "Este profesional ya tiene su cuenta: edita sus datos él mismo." })
        : reply.status(404).send({ error: "No encontramos a ese profesional. Guarda el equipo y vuelve a intentar." });
    }
    audit({
      req, clinicId: req.params.id, actorId: payload.userId, action: "create",
      resourceType: "InvitacionProfesional", resourceId: req.params.doctorId,
      snapshotAfter: { enviadaA: r.enviadaA ?? null, expiresAt: r.expiresAt },
    });
    return reply.send({ ok: true, link: r.link, expiresAt: r.expiresAt, enviadaA: r.enviadaA ?? null, redirigidaA: r.redirigidaA ?? null });
  });

  // GET /api/invitaciones/:token — lo que ve el profesional al abrir el link
  app.get<{ Params: { token: string } }>("/invitaciones/:token", async (req, reply) => {
    const r = await leerInvitacion(req.params.token);
    if (!r.ok) return reply.status(r.motivo === "no_existe" ? 404 : 410).send({ error: MENSAJE[r.motivo], motivo: r.motivo });
    return reply.send({ clinica: r.clinica, profesional: r.profesional });
  });

  // POST /api/invitaciones/:token — crea la cuenta del profesional y entra
  app.post<{ Params: { token: string } }>("/invitaciones/:token", async (req, reply) => {
    const r = await aceptarInvitacion(req.params.token, req.body);
    if (!r.ok) {
      if (r.motivo === "datos") return reply.status(400).send({ error: r.error });
      const status = r.motivo === "correo_en_uso" ? 409 : r.motivo === "no_existe" ? 404 : 410;
      return reply.status(status).send({ error: MENSAJE[r.motivo], motivo: r.motivo });
    }
    const user = await prisma.partnerUser.findUniqueOrThrow({ where: { id: r.userId }, include: { clinic: true } });
    if (user.clinicId) {
      audit({
        req, clinicId: user.clinicId, actorId: user.id, action: "create",
        resourceType: "PartnerUser", resourceId: user.id,
      });
    }
    return reply.status(201).send(construirSesion(user));
  });

  // GET /api/profesional/perfil — el perfil del profesional unido a esta cuenta
  app.get("/profesional/perfil", async (req, reply) => {
    let payload;
    try { payload = verifyToken(req.headers.authorization); }
    catch { return reply.status(401).send({ error: "No autorizado" }); }
    if (!payload.clinicId) return reply.send({ perfil: null });
    const r = await miPerfilProfesional(payload.userId, payload.clinicId);
    return reply.send(r ?? { perfil: null });
  });

  // PATCH /api/profesional/perfil — el profesional edita lo suyo
  app.patch("/profesional/perfil", async (req, reply) => {
    let payload;
    try { payload = verifyToken(req.headers.authorization); }
    catch { return reply.status(401).send({ error: "No autorizado" }); }
    if (!payload.clinicId) return reply.status(404).send({ error: "No tienes un perfil de profesional." });
    const v = validarEdicion(req.body);
    if (!v.ok) return reply.status(400).send({ error: v.error });
    const ok = await editarMiPerfil(payload.userId, payload.clinicId, v.perfil);
    if (!ok) return reply.status(404).send({ error: "No tienes un perfil de profesional en esta clínica." });
    return reply.send(await miPerfilProfesional(payload.userId, payload.clinicId));
  });
}
