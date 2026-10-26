import type { FastifyInstance } from "fastify";
import prisma from "../config/prisma";
import { verifyToken } from "./auth";
import { doctoresActivos } from "../lib/doctores";
import { calcularProduccion, type ProfesionalEquipo } from "../services/finanzas/produccion";
import { diaChile, rangoDiaChile, resumirCaja } from "../services/finanzas/caja";
import { audit } from "../services/audit/auditService";

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

  /** El admin de la clínica (la caja todavía no la ven los demás roles). */
  function soloAdmin(authorization: string | undefined):
    | { ok: true; clinicId: string; userId: string }
    | { ok: false; status: number; error: string } {
    let payload;
    try { payload = verifyToken(authorization); }
    catch { return { ok: false, status: 401, error: "No autorizado" }; }
    if (!payload.clinicId) return { ok: false, status: 403, error: "Sin clínica asignada" };
    if (payload.role !== "ADMIN" && payload.role !== "SUPERADMIN") return { ok: false, status: 403, error: "Sin permisos" };
    return { ok: true, clinicId: payload.clinicId, userId: payload.userId };
  }

  async function movimientosDelDia(clinicId: string, dia: string) {
    const { desde, hasta } = rangoDiaChile(dia);
    return prisma.movimientoCaja.findMany({
      where: { clinicId, fecha: { gte: desde, lt: hasta } },
      orderBy: { fecha: "asc" },
    });
  }

  /**
   * GET /api/finanzas/caja?dia=2026-10-26 — lo que entró ese día (hora de
   * Chile), por medio de pago, con quién lo registró, y su cierre si ya se hizo.
   */
  app.get<{ Querystring: { dia?: string } }>("/finanzas/caja", async (req, reply) => {
    const g = soloAdmin(req.headers.authorization);
    if (!g.ok) return reply.status(g.status).send({ error: g.error });
    const dia = req.query.dia ?? diaChile(new Date());
    if (!FECHA.test(dia)) return reply.status(400).send({ error: "Indica el día como AAAA-MM-DD" });

    const [movimientos, cierre] = await Promise.all([
      movimientosDelDia(g.clinicId, dia),
      prisma.cierreCaja.findUnique({ where: { clinicId_dia: { clinicId: g.clinicId, dia } } }),
    ]);
    const quienes = [...new Set([...movimientos.map((m) => m.registradoPor), cierre?.cerradoPor].filter((x): x is string => !!x))];
    const usuarios = quienes.length
      ? await prisma.partnerUser.findMany({ where: { id: { in: quienes }, clinicId: g.clinicId }, select: { id: true, name: true } })
      : [];
    const nombre = (id: string | null | undefined) => usuarios.find((u) => u.id === id)?.name ?? null;

    // Lo que entró después de cerrar no está en el cierre: se muestra aparte.
    const despues = cierre ? movimientos.filter((m) => m.fecha > cierre.cerradoEn) : [];
    return reply.send({
      dia,
      resumen: resumirCaja(movimientos),
      movimientos: movimientos.map((m) => ({
        id: m.id, fecha: m.fecha, monto: m.monto, medio: m.medio, origen: m.origen,
        patientName: m.patientName, patientRut: m.patientRut, doctor: m.doctor,
        registradoPor: m.registradoPor ? nombre(m.registradoPor) ?? "Otra persona" : null,
      })),
      cierre: cierre && {
        cerradoEn: cierre.cerradoEn, cerradoPor: nombre(cierre.cerradoPor), esperado: cierre.esperado,
        efectivoContado: cierre.efectivoContado, diferencia: cierre.diferencia, nota: cierre.nota,
      },
      despuesDelCierre: cierre ? resumirCaja(despues) : null,
    });
  });

  /**
   * POST /api/finanzas/caja/cierre  { dia, efectivoContado, nota? }
   * Cierra la caja del día: guarda lo que el sistema esperaba por medio, el
   * efectivo contado y la diferencia. Uno por día y no se edita.
   */
  app.post<{ Body: { dia?: unknown; efectivoContado?: unknown; nota?: unknown } }>("/finanzas/caja/cierre", async (req, reply) => {
    const g = soloAdmin(req.headers.authorization);
    if (!g.ok) return reply.status(g.status).send({ error: g.error });

    const { dia, efectivoContado, nota } = req.body ?? {};
    if (typeof dia !== "string" || !FECHA.test(dia)) return reply.status(400).send({ error: "Indica el día como AAAA-MM-DD" });
    if (dia > diaChile(new Date())) return reply.status(400).send({ error: "No se puede cerrar un día que todavía no llega" });
    if (typeof efectivoContado !== "number" || !isFinite(efectivoContado) || efectivoContado < 0) {
      return reply.status(400).send({ error: "Indica el efectivo contado (0 o más)" });
    }
    const notaLimpia = typeof nota === "string" ? nota.trim().slice(0, 500) || null : null;

    const { porMedio, total } = resumirCaja(await movimientosDelDia(g.clinicId, dia));
    const esperado = { ...porMedio, total };
    try {
      const cierre = await prisma.cierreCaja.create({
        data: {
          clinicId: g.clinicId, dia, esperado, efectivoContado,
          diferencia: efectivoContado - porMedio.cash, nota: notaLimpia, cerradoPor: g.userId,
        },
      });
      audit({
        req, actorId: g.userId, clinicId: g.clinicId, action: "create", resourceType: "CierreCaja",
        resourceId: cierre.id, snapshotAfter: { dia, esperado, efectivoContado, diferencia: cierre.diferencia, nota: notaLimpia },
      });
      return reply.status(201).send({ ok: true });
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") {
        return reply.status(409).send({ error: "La caja de ese día ya está cerrada" });
      }
      throw e;
    }
  });
}
