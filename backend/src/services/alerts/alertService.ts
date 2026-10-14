import { config } from "../../config/env";
import { sendMetaMessage } from "../whatsapp/metaService";

export type AlertKind =
  | "ai_credits_exhausted"
  | "ai_all_providers_down"
  | "ai_provider_degraded"
  | "ai_fallback_used"
  | "ai_budget_exceeded"
  | "agent_disabled"
  | "agent_enabled"
  // Infraestructura (MOL-42): lo que el vigilante revisa cada pocos minutos.
  | "db_unreachable"
  | "db_recovered"
  | "scheduler_stalled"
  | "scheduler_recovered"
  | "error_spike"
  // Al arrancar: confirma cada deploy y sirve de prueba al configurar un canal.
  | "backend_started";

export type AlertSeverity = "info" | "warn" | "critical";

interface AlertOptions {
  kind: AlertKind;
  severity: AlertSeverity;
  message: string;
  detail?: Record<string, unknown>;
  cooldownMs?: number;
}

// Cooldown in-memory por kind+clínica (resetea al reiniciar el proceso, OK).
// La clave incluye el clinicId: con la clave solo por kind, la alerta de una
// clínica silenciaba la de todas las demás durante una hora.
const lastSent = new Map<string, number>();
const DEFAULT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hora

/**
 * Qué hacer con cada alerta. La alerta llega a WhatsApp cuando algo ya está
 * roto — que traiga el paso siguiente evita tener que buscarlo justo en ese
 * momento. Solo se enlazan URLs que existen; para lo demás, la instrucción.
 */
function actionFor(kind: AlertKind): string | null {
  const dashboard = `${config.frontendUrl}/partners/dashboard`;
  switch (kind) {
    case "ai_credits_exhausted":
      return `→ Recargar saldo: https://openrouter.ai/credits`;
    case "ai_all_providers_down":
    case "ai_provider_degraded":
      return `→ Revisar el estado del proveedor y los logs del backend en Railway.\n` +
             `   El agente se reactiva solo cuando el proveedor vuelva.`;
    case "ai_budget_exceeded":
      return `→ El agente se reactiva solo cuando se renueve la cuota diaria (medianoche).\n` +
             `   Para subir el cap de esta clínica: ${dashboard} → Mi Clínica.`;
    case "agent_disabled":
      return `→ Reactivar cuando corresponda: ${dashboard}`;
    case "db_unreachable":
      // El 29/9 fue la cuota del plan gratis de Neon: lo primero a mirar.
      return `→ Revisar el proyecto en Neon (console.neon.tech): si el cómputo está suspendido o sin cuota.\n` +
             `   Cuando vuelva, si el backend no se recupera solo, Redeploy en Railway.`;
    case "scheduler_stalled":
      return `→ Recordatorios o confirmaciones pueden no estar saliendo.\n` +
             `   Revisar los logs del backend en Railway; un Redeploy reinicia los schedulers.`;
    case "error_spike":
      return `→ Revisar los errores en Sentry o en los logs del backend en Railway.`;
    case "ai_fallback_used":
    case "agent_enabled":
    case "db_recovered":
    case "scheduler_recovered":
    case "backend_started":
      return null; // informativas: no hay nada que hacer
  }
}

function logAlert({ kind, severity, message, detail }: AlertOptions): void {
  const prefix = severity === "critical" ? "[ALERT-CRITICAL]" : severity === "warn" ? "[ALERT]" : "[INFO]";
  const tail = detail ? ` ${JSON.stringify(detail)}` : "";
  console.warn(`${prefix} ${kind}: ${message}${tail}`);
}

async function sendWhatsAppAlert(text: string): Promise<void> {
  const phoneId = config.alerts.adminPhoneId;
  const token = config.alerts.adminToken;
  const to = config.alerts.adminPhone;
  if (!phoneId || !token || !to) return;
  try {
    await sendMetaMessage(phoneId, token, to, text);
  } catch (err) {
    console.error("[Alert] Falló envío WhatsApp:", err instanceof Error ? err.message : err);
  }
}

/**
 * Telegram: no depende de tener la cuenta de Meta configurada, que es justo lo
 * que dejaba las alertas solo en el log. Sin token o chat, no hace nada.
 */
async function sendTelegramAlert(text: string): Promise<void> {
  const token = config.alerts.telegramToken;
  const chatId = config.alerts.telegramChatId;
  if (!token || !chatId) return;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error("[Alert] Telegram respondió", res.status);
  } catch (err) {
    console.error("[Alert] Falló envío Telegram:", err instanceof Error ? err.message : err);
  }
}

export async function triggerAlert(opts: AlertOptions): Promise<void> {
  const cooldown = opts.cooldownMs ?? DEFAULT_COOLDOWN_MS;
  const clinicId = typeof opts.detail?.clinicId === "string" ? opts.detail.clinicId : "global";
  const key = `${opts.kind}:${clinicId}`;
  const now = Date.now();
  const prev = lastSent.get(key) ?? 0;

  logAlert(opts);

  if (now - prev < cooldown) return; // dentro de cooldown — solo log, no canal externo
  lastSent.set(key, now);

  const action = actionFor(opts.kind);
  const ambiente = config.alerts.ambiente ? ` · ${config.alerts.ambiente}` : "";
  const text =
    `[molari.ai${ambiente}] ${opts.severity.toUpperCase()} — ${opts.kind}\n\n` +
    `${opts.message}\n` +
    (action ? `\n${action}\n` : "") +
    (opts.detail ? `\nDetalle: ${JSON.stringify(opts.detail).slice(0, 400)}` : "");

  await Promise.all([sendWhatsAppAlert(text), sendTelegramAlert(text)]);
}

export function _resetAlertCooldowns(): void {
  lastSent.clear();
}
