/**
 * Aviso al paciente de que conversa con un asistente de IA (MOL-11).
 *
 * ESTADO: BORRADOR — PENDIENTE VALIDACIÓN LEGAL. Es un aviso, no un
 * consentimiento: qué hace falta de verdad (consentimiento explícito, otro
 * texto) es la pregunta 1 de la carpeta para el abogado. Mientras tanto, el
 * paciente al menos sabe que le responde una IA y que sus mensajes salen de
 * Chile. El mismo texto vive en el frontend (lib/avisoPrivacidad.ts): si
 * cambia uno, cambiar el otro.
 *
 * En WhatsApp el paciente escribe primero, así que su primer mensaje ya pasó
 * por la IA cuando llega el aviso. Evitarlo (retener ese mensaje hasta que lea
 * el aviso) queda para cuando responda el abogado.
 */
export function avisoPrivacidadWhatsApp(nombreClinica: string, urlFrontend: string): string {
  return (
    `Antes de seguir: este chat lo responde un asistente de inteligencia artificial de ${nombreClinica}. ` +
    "Para responderte y agendar tu hora, lo que escribas lo procesan proveedores de IA fuera de Chile. " +
    "Comparte solo la información de salud necesaria para tu consulta.\n\n" +
    `Política de privacidad (borrador): ${urlFrontend.replace(/\/+$/, "")}/legal/privacidad`
  );
}
