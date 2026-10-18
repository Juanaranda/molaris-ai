import { config } from "../../config/env";

/**
 * Envía un código de verificación a un celular (MOL-52): por WhatsApp y, si
 * no se puede, por SMS.
 *
 * - WhatsApp: plantilla de autenticación de Meta con botón "copiar código".
 *   El código va en el cuerpo y en el botón, como pide Meta (documentación
 *   "Copy code authentication templates": el botón se envía como sub_type
 *   "url", índice "0").
 * - SMS: Twilio, por si el número no tiene WhatsApp o la plantilla falla.
 * - Sin ninguno configurado: fuera de producción el código se escribe en el
 *   log para poder probar; en producción el envío falla y se dice.
 */
export type CanalCodigo = "whatsapp" | "sms" | "log";
export type ResultadoEnvio = { delivered: true; canal: CanalCodigo } | { delivered: false };

const GRAPH = "https://graph.facebook.com/v19.0";

async function porWhatsApp(telefono: string, codigo: string): Promise<boolean> {
  const { waPhoneId, waToken, waTemplate, waIdioma } = config.codigosTelefono;
  if (!waPhoneId || !waToken || !waTemplate) return false;
  try {
    const res = await fetch(`${GRAPH}/${waPhoneId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${waToken}` },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: telefono.replace(/^\+/, ""),
        type: "template",
        template: {
          name: waTemplate,
          language: { code: waIdioma },
          components: [
            { type: "body", parameters: [{ type: "text", text: codigo }] },
            { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: codigo }] },
          ],
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error("[codigo] WhatsApp respondió", res.status, (await res.text()).slice(0, 200));
    return res.ok;
  } catch (e) {
    console.error("[codigo] WhatsApp falló:", e instanceof Error ? e.message : e);
    return false;
  }
}

async function porSms(telefono: string, codigo: string): Promise<boolean> {
  const { accountSid, authToken } = config.twilio;
  const { smsFrom } = config.codigosTelefono;
  if (!accountSid || !authToken || !smsFrom) return false;
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
      },
      body: new URLSearchParams({
        To: telefono,
        From: smsFrom,
        Body: `Tu código de molari es ${codigo}. Vence en 15 minutos. No lo compartas con nadie.`,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error("[codigo] SMS respondió", res.status, (await res.text()).slice(0, 200));
    return res.ok;
  } catch (e) {
    console.error("[codigo] SMS falló:", e instanceof Error ? e.message : e);
    return false;
  }
}

export async function enviarCodigoPorTelefono(telefono: string, codigo: string): Promise<ResultadoEnvio> {
  if (await porWhatsApp(telefono, codigo)) return { delivered: true, canal: "whatsapp" };
  if (await porSms(telefono, codigo)) return { delivered: true, canal: "sms" };
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[codigo] Sin WhatsApp ni SMS configurados. Código para ${telefono}: ${codigo}`);
    return { delivered: true, canal: "log" };
  }
  return { delivered: false };
}
