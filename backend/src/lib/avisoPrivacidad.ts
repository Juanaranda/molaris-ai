/**
 * Aviso al paciente de que conversa con un asistente de IA (MOL-11).
 *
 * ESTADO: BORRADOR — PENDIENTE VALIDACIÓN LEGAL. Es un aviso, no un
 * consentimiento: qué hace falta de verdad (consentimiento explícito, otro
 * texto) es la pregunta 1 de la carpeta para el abogado. Mientras tanto, el
 * paciente al menos sabe que le responde una IA y que sus mensajes salen de
 * Chile. El mismo texto vive en el frontend
 * (components/AvisoPrivacidadChat.tsx): si cambia uno, cambiar el otro.
 *
 * En WhatsApp el paciente escribe primero, así que su primer mensaje ya pasó
 * por la IA cuando llega el aviso. Evitarlo (retener ese mensaje hasta que lea
 * el aviso) queda para cuando responda el abogado.
 */

/** Largo máximo del texto propio de la clínica: un saludo, no una política. */
export const MAX_AVISO_CLINICA = 280;

/**
 * La clínica puede escribir un texto propio (config.avisoIa) que va ANTES del
 * aviso. Solo se suma: lo que dice que responde una IA, que se procesa fuera
 * de Chile y el link a la política queda siempre, para que ninguna clínica
 * pueda borrarlo. Si su texto contradice el aviso (ej. "te atiende Carla, de
 * recepción"), el aviso fijo va justo después; que eso baste es pregunta para
 * el abogado.
 *
 * Se limpia también al leer, no solo al guardar: config es JSON y puede traer
 * cualquier cosa de antes de esta regla.
 */
export function textoAvisoDeLaClinica(config: unknown): string | null {
  const valor = (config as { avisoIa?: unknown } | null)?.avisoIa;
  if (typeof valor !== "string") return null;
  const texto = valor.trim().slice(0, MAX_AVISO_CLINICA);
  return texto || null;
}

/** Valida lo que manda el panel. undefined = la clínica no lo cambió. */
export function validarAvisoClinica(
  valor: unknown,
): { ok: true; texto: string | undefined } | { ok: false; error: string } {
  if (valor === undefined || valor === null) return { ok: true, texto: undefined };
  if (typeof valor !== "string") return { ok: false, error: "El texto del aviso debe ser texto." };
  const texto = valor.trim();
  if (texto.length > MAX_AVISO_CLINICA) {
    return { ok: false, error: `El texto del aviso puede tener hasta ${MAX_AVISO_CLINICA} caracteres.` };
  }
  return { ok: true, texto: texto || undefined };
}

export function avisoPrivacidadWhatsApp(nombreClinica: string, urlFrontend: string, textoClinica?: string | null): string {
  const propio = textoClinica?.trim() ? `${textoClinica.trim()}\n\n` : "";
  return (
    propio +
    `Antes de seguir: este chat lo responde un asistente de inteligencia artificial de ${nombreClinica}. ` +
    "Para responderte y agendar tu hora, lo que escribas lo procesan proveedores de IA fuera de Chile. " +
    "Comparte solo la información de salud necesaria para tu consulta.\n\n" +
    `Política de privacidad (borrador): ${urlFrontend.replace(/\/+$/, "")}/legal/privacidad`
  );
}
