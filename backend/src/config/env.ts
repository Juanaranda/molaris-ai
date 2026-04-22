import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || "development",
  jwtSecret: process.env.JWT_SECRET ?? "molaris-dev-secret-change-in-prod",
  openRouter: {
    apiKey: process.env.OPENROUTER_API_KEY ?? "",
    models: {
      fast:     process.env.OPENROUTER_MODEL_FAST     ?? "meta-llama/llama-3.1-8b-instruct:free",
      balanced: process.env.OPENROUTER_MODEL_BALANCED ?? "meta-llama/llama-3.3-70b-instruct",
      smart:    process.env.OPENROUTER_MODEL_SMART    ?? "anthropic/claude-haiku-4-5",
    },
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID ?? "",
    authToken:  process.env.TWILIO_AUTH_TOKEN  ?? "",
    from:       process.env.TWILIO_WHATSAPP_FROM ?? "",
  },
};
