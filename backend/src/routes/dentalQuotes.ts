import type { FastifyInstance } from "fastify";
import prisma from "../config/prisma";
import { verifyToken } from "./auth";

interface QuoteItem {
  toothFDI?: string;
  surfaces?: string;
  prestacion: string;
  unitPrice: number;
  quantity?: number;
  discount?: number;
}

interface CreateQuoteBody {
  patientRut?: string;
  patientName: string;
  doctor?: string;
  discount?: number;
  notes?: string;
  paymentInfo?: string;
  items: QuoteItem[];
}

interface UpdateQuoteBody {
  status?: "draft" | "sent" | "accepted" | "rejected";
  doctor?: string;
  discount?: number;
  notes?: string;
  paymentInfo?: string;
  accepted?: boolean;
  items?: QuoteItem[];
}

function calcTotal(items: QuoteItem[], generalDiscount = 0): number {
  const subtotal = items.reduce((acc, item) => {
    const q = item.quantity ?? 1;
    const itemDiscount = item.discount ?? 0;
    return acc + item.unitPrice * q * (1 - itemDiscount / 100);
  }, 0);
  return subtotal * (1 - generalDiscount / 100);
}

const quoteSelect = {
  id: true, patientRut: true, patientName: true, doctor: true,
  status: true, discount: true, totalAmount: true,
  notes: true, paymentInfo: true, accepted: true, sentAt: true,
  createdAt: true, updatedAt: true,
  items: {
    select: {
      id: true, toothFDI: true, surfaces: true, prestacion: true,
      unitPrice: true, quantity: true, discount: true, total: true,
    },
  },
} as const;

export async function dentalQuotesRoutes(app: FastifyInstance) {
  // GET /api/dental-quotes?patientRut=...
  app.get<{ Querystring: { patientRut?: string } }>("/dental-quotes", async (req, reply) => {
    let payload;
    try { payload = verifyToken(req.headers.authorization); }
    catch { return reply.status(401).send({ error: "No autorizado" }); }
    if (!payload.clinicId) return reply.status(403).send({ error: "Sin clínica" });

    const quotes = await prisma.dentalQuote.findMany({
      where: {
        clinicId: payload.clinicId,
        ...(req.query.patientRut ? { patientRut: req.query.patientRut } : {}),
      },
      select: quoteSelect,
      orderBy: { createdAt: "desc" },
    });
    return reply.send(quotes);
  });

  // POST /api/dental-quotes
  app.post<{ Body: CreateQuoteBody }>("/dental-quotes", async (req, reply) => {
    let payload;
    try { payload = verifyToken(req.headers.authorization); }
    catch { return reply.status(401).send({ error: "No autorizado" }); }
    if (!payload.clinicId) return reply.status(403).send({ error: "Sin clínica" });

    const { patientRut, patientName, doctor, discount = 0, notes, paymentInfo, items = [] } = req.body ?? {};
    if (!patientName) return reply.status(400).send({ error: "patientName requerido" });

    const total = calcTotal(items, discount);

    const quote = await prisma.dentalQuote.create({
      data: {
        clinicId: payload.clinicId,
        patientRut: patientRut ?? null,
        patientName,
        doctor: doctor ?? null,
        discount,
        totalAmount: total,
        notes: notes ?? null,
        paymentInfo: paymentInfo ?? null,
        items: {
          create: items.map((item) => {
            const q = item.quantity ?? 1;
            const d = item.discount ?? 0;
            return {
              toothFDI: item.toothFDI ?? null,
              surfaces: item.surfaces ?? null,
              prestacion: item.prestacion,
              unitPrice: item.unitPrice,
              quantity: q,
              discount: d,
              total: item.unitPrice * q * (1 - d / 100),
            };
          }),
        },
      },
      select: quoteSelect,
    });
    return reply.status(201).send(quote);
  });

  // PATCH /api/dental-quotes/:id
  app.patch<{ Params: { id: string }; Body: UpdateQuoteBody }>("/dental-quotes/:id", async (req, reply) => {
    let payload;
    try { payload = verifyToken(req.headers.authorization); }
    catch { return reply.status(401).send({ error: "No autorizado" }); }
    if (!payload.clinicId) return reply.status(403).send({ error: "Sin clínica" });

    const existing = await prisma.dentalQuote.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.clinicId !== payload.clinicId) {
      return reply.status(404).send({ error: "Presupuesto no encontrado" });
    }

    const { status, doctor, discount, notes, paymentInfo, accepted, items } = req.body ?? {};

    const effectiveDiscount = discount ?? existing.discount;

    // If items are provided, replace them
    let updateData: Record<string, unknown> = {
      ...(status !== undefined ? { status, ...(status === "sent" ? { sentAt: new Date() } : {}) } : {}),
      ...(doctor !== undefined ? { doctor: doctor || null } : {}),
      ...(discount !== undefined ? { discount } : {}),
      ...(notes !== undefined ? { notes } : {}),
      ...(paymentInfo !== undefined ? { paymentInfo } : {}),
      ...(accepted !== undefined ? { accepted } : {}),
    };

    if (items !== undefined) {
      const total = calcTotal(items, effectiveDiscount);
      updateData.totalAmount = total;
      // Delete old items and recreate
      await prisma.dentalQuoteItem.deleteMany({ where: { quoteId: req.params.id } });
      await prisma.dentalQuoteItem.createMany({
        data: items.map((item) => {
          const q = item.quantity ?? 1;
          const d = item.discount ?? 0;
          return {
            quoteId: req.params.id,
            toothFDI: item.toothFDI ?? null,
            surfaces: item.surfaces ?? null,
            prestacion: item.prestacion,
            unitPrice: item.unitPrice,
            quantity: q,
            discount: d,
            total: item.unitPrice * q * (1 - d / 100),
          };
        }),
      });
    } else if (discount !== undefined) {
      // Recalculate total with existing items
      const existingItems = await prisma.dentalQuoteItem.findMany({ where: { quoteId: req.params.id } });
      const pseudoItems = existingItems.map((i) => ({
        prestacion: i.prestacion ?? "",
        unitPrice: i.unitPrice,
        quantity: i.quantity,
        discount: i.discount,
      }));
      updateData.totalAmount = calcTotal(pseudoItems, effectiveDiscount);
    }

    const updated = await prisma.dentalQuote.update({
      where: { id: req.params.id },
      data: updateData,
      select: quoteSelect,
    });
    return reply.send(updated);
  });

  // DELETE /api/dental-quotes/:id
  app.delete<{ Params: { id: string } }>("/dental-quotes/:id", async (req, reply) => {
    let payload;
    try { payload = verifyToken(req.headers.authorization); }
    catch { return reply.status(401).send({ error: "No autorizado" }); }
    if (!payload.clinicId) return reply.status(403).send({ error: "Sin clínica" });

    const existing = await prisma.dentalQuote.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.clinicId !== payload.clinicId) {
      return reply.status(404).send({ error: "Presupuesto no encontrado" });
    }

    await prisma.dentalQuote.delete({ where: { id: req.params.id } });
    return reply.send({ ok: true });
  });
}
