import type { FastifyInstance } from "fastify";
import prisma from "../config/prisma";
import { verifyToken } from "./auth";

export async function boletaRoutes(app: FastifyInstance) {
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

  // La boleta se emite por pago, desde la caja del día (POST
  // /finanzas/caja/movimientos/:id/boleta, MOL-63), no por cita: así sale
  // por lo que se pagó y no por el monto de la cita.

  // ── Listar boletas de la clínica ───────────────────────────────────────────
  // GET /api/clinics/:id/boletas?status=&limit=
  app.get<{
    Params: { id: string };
    Querystring: { status?: string; limit?: string };
  }>("/clinics/:id/boletas", async (req, reply) => {
    const g = guardClinic(req);
    if (!g.ok) return reply.status(g.status).send({ error: g.error });

    const limit = Math.min(Math.max(Number(req.query.limit ?? 50), 1), 500);
    const boletas = await prisma.boleta.findMany({
      where: {
        clinicId: req.params.id,
        ...(req.query.status ? { status: req.query.status } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true, folio: true, status: true, totalAmount: true, netAmount: true, iva: true,
        rutReceptor: true, patientName: true, description: true, pdfUrl: true,
        emittedAt: true, createdAt: true, errorMessage: true,
        bookingId: true,
      },
    });
    return reply.send({ boletas });
  });
}
