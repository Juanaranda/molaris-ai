import { config } from "../../config/env";
import { sendMetaMessage } from "../whatsapp/metaService";

export type AlertKind =
  | "ai_credits_exhausted"
  | "ai_all_providers_down"
  | "ai_provider_degraded"
  | "ai_fallback_used"
  | "ai_budget_exceeded"
  | "agent_disabled"
  | "agent_enabled";

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
    case "ai_fallback_used":
    case "agent_enabled":
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
  const text =
    `[molari.ai] ${opts.severity.toUpperCase()} — ${opts.kind}\n\n` +
    `${opts.message}\n` +
    (action ? `\n${action}\n` : "") +
    (opts.detail ? `\nDetalle: ${JSON.stringify(opts.detail).slice(0, 400)}` : "");

  await sendWhatsAppAlert(text);
}

export function _resetAlertCooldowns(): void {
  lastSent.clear();
}
