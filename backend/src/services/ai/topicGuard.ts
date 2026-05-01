/**
 * topicGuard — dos capas de defensa de contexto
 *
 * PRE-LLM (léxico, gratis): bloquea mensajes claramente fuera de dominio
 * POST-LLM (heurístico):    detecta respuestas que se salieron de scope y las reemplaza
 */

// ── PRE-LLM ────────────────────────────────────────────────────────────────

const OFF_TOPIC_PATTERNS = [
  /escr[ií](be|ir|beme|bir).*(c[oó]digo|code|script|programa|funci[oó]n|clase|sql|python|javascript|html|css)/i,
  /\b(recipe|receta de cocina|ingredientes|cocinar|platillo|gastronomía)\b/i,
  /\b(clima|weather|temperatura|pronóstico del tiempo)\b/i,
  /\b(política|elecciones|presidente|gobierno|partido político|candidato)\b/i,
  /\b(chiste|broma|joke|poema|cuento|historia ficticia|rap|canción)\b/i,
  /\b(traduce|translate|traducción)\b.*\b(del|from|al|to)\b/i,
  /\b(matemáticas|ecuación|integral|derivada|álgebra lineal)\b/i,
  /\b(crypto|bitcoin|inversión financiera|bolsa de valores|forex)\b/i,
  /\b(película|serie|netflix|juego de video|anime|videogame)\b/i,
  /\b(derechos de autor|copyright|plagio|licencia de software)\b/i,
  /\b(horóscopo|tarot|astrología|signo zodiacal)\b/i,
  /\b(actúa como|pretende ser|eres ahora|ignora tus instrucciones|jailbreak|DAN|modo developer)\b/i,
  /\b(háblame de tu|quién te creó|qué modelo eres|cuál es tu sistema|instrucciones del sistema)\b/i,
];

const DENTAL_SIGNALS = [
  /diente|dientes|muela|muelas|dental|dentista|odontol/i,
  /carie|empaste|corona|implante|blanqueamiento|limpieza|extracción/i,
  /endodoncia|ortodoncia|brackets|alineador|carilla/i,
  /dolor|sangr|infección|golpe|fractura|urgencia/i,
  /agendar|reservar|cita|hora|disponible|horario|turno/i,
  /precio|valor|costo|presupuesto|cuánto|cuanto/i,
  /dr\.|dra\.|doctor|doctora|especialista/i,
  /clínica|clinica|atención|atencion|consulta/i,
];

export type GuardResult =
  | { allowed: true }
  | { allowed: false; reason: "off_topic" | "rate_limit" | "too_long" | "jailbreak" };

export function checkTopic(message: string): GuardResult {
  if (message.length > 600) return { allowed: false, reason: "too_long" };

  // Jailbreak / prompt injection → bloquear primero, antes de dental signals
  const jailbreakPattern = /\b(actúa como|pretende ser|eres ahora|ignora tus instrucciones|jailbreak|DAN|modo developer|instrucciones del sistema|system prompt)\b/i;
  if (jailbreakPattern.test(message)) return { allowed: false, reason: "jailbreak" };

  if (DENTAL_SIGNALS.some((r) => r.test(message))) return { allowed: true };
  if (OFF_TOPIC_PATTERNS.some((r) => r.test(message))) return { allowed: false, reason: "off_topic" };

  return { allowed: true };
}

// ── POST-LLM ───────────────────────────────────────────────────────────────
//
// Detecta si la respuesta del modelo se salió del dominio dental.
// Usado para filtrar respuestas antes de enviarlas al paciente.

const OUT_OF_DOMAIN_SIGNALS = [
  // El modelo explicó algo de código
  /```[\s\S]{20,}```/,
  /\b(función|function|variable|array|bucle|loop|algoritmo|compilar)\b/i,
  // Recetas / cocina
  /\b(ingredientes:|precalienta|hornear|mezcla|taza de|cucharada)\b/i,
  // Noticias / política
  /\b(presidente|gobierno|ministro|elecciones|partido)\b/i,
  // El modelo reveló su naturaleza o instrucciones
  /\b(soy (un|una) (IA|inteligencia artificial|modelo|asistente de IA)|mis instrucciones|mi sistema)\b/i,
  // El modelo habló de inversiones / crypto
  /\b(bitcoin|ethereum|acciones|bolsa|dividendos)\b/i,
];

export function isOutOfDomain(reply: string): boolean {
  return OUT_OF_DOMAIN_SIGNALS.some((r) => r.test(reply));
}

export const OFF_TOPIC_REPLY =
  "Solo puedo ayudarte con consultas sobre nuestra clínica dental: servicios, precios, horarios y agendamiento. ¿En qué te puedo ayudar? 🦷";

export const JAILBREAK_REPLY =
  "Solo estoy aquí para ayudarte con tu salud dental. ¿Tienes alguna consulta sobre nuestros servicios o quieres agendar una cita? 🦷";

export const TOO_LONG_REPLY =
  "Tu mensaje es demasiado largo. ¿Puedes resumir tu consulta en pocas palabras?";
