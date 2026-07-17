import { config } from "../../config/env";
import { sendEmail } from "./emailService";

/**
 * Emails de molari (empresa) hacia sus clientes: bienvenida al registrarse,
 * cumpleaños, novedades. Distinto de los emails/WhatsApp que la clínica manda
 * a SUS pacientes — acá el remitente es molari y el destinatario es el
 * dueño/doctor de la cuenta.
 *
 * Modo de redirección: mientras no haya dominio verificado en Resend, si
 * `MOLARI_EMAIL_REDIRECT_TO` está seteado, todo se redirige a ese correo, con
 * un aviso de a quién iba dirigido realmente. Así se prueba sin dominio.
 */

const BRAND = {
  teal:  "#1A5C7A",
  dark:  "#0C1B26",
  coral: "#D95F45",
  cream: "#F7F5F1",
  muted: "#607281",
  border: "#E5E0D9",
};

/* ── Tipos de mensaje ─────────────────────────────────────────────────────── */
export type MolariEmail =
  | { type: "welcome"; accountType?: "solo" | "clinic"; clinicName?: string }
  | { type: "birthday" }
  | { type: "announcement"; title: string; bodyHtml: string; ctaLabel?: string; ctaUrl?: string };

export type MolariEmailType = MolariEmail["type"];

/* ── Layout base (email-safe, estilos inline) ─────────────────────────────── */
function layout(opts: { preview: string; heading: string; bodyHtml: string; ctaLabel?: string; ctaUrl?: string }): string {
  const cta = opts.ctaLabel && opts.ctaUrl
    ? `<tr><td style="padding:8px 0 4px;">
         <a href="${opts.ctaUrl}" style="display:inline-block;background:${BRAND.coral};color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:14px;">${opts.ctaLabel}</a>
       </td></tr>`
    : "";
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${opts.heading}</title></head>
<body style="margin:0;padding:0;background:${BRAND.cream};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${opts.preview}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.cream};padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FDFCFB;border:1px solid ${BRAND.border};border-radius:20px;overflow:hidden;">
      <tr><td style="padding:22px 32px;border-bottom:1px solid ${BRAND.border};">
        <span style="font-size:20px;font-weight:800;letter-spacing:-0.5px;color:${BRAND.dark};">M<span style="color:${BRAND.coral};">o</span>lari<span style="color:${BRAND.coral};">.ai</span></span>
      </td></tr>
      <tr><td style="padding:32px;">
        <h1 style="margin:0 0 16px;font-size:22px;line-height:1.25;color:${BRAND.dark};">${opts.heading}</h1>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px;line-height:1.6;color:${BRAND.muted};">
          ${opts.bodyHtml}
          ${cta}
        </table>
      </td></tr>
      <tr><td style="padding:20px 32px;border-top:1px solid ${BRAND.border};font-size:12px;color:${BRAND.muted};">
        molari.ai — IA para clínicas dentales · Santiago, Chile
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function p(text: string): string {
  return `<tr><td style="padding:0 0 14px;">${text}</td></tr>`;
}

/* ── Render por tipo ──────────────────────────────────────────────────────── */
function render(msg: MolariEmail, toName: string): { subject: string; html: string; text: string } {
  const nombre = toName?.trim() || "";
  const saludo = nombre ? `Hola ${nombre},` : "Hola,";
  const panelUrl = `${config.frontendUrl}/partners/dashboard`;

  switch (msg.type) {
    case "welcome": {
      const esSolo = msg.accountType === "solo";
      const quien = esSolo ? "tu consulta" : (msg.clinicName ? msg.clinicName : "tu clínica");
      return {
        subject: "Bienvenido a molari.ai 🦷",
        html: layout({
          preview: "Tu recepcionista con IA ya está lista. Estos son los primeros pasos.",
          heading: "¡Bienvenido a molari.ai!",
          bodyHtml:
            p(saludo) +
            p(`Gracias por sumar <strong>${quien}</strong> a molari.ai. Tu recepcionista con IA ya está lista para responder a tus pacientes en WhatsApp y en tu web, agendar citas y hacer el seguimiento — 24/7.`) +
            p("Para arrancar, te recomendamos:") +
            p("· Completar tu horario de atención<br>· Conectar tu WhatsApp o el widget web<br>· Probar el agente escribiéndole como si fueras un paciente") +
            p("Cualquier duda, respondé este correo y te ayudamos."),
          ctaLabel: "Ir a mi panel",
          ctaUrl: panelUrl,
        }),
        text: `${saludo}\n\nGracias por sumar ${quien} a molari.ai. Tu recepcionista con IA ya está lista.\n\nPrimeros pasos: completá tu horario, conectá WhatsApp o el widget web, y probá el agente.\n\nTu panel: ${panelUrl}`,
      };
    }
    case "birthday": {
      return {
        subject: "¡Feliz cumpleaños! 🎉 — molari.ai",
        html: layout({
          preview: "Todo el equipo de molari.ai te desea un feliz cumpleaños.",
          heading: "¡Feliz cumpleaños! 🎉",
          bodyHtml:
            p(saludo) +
            p("Todo el equipo de molari.ai te desea un excelente día. Gracias por confiar en nosotros para cuidar la relación con tus pacientes.") +
            p("Que tengas un gran año, personal y profesional. 🦷"),
        }),
        text: `${saludo}\n\n¡Feliz cumpleaños! Todo el equipo de molari.ai te desea un excelente día. 🎉`,
      };
    }
    case "announcement": {
      return {
        subject: msg.title,
        html: layout({
          preview: msg.title,
          heading: msg.title,
          bodyHtml: p(saludo) + msg.bodyHtml,
          ctaLabel: msg.ctaLabel,
          ctaUrl: msg.ctaUrl,
        }),
        text: `${saludo}\n\n${msg.bodyHtml.replace(/<[^>]+>/g, " ")}`,
      };
    }
  }
}

/* ── Envío (con redirección segura) ───────────────────────────────────────── */
export async function sendMolariEmail(input: {
  to: string;
  toName?: string;
  message: MolariEmail;
}): Promise<{ delivered: boolean; redirectedTo?: string }> {
  const rendered = render(input.message, input.toName ?? "");
  const redirectTo = config.email.molariRedirectTo;

  let to = input.to;
  let subject = rendered.subject;
  let html = rendered.html;

  if (redirectTo) {
    // Modo prueba: todo va al correo del dueño, avisando el destinatario real.
    to = redirectTo;
    subject = `[→ ${input.to}] ${subject}`;
    const banner = `<div style="background:#FFF4E5;border:1px solid #F0C67C;color:#8A5A00;font-family:sans-serif;font-size:12px;padding:10px 16px;text-align:center;">Modo prueba — este correo iba dirigido a <strong>${input.to}</strong></div>`;
    html = html.replace(/(<body[^>]*>)/i, `$1${banner}`);
  }

  await sendEmail({ to, subject, html, text: rendered.text });
  return { delivered: true, redirectedTo: redirectTo || undefined };
}
