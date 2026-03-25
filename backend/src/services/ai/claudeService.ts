import Anthropic from "@anthropic-ai/sdk";
import { config } from "../../config/env";
import { buildSystemPrompt } from "./promptBuilder";
import { galanaConfig } from "../../config/clinics/galana";

const client = new Anthropic({ apiKey: config.anthropicApiKey });

// Mapa de clínicas disponibles
const clinicConfigs: Record<string, typeof galanaConfig> = {
  galana: galanaConfig,
};

interface AIRequestParams {
  message: string;
  clinicId?: string;
  sessionId?: string;
}

export async function getAIResponse({ message, clinicId = "galana" }: AIRequestParams): Promise<string> {
  const clinic = clinicConfigs[clinicId] ?? galanaConfig;
  const systemPrompt = buildSystemPrompt(clinic);

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 500,
    system: systemPrompt,
    messages: [{ role: "user", content: message }],
  });

  const block = response.content[0];
  if (block.type !== "text") throw new Error("Unexpected response type");
  return block.text;
}
