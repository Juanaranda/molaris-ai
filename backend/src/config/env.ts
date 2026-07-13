import dotenv from "dotenv";
dotenv.config();

const DEV_JWT_FALLBACK = "molari-dev-secret-only-for-local-development-not-prod";
const isProduction = process.env.NODE_ENV === "production";
const jwtSecret = process.env.JWT_SECRET ?? (isProduction ? "" : DEV_JWT_FALLBACK);

if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error(
    "JWT_SECRET no configurada o demasiado corta (mínimo 32 caracteres). " +
    "Agrega JWT_SECRET al archivo .env antes de iniciar el servidor."
  );
}

if (isProduction && jwtSecret === DEV_JWT_FALLBACK) {
  throw new Error("JWT_SECRET inseguro en producción. Configura un secret único.");
}

const metaVerifyToken = process.env.META_VERIFY_TOKEN ?? (isProduction ? "" : "molari_verify_token_dev");
if (isProduction && !metaVerifyToken) {
  throw new Error(
    "META_VERIFY_TOKEN no configurada en producción. " +
    "Agrega META_VERIFY_TOKEN al archivo .env antes de iniciar el servidor."
  );
}

export const config = {
  port: Number(process.env.PORT) || 3001,
  nodeEnv: process.env.NODE_ENV || "development",
  jwtSecret,
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  openRouter: {
    apiKey: process.env.OPENROUTER_API_KEY ?? "",
    models: {
      fast:     process.env.OPENROUTER_MODEL_FAST     ?? "meta-llama/llama-3.1-8b-instruct:free",
      balanced: process.env.OPENROUTER_MODEL_BALANCED ?? "anthropic/claude-haiku-4-5",
      smart:    process.env.OPENROUTER_MODEL_SMART    ?? "anthropic/claude-haiku-4-5",
      reserve:  process.env.OPENROUTER_MODEL_RESERVE  ?? "google/gemini-2.5-flash",
    },
  },
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:3000",
  // Base pública del backend para los redirect_uri de OAuth (Issue #48).
  oauthRedirectBase: process.env.OAUTH_REDIRECT_BASE ?? "http://localhost:3001",
  // Mercado Pago OAuth — "conectar con un click" (Issue #48)
  mercadoPago: {
    clientId:     process.env.MP_CLIENT_ID ?? "",
    clientSecret: process.env.MP_CLIENT_SECRET ?? "",
    // Secret del webhook (panel MP → Webhooks) para validar x-signature (#61).
    // Vacío = no se valida (dev / aún no configurado).
    webhookSecret: process.env.MP_WEBHOOK_SECRET ?? "",
  },
  // Presupuesto diario de IA por clínica en USD (#59). 0 = sin límite.
  ai: {
    dailyBudgetUsd: Number(process.env.AI_DAILY_BUDGET_USD ?? 5),
  },
  clinics: {
    // KYC (#66): si true, una clínica no aprobada no puede operar el agente público.
    // En beta lo dejamos false para no bloquear el QA; en prod se pone true.
    requireApproval: process.env.CLINIC_REQUIRE_APPROVAL === "true",
  },
  // Email (Issue #55) — Resend. Sin key → modo dev (log en consola).
  email: {
    resendApiKey: process.env.RESEND_API_KEY ?? "",
    from:         process.env.EMAIL_FROM ?? "molari.ai <onboarding@resend.dev>",
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID ?? "",
    authToken:  process.env.TWILIO_AUTH_TOKEN  ?? "",
    from:       process.env.TWILIO_WHATSAPP_FROM ?? "",
    // WhatsApp de entrada por Twilio (número de beta compartido). Todos los
    // mensajes entrantes se enrutan a esta clínica (por slug).
    betaClinicSlug:    process.env.TWILIO_BETA_CLINIC_SLUG ?? "",
    // Validación de firma X-Twilio-Signature. Apagada por defecto en beta para
    // evitar fricción por mismatch de URL detrás del proxy; encender en prod.
    validateSignature: process.env.TWILIO_VALIDATE_SIGNATURE === "true",
    webhookUrl:        process.env.TWILIO_WEBHOOK_URL ?? "",
  },
  meta: {
    verifyToken: metaVerifyToken,
    appSecret:   process.env.META_APP_SECRET ?? "",
  },
  groq: {
    apiKey: process.env.GROQ_API_KEY ?? "",
    model:  process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
  },
  alerts: {
    // WhatsApp del admin (Juan) para alertas operacionales.
    // Reusa la cuenta Meta de la clínica principal o una dedicada.
    adminPhoneId: process.env.ALERT_WA_PHONE_ID ?? "",
    adminToken:   process.env.ALERT_WA_TOKEN   ?? "",
    adminPhone:   process.env.ALERT_WA_TO      ?? "",
  },
};
