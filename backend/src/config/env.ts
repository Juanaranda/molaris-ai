import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: Number(process.env.PORT) || 3000,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
  groqApiKey: process.env.GROQ_API_KEY!,
  nodeEnv: process.env.NODE_ENV || "development",
};
