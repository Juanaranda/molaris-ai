import { config } from "../../config/env";

/**
 * Servicio de email (Issue #55). Provider: Resend.
 * Sin API key configurada → escribe el correo en consola (modo dev). Con key → envía de verdad.
 * Reusable para recuperación de contraseña, DPA (#38), notificaciones, etc.
 */

interface SendEmailOpts {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Devuelve si el correo salió. Los llamadores que no les importa pueden ignorar
 * el resultado (bienvenida, cumpleaños); los que sí — el código de verificación,
 * donde un envío fallido deja al usuario esperando algo que nunca llega —
 * tienen que mirarlo. Sigue sin lanzar: un correo caído no debe tumbar la request.
 */
export async function sendEmail({ to, subject, html, text }: SendEmailOpts): Promise<{ ok: boolean; error?: string }> {
  const apiKey = config.email.resendApiKey;
  const from = config.email.from;

  if (!apiKey) {
    // Modo dev: no hay proveedor → log para no bloquear el flujo. Cuenta como
    // entregado a propósito, si no el flujo local quedaría intransitable.
    console.warn(
      `[Email:DEV] (sin RESEND_API_KEY — no se envió)\n  To: ${to}\n  Subject: ${subject}\n  ${text ?? html.replace(/<[^>]+>/g, " ").slice(0, 300)}`
    );
    return { ok: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html, ...(text ? { text } : {}) }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => res.statusText);
      console.error(`[Email] Resend rechazó el envío (${res.status}): ${body.slice(0, 200)}`);
      return { ok: false, error: `resend_${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    console.error("[Email] Falló el envío:", err instanceof Error ? err.message : err);
    return { ok: false, error: "network" };
  }
}
