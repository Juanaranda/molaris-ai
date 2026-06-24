/**
 * Auto-emite boleta SII cuando un Payment de Mercado Pago queda en "approved".
 *
 * Flujo:
 *   webhook MP → Payment.status = "approved" + Booking sync
 *      ↓ (async, no bloquea)
 *   autoEmitBoletaForPayment(paymentId)
 *      ↓
 *   - Si la clínica tiene SII configurado y NO hay boleta previa para este booking:
 *     emite boleta vía OpenFactura
 *   - Si la emisión fue exitosa y la clínica tiene Meta + el paciente tiene phone:
 *     envía el PDF al paciente por WhatsApp
 */

import prisma from "../../config/prisma";
import { emitBoleta } from "./openFacturaService";
import { sendMetaMessage } from "../whatsapp/metaService";

export async function autoEmitBoletaForPayment(paymentId: string): Promise<{
  emitted:    boolean;
  reason?:    string;
  boletaId?:  string;
  folio?:     number | null;
  notified?:  boolean;
}> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      clinic:  true,
      booking: true,
    },
  });
  if (!payment) return { emitted: false, reason: "Payment no encontrado" };
  if (payment.status !== "approved") return { emitted: false, reason: "Payment no está aprobado" };

  const { clinic, booking } = payment;

  // 1. ¿Tiene SII configurado?
  if (!clinic.siiVerified || !clinic.siiApiKey || !clinic.siiRutEmisor || !clinic.siiRazonSocial || !clinic.siiGiro) {
    return { emitted: false, reason: "Clínica sin SII configurado" };
  }

  // 2. ¿Ya hay boleta para este booking/payment?
  if (booking) {
    const existing = await prisma.boleta.findFirst({
      where: { bookingId: booking.id, status: { in: ["issued", "accepted"] } },
    });
    if (existing) return { emitted: false, reason: "Booking ya tiene boleta emitida", boletaId: existing.id };
  }

  // 3. Construir descripción del servicio
  const description = booking?.service
    ? `${booking.service} — ${clinic.name}`
    : payment.description ?? `Atención dental — ${clinic.name}`;
  const rutReceptor  = booking?.patientRut ?? null;
  const patientName  = booking?.patientName ?? null;
  const patientPhone = booking?.patientPhone ?? null;

  // 4. Crear Boleta draft + llamar provider
  const draft = await prisma.boleta.create({
    data: {
      clinicId:     clinic.id,
      bookingId:    booking?.id ?? null,
      documentType: clinic.siiDocumentType ?? 41,
      rutReceptor,
      patientName,
      description,
      netAmount:    Math.round(payment.amount),
      iva:          0,
      totalAmount:  Math.round(payment.amount),
      status:       "draft",
      provider:     clinic.siiProvider ?? "openfactura",
    },
  });

  const result = await emitBoleta({
    apiKey:       clinic.siiApiKey,
    documentType: clinic.siiDocumentType ?? 41,
    rutEmisor:    clinic.siiRutEmisor,
    razonSocial:  clinic.siiRazonSocial,
    giro:         clinic.siiGiro,
    rutReceptor:  rutReceptor ?? undefined,
    receptorName: patientName ?? undefined,
    items:        [{ description, quantity: 1, unitPrice: Math.round(payment.amount) }],
    exenta:       clinic.siiExenta,
  });

  const updated = await prisma.boleta.update({
    where: { id: draft.id },
    data: {
      folio:        result.folio,
      status:       result.status,
      providerRef:  result.providerRef,
      pdfUrl:       result.pdfUrl,
      xmlContent:   result.xml,
      timbreUrl:    result.timbreUrl,
      netAmount:    result.netAmount,
      iva:          result.iva,
      totalAmount:  result.totalAmount,
      emittedAt:    result.status === "issued" ? new Date() : null,
      errorMessage: result.errorMessage,
    },
  });

  if (result.status === "error") {
    console.error(`[AutoBoleta] Emisión falló para payment ${paymentId}: ${result.errorMessage}`);
    return { emitted: false, reason: result.errorMessage, boletaId: updated.id };
  }

  // 5. Notificar al paciente por WhatsApp si está configurado
  let notified = false;
  const hasMeta  = clinic.waVerified && clinic.waPhoneId && clinic.waToken;
  const digits   = patientPhone?.replace(/\D/g, "");
  if (updated.pdfUrl && hasMeta && digits) {
    const firstName = patientName?.split(" ")[0] ?? "";
    const msg = [
      `¡Hola ${firstName}! 👋`,
      ``,
      `Recibimos tu pago. Aquí está tu boleta electrónica:`,
      updated.folio ? `📄 Folio ${updated.folio}` : "",
      `💰 Total: $${updated.totalAmount.toLocaleString("es-CL")} CLP`,
      ``,
      `Descárgala acá:`,
      updated.pdfUrl,
      ``,
      `_${clinic.name} · molari.ai_`,
    ].filter(Boolean).join("\n");

    try {
      await sendMetaMessage(clinic.waPhoneId!, clinic.waToken!, digits, msg);
      notified = true;
    } catch (err) {
      console.error(`[AutoBoleta] Error enviando boleta por WhatsApp:`, err);
    }
  }

  console.info(`[AutoBoleta] Emitida folio ${updated.folio} para payment ${paymentId}${notified ? " + notificada por WA" : ""}`);

  return {
    emitted:  true,
    boletaId: updated.id,
    folio:    updated.folio,
    notified,
  };
}
