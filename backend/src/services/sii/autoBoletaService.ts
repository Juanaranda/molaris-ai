/**
 * Emite sola la boleta de un pago de Mercado Pago aprobado, si la clínica
 * tiene la boleta electrónica activada, y se la avisa al paciente por
 * WhatsApp. Lo llama el webhook de Mercado Pago sin esperar: si falla, el
 * pago queda en la caja sin boleta y se emite desde ahí.
 */
import prisma from "../../config/prisma";
import { emitirBoletaDeMovimiento } from "./boletas";
import { sendMetaMessage } from "../whatsapp/metaService";

export async function autoEmitBoletaForPayment(paymentId: string): Promise<{ emitted: boolean; reason?: string; boletaId?: string }> {
  const mov = await prisma.movimientoCaja.findUnique({
    where: { paymentId },
    include: { clinic: { select: { name: true, siiVerified: true, waVerified: true, waPhoneId: true, waToken: true } } },
  });
  if (!mov) return { emitted: false, reason: "El pago no está en la caja" };
  if (!mov.clinic.siiVerified) return { emitted: false, reason: "Clínica sin boleta electrónica activada" };

  const boleta = await emitirBoletaDeMovimiento(mov.id, mov.clinicId);

  // El PDF no se manda: OpenFactura lo tiene listo recién en unos minutos.
  const { waVerified, waPhoneId, waToken, name } = mov.clinic;
  const telefono = mov.bookingId
    ? (await prisma.booking.findUnique({ where: { id: mov.bookingId }, select: { patientPhone: true } }))?.patientPhone?.replace(/\D/g, "")
    : null;
  if (waVerified && waPhoneId && waToken && telefono) {
    const nombre = mov.patientName?.split(" ")[0] ?? "";
    const texto = [
      `¡Hola${nombre ? ` ${nombre}` : ""}! Recibimos tu pago de $${boleta.totalAmount.toLocaleString("es-CL")}.`,
      boleta.folio ? `Te emitimos la boleta electrónica N° ${boleta.folio}.` : "Te emitimos la boleta electrónica.",
      ``,
      `_${name}_`,
    ].join("\n");
    await sendMetaMessage(waPhoneId, waToken, telefono, texto)
      .catch((err) => console.error("[AutoBoleta] No se pudo avisar por WhatsApp:", err));
  }
  return { emitted: true, boletaId: boleta.id };
}
