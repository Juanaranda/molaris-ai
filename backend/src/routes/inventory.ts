import type { FastifyInstance } from "fastify";
import prisma from "../config/prisma";
import { verifyToken } from "./auth";

/**
 * Inventario / stock de insumos clínicos (Issue #45).
 * CRUD de insumos + movimientos de entrada/salida con actualización de stock.
 * Scope por clínica. Permisos: cualquier usuario con clínica asignada.
 */
export async function inventoryRoutes(app: FastifyInstance) {

  function auth(req: { headers: { authorization?: string } }):
    | { ok: true; clinicId: string; userId: string }
    | { ok: false; status: number; error: string }
  {
    let payload;
    try { payload = verifyToken(req.headers.authorization); }
    catch { return { ok: false, status: 401, error: "No autorizado" }; }
    if (!payload.clinicId) return { ok: false, status: 403, error: "Sin clínica asignada" };
    return { ok: true, clinicId: payload.clinicId, userId: payload.userId };
  }

  // GET /api/inventory — lista de insumos activos con flag de stock bajo
  app.get("/inventory", async (req, reply) => {
    const a = auth(req);
    if (!a.ok) return reply.status(a.status).send({ error: a.error });

    const items = await prisma.inventoryItem.findMany({
      where: { clinicId: a.clinicId, active: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
    const withFlags = items.map((i) => ({ ...i, lowStock: i.currentStock <= i.minStock }));
    return reply.send({
      items: withFlags,
      lowStockCount: withFlags.filter((i) => i.lowStock).length,
    });
  });

  // POST /api/inventory — crear insumo
  app.post<{
    Body: { name: string; category?: string; unit?: string; currentStock?: number; minStock?: number; cost?: number };
  }>("/inventory", async (req, reply) => {
    const a = auth(req);
    if (!a.ok) return reply.status(a.status).send({ error: a.error });

    const { name, category, unit, currentStock, minStock, cost } = req.body ?? {};
    if (!name || typeof name !== "string" || !name.trim()) {
      return reply.status(400).send({ error: "El nombre es obligatorio" });
    }

    const item = await prisma.inventoryItem.create({
      data: {
        clinicId: a.clinicId,
        name: name.trim(),
        category: category?.trim() || null,
        unit: unit?.trim() || "unidad",
        currentStock: Number(currentStock) || 0,
        minStock: Number(minStock) || 0,
        cost: cost != null ? Number(cost) : null,
      },
    });
    return reply.status(201).send({ item });
  });

  // PATCH /api/inventory/:id — editar insumo (no toca stock)
  app.patch<{
    Params: { id: string };
    Body: { name?: string; category?: string | null; unit?: string; minStock?: number; cost?: number | null };
  }>("/inventory/:id", async (req, reply) => {
    const a = auth(req);
    if (!a.ok) return reply.status(a.status).send({ error: a.error });

    const existing = await prisma.inventoryItem.findFirst({
      where: { id: req.params.id, clinicId: a.clinicId },
    });
    if (!existing) return reply.status(404).send({ error: "Insumo no encontrado" });

    const { name, category, unit, minStock, cost } = req.body ?? {};
    const data: Record<string, unknown> = {};
    if (name !== undefined)     data.name = name.trim();
    if (category !== undefined) data.category = category?.trim() || null;
    if (unit !== undefined)     data.unit = unit?.trim() || "unidad";
    if (minStock !== undefined) data.minStock = Number(minStock) || 0;
    if (cost !== undefined)     data.cost = cost === null ? null : Number(cost);

    const item = await prisma.inventoryItem.update({ where: { id: req.params.id }, data });
    return reply.send({ item });
  });

  // DELETE /api/inventory/:id — baja lógica
  app.delete<{ Params: { id: string } }>("/inventory/:id", async (req, reply) => {
    const a = auth(req);
    if (!a.ok) return reply.status(a.status).send({ error: a.error });

    const existing = await prisma.inventoryItem.findFirst({
      where: { id: req.params.id, clinicId: a.clinicId },
    });
    if (!existing) return reply.status(404).send({ error: "Insumo no encontrado" });

    await prisma.inventoryItem.update({ where: { id: req.params.id }, data: { active: false } });
    return reply.send({ ok: true });
  });

  // POST /api/inventory/:id/movement — entrada/salida/ajuste de stock
  app.post<{
    Params: { id: string };
    Body: { kind: "in" | "out" | "adjustment"; quantity: number; reason?: string };
  }>("/inventory/:id/movement", async (req, reply) => {
    const a = auth(req);
    if (!a.ok) return reply.status(a.status).send({ error: a.error });

    const { kind, quantity, reason } = req.body ?? {};
    if (!["in", "out", "adjustment"].includes(kind)) {
      return reply.status(400).send({ error: "Tipo de movimiento inválido (in | out | adjustment)" });
    }
    const qty = Number(quantity);
    if (!(qty > 0)) return reply.status(400).send({ error: "La cantidad debe ser mayor a 0" });

    const item = await prisma.inventoryItem.findFirst({
      where: { id: req.params.id, clinicId: a.clinicId },
    });
    if (!item) return reply.status(404).send({ error: "Insumo no encontrado" });

    const delta = kind === "in" ? qty : -qty;
    const newStock = Math.max(0, item.currentStock + delta);

    const [, updated] = await prisma.$transaction([
      prisma.inventoryMovement.create({
        data: { clinicId: a.clinicId, itemId: item.id, kind, quantity: qty, reason: reason?.trim() || null, createdBy: a.userId },
      }),
      prisma.inventoryItem.update({ where: { id: item.id }, data: { currentStock: newStock } }),
    ]);

    return reply.status(201).send({ item: { ...updated, lowStock: updated.currentStock <= updated.minStock } });
  });
}
