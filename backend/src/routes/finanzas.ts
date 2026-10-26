import type { FastifyInstance } from "fastify";
import prisma from "../config/prisma";
import { verifyToken } from "./auth";
import { doctoresActivos } from "../lib/doctores";
import { calcularProduccion, type ProfesionalEquipo } from "../services/finanzas/produccion";

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Finanzas de la clínica (MOL-58). Por ahora, la producción del período; las
 * liquidaciones y los costos llegan cuando esté definido cómo paga cada
 * clínica (MOL-59).
 */
export async function finanzasRoutes(app: FastifyInstance) {
  /**
   * GET /api/finanzas/produccion?desde=2026-10-01&hasta=2026-10-31
   * El admin ve la clínica y a cada profesional. Un usuario ve solo su propia
   * fila, si su cuenta está unida a un profesional del equipo.
   */
  app.get<{ Querystring: { desde?: string; hasta?: string } }>("/finanzas/produccion", async (req, reply) => {
    let payload;
    try { payload = verifyToken(req.headers.authorization); }
    catch { return reply.status(401).send({ error: "No autorizado" }); }
    if (!payload.clinicId) return reply.status(403).send({ error: "Sin clínica asignada" });

    const { desde, hasta } = req.query;
    if (!desde || !hasta || !FECHA.test(desde) || !FECHA.test(hasta) || desde > hasta) {
      return reply.status(400).send({ error: "Indica el período con desde y hasta (AAAA-MM-DD)" });
    }
    const inicio = new Date(`${desde}T00:00:00.000Z`);
    const fin = new Date(`${hasta}T23:59:59.999Z`);
    if (fin.getTime() - inicio.getTime() > 366 * 24 * 3600 * 1000) {
      return reply.status(400).send({ error: "El período puede ser de hasta un año" });
    }

    const clinica = await prisma.clinic.findUnique({ where: { id: payload.clinicId }, select: { config: true } });
    const doctores = doctoresActivos((clinica?.config as { doctors?: { id?: string; name?: string; userId?: string }[] } | null)?.doctors);
    const equipo: ProfesionalEquipo[] = doctores
      .filter((d) => typeof d.id === "string" && typeof d.name === "string")
      .map((d) => ({ id: d.id as string, name: d.name as string }));

    // Un usuario (no admin) solo ve lo suyo: el profesional unido a su cuenta.
    const esAdmin = payload.role === "ADMIN" || payload.role === "SUPERADMIN";
    const propio = esAdmin ? null : doctores.find((d) => d.userId === payload.userId)?.id;
    if (!esAdmin && !propio) {
      return reply.status(403).send({ error: "Tu cuenta no está unida a un profesional del equipo" });
    }

    const [citas, abonos] = await Promise.all([
      prisma.booking.findMany({
        where: { clinicId: payload.clinicId, date: { gte: inicio, lte: fin }, ...(propio ? { doctorId: propio } : {}) },
        select: { id: true, doctor: true, doctorId: true, date: true, status: true, amountTotal: true, amountPaid: true },
      }),
      prisma.accountEntry.findMany({
        where: { clinicId: payload.clinicId, kind: "payment", createdAt: { gte: inicio, lte: fin } },
        select: { amount: true, bookingId: true },
      }),
    ]);

    const produccion = calcularProduccion(citas, abonos, equipo, new Date());
    if (propio) {
      return reply.send({ desde, hasta, profesionales: produccion.profesionales.filter((p) => p.id === propio) });
    }
    return reply.send({ desde, hasta, ...produccion });
  });
}
