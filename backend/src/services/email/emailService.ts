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

export async function sendEmail({ to, subject, html, text }: SendEmailOpts): Promise<void> {
  const apiKey = config.email.resendApiKey;
  const from = config.email.from;

  if (!apiKey) {
    // Modo dev: no hay proveedor → log para no bloquear el flujo
    console.warn(
      `[Email:DEV] (sin RESEND_API_KEY — no se envió)\n  To: ${to}\n  Subject: ${subject}\n  ${text ?? html.replace(/<[^>]+>/g, " ").slice(0, 300)}`
    );
    return;
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
    }
  } catch (err) {
    console.error("[Email] Falló el envío:", err instanceof Error ? err.message : err);
  }
}
