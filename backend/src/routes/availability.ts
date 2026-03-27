import type { FastifyInstance } from "fastify";
import { getWeekAvailability } from "../services/availability/availabilityService";

export async function availabilityRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { clinicId?: string; weekStart?: string; service?: string } }>(
    "/availability",
    async (req, reply) => {
      const { weekStart, service } = req.query;
      const start = weekStart ?? getMondayOfCurrentWeek();

      if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) {
        return reply.code(400).send({ error: "weekStart debe ser YYYY-MM-DD" });
      }

      const days = getWeekAvailability(start, service);
      return reply.send({ weekStart: start, service: service ?? null, days });
    }
  );
}

function getMondayOfCurrentWeek(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day; // ajustar para que lunes = inicio
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}
