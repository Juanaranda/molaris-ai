import type { FastifyInstance } from "fastify";
import { getWeekAvailability } from "../services/availability/availabilityService";
import prisma from "../config/prisma";
import { lunesDeLaSemanaEnChile } from "../lib/fechaChile";

export async function availabilityRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { slug?: string; clinicId?: string; weekStart?: string; service?: string } }>(
    "/availability",
    async (req, reply) => {
      const { slug, clinicId, weekStart, service } = req.query;
      const start = weekStart ?? lunesDeLaSemanaEnChile();

      if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) {
        return reply.code(400).send({ error: "weekStart debe ser YYYY-MM-DD" });
      }

      const clinic = slug
        ? await prisma.clinic.findUnique({ where: { slug }, select: { config: true } })
        : clinicId
          ? await prisma.clinic.findUnique({ where: { id: clinicId }, select: { config: true } })
          : null;

      if (!clinic) {
        return reply.code(400).send({ error: "Parámetro 'slug' o 'clinicId' requerido" });
      }

      const days = getWeekAvailability(start, clinic.config as object, service);
      return reply.send({ weekStart: start, service: service ?? null, days });
    }
  );
}
