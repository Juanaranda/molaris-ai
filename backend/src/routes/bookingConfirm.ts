import { FastifyInstance } from "fastify";
import prisma from "../config/prisma";
import { verifyToken } from "./auth";
import { canPerform } from "../services/auth/clinicalPermissions";
import {
  validarTokenConfirmacion, confirmarBooking, rechazarBooking,
} from "../services/booking/confirmation";
import { avisarPacienteDecision } from "../services/booking/notifyPatient";

/**
 * Confirmación de las horas que pide el agente.
 *
 * Estas rutas van SIN sesión a propósito: el profesional abre el link desde
 * WhatsApp en el celular. Lo que autoriza es el token firmado, que expira con
 * el plazo y deja de servir apenas alguien decide.
 *
 * Las respuestas nunca dicen si un token es "de otra clínica" ni devuelven
 * datos de la cita cuando el token no valida — un link filtrado no puede
 * convertirse en una forma de leer la agenda ajena.
 */
export async function bookingConfirmRoutes(app: FastifyInstance) {
  // GET /api/confirmar/:token — qué hora es y en qué estado está
  app.get<{ Params: { token: string } }>("/confirmar/:token", async (req, reply) => {
    const r = await validarTokenConfirmacion(req.params.token);
    if (!r.ok) return reply.status(410).send({ error: r.motivo });

    const b = r.booking;
    return reply.send({
      paciente: b.patientName,
      servicio: b.service,
      doctor: b.doctor,
      fecha: b.date.toISOString().slice(0, 10),
      hora: b.time,
      clinica: b.clinic.name,
      venceEl: b.confirmDeadline?.toISOString() ?? null,
    });
  });

  // POST /api/confirmar/:token — el profesional aprueba
  app.post<{ Params: { token: string } }>("/confirmar/:token", async (req, reply) => {
    const r = await validarTokenConfirmacion(req.params.token);
    if (!r.ok) return reply.status(410).send({ error: r.motivo });

    const res = await confirmarBooking(r.booking.id, { nombre: r.booking.doctor });
    if (!res.ok) {
      return reply.status(409).send({
        error: res.motivo,
        mensaje: res.motivo === "ocupado"
          ? "Esa hora ya fue tomada por otra cita mientras esperaba tu confirmación."
          : "Esta solicitud ya fue resuelta.",
      });
    }
    avisarPacienteDecision({ bookingId: r.booking.id, decision: "confirmada" }).catch(() => {});
    return reply.send({ ok: true, estado: "confirmed" });
  });

  // POST /api/confirmar/:token/rechazar — el profesional no puede, con motivo
  app.post<{ Params: { token: string }; Body: { motivo?: string } }>(
    "/confirmar/:token/rechazar",
    async (req, reply) => {
      const r = await validarTokenConfirmacion(req.params.token);
      if (!r.ok) return reply.status(410).send({ error: r.motivo });

      const res = await rechazarBooking(r.booking.id, { nombre: r.booking.doctor }, req.body?.motivo);
      if (!res.ok) return reply.status(409).send({ error: res.motivo, mensaje: "Esta solicitud ya fue resuelta." });

      // El rechazo SIEMPRE sale con alternativas: dejar al paciente con un "no"
      // seco es perderlo, y quien pidió hora ya demostró que la quiere.
      avisarPacienteDecision({ bookingId: r.booking.id, decision: "rechazada", motivo: req.body?.motivo })
        .catch(() => {});
      return reply.send({ ok: true, estado: "cancelled" });
    },
  );

  // ── Desde la app, con sesión ────────────────────────────────────────────────
  // Mismo efecto, pero para quien ya está dentro: recepción resolviendo la cola
  // de pendientes sin abrir el link del correo de otra persona.
  app.post<{ Params: { id: string }; Body: { accion: "confirmar" | "rechazar"; motivo?: string } }>(
    "/bookings/:id/decision",
    async (req, reply) => {
      let payload;
      try { payload = verifyToken(req.headers.authorization); }
      catch { return reply.status(401).send({ error: "No autorizado" }); }

      const user = await prisma.partnerUser.findUnique({
        where: { id: payload.userId },
        select: { id: true, name: true, role: true, clinicalRole: true, clinicId: true },
      });
      if (!user?.clinicId) return reply.status(403).send({ error: "Sin clínica asignada" });
      if (!canPerform(user.role, user.clinicalRole, "confirm_bookings")) {
        return reply.status(403).send({ error: "Tu rol no puede confirmar horas" });
      }

      const b = await prisma.booking.findUnique({ where: { id: req.params.id }, select: { clinicId: true } });
      if (!b || b.clinicId !== user.clinicId) return reply.status(404).send({ error: "Cita no encontrada" });

      const { accion, motivo } = req.body ?? {};
      const quien = { id: user.id, nombre: user.name };
      const res = accion === "rechazar"
        ? await rechazarBooking(req.params.id, quien, motivo)
        : await confirmarBooking(req.params.id, quien);

      if (!res.ok) {
        return reply.status(409).send({
          error: res.motivo,
          mensaje: res.motivo === "ocupado"
            ? "Esa hora ya fue tomada por otra cita."
            : "Esta solicitud ya fue resuelta.",
        });
      }
      avisarPacienteDecision({
        bookingId: req.params.id,
        decision: accion === "rechazar" ? "rechazada" : "confirmada",
        motivo,
      }).catch(() => {});
      return reply.send({ ok: true, estado: res.estado });
    },
  );
}
