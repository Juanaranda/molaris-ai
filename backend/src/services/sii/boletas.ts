/**
 * Boleta electrónica de un pago de la caja (MOL-63): un pago, una boleta
 * vigente, por lo que pagó el paciente y con el medio con que pagó.
 *
 * La boleta se emite desde la caja del día (a mano) o sola cuando llega un
 * pago de Mercado Pago. Antes de llamar a OpenFactura queda un borrador en la
 * base, tomado con un bloqueo por pago: dos clics seguidos no emiten dos.
 */
import prisma from "../../config/prisma";
import { rutCanonico } from "../../lib/rut";
import { diaChile } from "../finanzas/caja";
import { armarBoleta, emitirDte, ErrorOpenFactura, montosBoleta, organizacion } from "./openFacturaService";

/** Un error con el código HTTP que corresponde y un mensaje para la recepción. */
export class ErrorBoleta extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

/** Un borrador más viejo que esto quedó a medias (se cayó el servidor): se puede retomar. */
const BORRADOR_ABANDONADO_MS = 2 * 60_000;

const NOMBRE_POR_ORIGEN: Record<string, string> = {
  plan: "Abono a tratamiento dental",
  abono: "Abono a cuenta",
};

/** Lo que dice la línea de la boleta. Nada clínico más allá de la prestación. */
export function nombreDelItem(origen: string, servicio: string | null | undefined): string {
  return NOMBRE_POR_ORIGEN[origen] ?? (servicio?.trim() || "Atención dental");
}

export async function emitirBoletaDeMovimiento(movimientoId: string, clinicId: string) {
  const mov = await prisma.movimientoCaja.findFirst({
    where: { id: movimientoId, clinicId },
    include: { clinic: { select: { siiVerified: true, siiApiKey: true, siiExenta: true } } },
  });
  if (!mov) throw new ErrorBoleta("Pago no encontrado", 404);
  if (mov.monto <= 0) throw new ErrorBoleta("Una corrección de un pago no lleva boleta", 400);
  const { siiVerified, siiApiKey, siiExenta } = mov.clinic;
  if (!siiVerified || !siiApiKey) {
    throw new ErrorBoleta("La boleta electrónica no está activada. Conéctala en Configuración → Integraciones.", 400);
  }

  const servicio = mov.bookingId
    ? (await prisma.booking.findUnique({ where: { id: mov.bookingId }, select: { service: true } }))?.service
    : null;
  const descripcion = nombreDelItem(mov.origen, servicio);
  const rut = rutCanonico(mov.patientRut);
  const montos = montosBoleta(mov.monto, siiExenta);

  // Reserva la boleta del pago: el bloqueo hace que dos pedidos al mismo
  // tiempo se esperen, y el segundo ve el borrador del primero.
  const boleta = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`select pg_advisory_xact_lock(hashtext(${movimientoId}))`;
    const previa = await tx.boleta.findFirst({ where: { movimientoId }, orderBy: { createdAt: "desc" } });
    if (previa && (previa.status === "issued" || previa.status === "accepted")) {
      throw new ErrorBoleta(`Este pago ya tiene boleta${previa.folio ? ` (folio ${previa.folio})` : ""}`, 409);
    }
    if (previa?.status === "draft" && Date.now() - previa.updatedAt.getTime() < BORRADOR_ABANDONADO_MS) {
      throw new ErrorBoleta("La boleta de este pago se está emitiendo", 409);
    }
    const datos = {
      documentType: siiExenta ? 41 : 39, rutReceptor: rut, patientName: mov.patientName, description: descripcion,
      netAmount: montos.neto, iva: montos.iva, totalAmount: montos.total, status: "draft", errorMessage: null,
    };
    // Un intento fallido se retoma en la misma fila: la Idempotency-Key
    // depende de ella y de `intentos`.
    return previa
      ? tx.boleta.update({ where: { id: previa.id }, data: datos })
      : tx.boleta.create({ data: { ...datos, clinicId, movimientoId, bookingId: mov.bookingId, provider: "openfactura" } });
  });

  try {
    const emisor = await organizacion(siiApiKey);
    const dte = armarBoleta({
      exenta: siiExenta, emisor, fecha: diaChile(new Date()), medio: mov.medio,
      receptor: rut ? { rut, nombre: mov.patientName } : null,
      items: [{ nombre: descripcion, monto: mov.monto }],
    });
    const { token, folio } = await emitirDte(siiApiKey, dte, `molari-boleta-${boleta.id}-${boleta.intentos}`);
    return await prisma.boleta.update({
      where: { id: boleta.id },
      data: { status: "issued", folio, providerRef: token, emittedAt: new Date(), errorMessage: null },
    });
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "Error emitiendo la boleta";
    // Si OpenFactura la rechazó, el reintento va con otra clave; si no se sabe
    // qué pasó, con la misma, para no emitir dos veces.
    const rechazada = e instanceof ErrorOpenFactura && e.rechazada;
    await prisma.boleta.update({
      where: { id: boleta.id },
      data: { status: "error", errorMessage: mensaje.slice(0, 1000), ...(rechazada ? { intentos: { increment: 1 } } : {}) },
    });
    throw new ErrorBoleta(mensaje, 502);
  }
}
