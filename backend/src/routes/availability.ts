import type { FastifyInstance } from "fastify";
import { getWeekAvailability } from "../services/availability/availabilityService";
import prisma from "../config/prisma";

export async function availabilityRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { slug?: string; clinicId?: string; weekStart?: string; service?: string } }>(
    "/availability",
    async (req, reply) => {
      const { slug, clinicId, weekStart, service } = req.query;
      const start = weekStart ?? getMondayOfCurrentWeek();

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

function getMondayOfCurrentWeek(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}
