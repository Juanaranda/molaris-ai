import { config } from "../../config/env";
import { sendMetaMessage } from "../whatsapp/metaService";

export type AlertKind =
  | "ai_credits_exhausted"
  | "ai_all_providers_down"
  | "ai_provider_degraded"
  | "ai_fallback_used";

export type AlertSeverity = "info" | "warn" | "critical";

interface AlertOptions {
  kind: AlertKind;
  severity: AlertSeverity;
  message: string;
  detail?: Record<string, unknown>;
  cooldownMs?: number;
}

// Cooldown in-memory por kind+clinic (resetea al reiniciar el proceso, lo cual es OK)
const lastSent = new Map<string, number>();
const DEFAULT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hora

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
  const key = opts.kind;
  const now = Date.now();
  const prev = lastSent.get(key) ?? 0;

  logAlert(opts);

  if (now - prev < cooldown) return; // dentro de cooldown — solo log, no canal externo
  lastSent.set(key, now);

  const text =
    `[molari.ai] ${opts.severity.toUpperCase()} — ${opts.kind}\n\n` +
    `${opts.message}\n` +
    (opts.detail ? `\nDetalle: ${JSON.stringify(opts.detail).slice(0, 400)}` : "");

  await sendWhatsAppAlert(text);
}

export function _resetAlertCooldowns(): void {
  lastSent.clear();
}
