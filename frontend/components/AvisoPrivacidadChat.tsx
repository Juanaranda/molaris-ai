/**
 * Aviso al paciente antes de conversar con el asistente de IA (MOL-11).
 *
 * ESTADO: BORRADOR — PENDIENTE VALIDACIÓN LEGAL. Es un aviso, no un
 * consentimiento: qué hace falta de verdad es la pregunta 1 de la carpeta
 * para el abogado. Mismo texto que el de WhatsApp en el backend
 * (backend/src/lib/avisoPrivacidad.ts): si cambia uno, cambiar el otro.
 *
 * La clínica puede escribir un texto propio (textoClinica) que va antes, pero
 * no reemplazarlo: lo de la IA, fuera de Chile y la política queda siempre.
 *
 * El enlace abre en otra pestaña porque el chat suele vivir dentro del sitio
 * de la clínica (iframe del widget).
 */
export function AvisoPrivacidadChat({ nombreClinica, textoClinica }: { nombreClinica: string; textoClinica?: string | null }) {
  return (
    <p role="note" className="rounded-control bg-gray-100 px-3 py-2 text-xs leading-relaxed text-ink-muted">
      {textoClinica?.trim() && <span className="block mb-1.5 whitespace-pre-line text-ink">{textoClinica.trim()}</span>}
      Este chat lo responde un asistente de inteligencia artificial de {nombreClinica}. Para responderte
      y agendar tu hora, lo que escribas lo procesan proveedores de IA fuera de Chile. Comparte solo la
      información de salud necesaria para tu consulta.{" "}
      <a href="/legal/privacidad" target="_blank" rel="noopener noreferrer"
        className="font-semibold text-brand underline underline-offset-2">
        Política de privacidad (borrador)
      </a>
    </p>
  );
}
