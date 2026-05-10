import { FastifyInstance } from "fastify";
import { GoogleGenAI } from "@google/genai";

type ToothType = "incisor" | "canine" | "premolar" | "molar";

const MODEL = "gemini-2.5-flash";

const SYSTEM = `You are a dental SVG illustration expert. Generate precise, anatomically accurate SVG dental illustrations.
Rules:
- Return ONLY the SVG code, no markdown, no explanation
- viewBox="0 0 100 100", no width/height attributes
- Use realistic dental colors: enamel is white-ivory with subtle warm tones
- Include gradients for depth and realism
- Draw anatomically correct occlusal (top-down) view of the tooth crown only
- Add subtle grooves, cusps, and surface details
- Include a thin pink gum collar at the base
- Use <defs> for gradients and filters
- The result must look like a professional dental textbook illustration`;

const PROMPTS: Record<ToothType, string> = {
  incisor:
    "Draw an SVG of a single upper central incisor tooth crown, occlusal top-down view. " +
    "The incisor is roughly rectangular/trapezoidal: wider at the incisal edge, slightly narrower at the cervical (base). " +
    "Show the mesial, distal, labial and lingual surfaces. Add subtle mamelons on the incisal edge, " +
    "a central ridge, marginal ridges, and a cingulum at the base. Pink gum tissue collar around the cervix.",

  canine:
    "Draw an SVG of a single upper canine tooth crown, occlusal top-down view. " +
    "The canine has a prominent central cusp tip at the top, with mesial and distal slopes. " +
    "Show mesial and distal marginal ridges, a central ridge running to the cusp tip, " +
    "lingual ridge and fossa, labial surface convexity. Pink gum tissue collar around the cervix.",

  premolar:
    "Draw an SVG of a single upper first premolar tooth crown, occlusal top-down view. " +
    "It has two cusps (buccal and lingual), a central groove running mesio-distally, " +
    "mesial and distal developmental grooves, two buccal and lingual triangular ridges, " +
    "a central fossa, mesial and distal fossae. Pink gum tissue collar around the cervix.",

  molar:
    "Draw an SVG of a single upper first molar tooth crown, occlusal top-down view. " +
    "It has four main cusps (mesiobuccal, distobuccal, mesiolingual, distolingual) plus the cusp of Carabelli. " +
    "Show the central fossa, buccal groove, lingual groove, oblique ridge connecting mesiobuccal and distolingual cusps, " +
    "mesial and distal triangular ridges, supplemental grooves. Pink gum tissue collar around the cervix.",
};

const cache = new Map<ToothType, string>();

function wrapSvg(inner: string): string {
  if (inner.trim().startsWith("<svg")) return inner;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${inner}</svg>`;
}

function extractSvg(raw: string): string {
  const match = raw.match(/<svg[\s\S]*<\/svg>/i);
  if (match) return match[0];
  const innerMatch = raw.match(/<defs[\s\S]*>[\s\S]*/i) ?? raw.match(/<g[\s\S]*>[\s\S]*/i);
  if (innerMatch) return wrapSvg(innerMatch[0]);
  return wrapSvg(raw.trim());
}

async function generateToothSvg(ai: GoogleGenAI, type: ToothType): Promise<string> {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: [{ text: PROMPTS[type] }] }],
    config: {
      systemInstruction: SYSTEM,
      temperature: 0.4,
    },
  });

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) throw new Error(`Gemini no retornó contenido para ${type}`);

  const cleaned = text.replace(/```svg/gi, "").replace(/```/g, "").trim();
  return extractSvg(cleaned);
}

export async function toothImagesRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { type: string } }>("/tooth-image", async (req, reply) => {
    const type = req.query.type as ToothType;

    if (!PROMPTS[type]) {
      return reply.code(400).send({ error: "Tipo desconocido. Usa: incisor, canine, premolar, molar" });
    }

    const cached = cache.get(type);
    if (cached) {
      reply.header("Content-Type", "image/svg+xml");
      return reply.send(cached);
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return reply.code(503).send({ error: "GEMINI_API_KEY no configurada en .env" });
    }

    const ai = new GoogleGenAI({ apiKey });
    const svg = await generateToothSvg(ai, type);
    cache.set(type, svg);

    reply.header("Content-Type", "image/svg+xml");
    return reply.send(svg);
  });
}
