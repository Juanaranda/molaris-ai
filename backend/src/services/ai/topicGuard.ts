/**
 * topicGuard — pre-filtro léxico gratuito
 *
 * Detecta mensajes claramente off-topic antes de llamar al LLM.
 * Ahorra tokens y evita uso abusivo.
 * Si el mensaje parece dental/médico o es ambiguo → deja pasar (false).
 */

// Patrones que indican claramente que NO es una consulta dental
const OFF_TOPIC_PATTERNS = [
  /escr[ií](be|ir|beme|bir).*(c[oó]digo|code|script|programa|funci[oó]n|clase|sql|python|javascript|html)/i,
  /\b(recipe|receta de cocina|ingredientes|cocinar|platillo)\b/i,
  /\b(clima|weather|temperatura|pronóstico)\b/i,
  /\b(política|elecciones|presidente|gobierno|partido político)\b/i,
  /\b(chiste|broma|joke|poema|cuento|historia ficticia)\b/i,
  /\b(traduce|translate|traducción)\b.*\b(del|from|al|to)\b/i,
  /\b(matemáticas|ecuación|integral|derivada|álgebra)\b/i,
  /\b(crypto|bitcoin|inversión financiera|bolsa de valores)\b/i,
  /\b(película|serie|netflix|juego de video|anime)\b/i,
];

// Palabras que confirman que SÍ es dental (pasan aunque sean ambiguas)
const DENTAL_SIGNALS = [
  /diente|dientes|muela|muelas|dental|dentista|odontol/i,
  /carie|empaste|corona|implante|blanqueamiento|limpieza/i,
  /endodoncia|ortodoncia|brackets|alineador/i,
  /dolor|sangr|infección|golpe|fractura/i,
  /agendar|reservar|cita|hora|disponible|horario/i,
  /precio|valor|costo|presupuesto/i,
  /dr\.|dra\.|doctor|doctora/i,
];

export type GuardResult =
  | { allowed: true }
  | { allowed: false; reason: "off_topic" | "rate_limit" | "too_long" };

export function checkTopic(message: string): GuardResult {
  // 1. Límite de largo del mensaje
  if (message.length > 600) {
    return { allowed: false, reason: "too_long" };
  }

  // 2. Si contiene señales dentales → siempre permitir
  if (DENTAL_SIGNALS.some((r) => r.test(message))) {
    return { allowed: true };
  }

  // 3. Si matchea off-topic claramente → bloquear
  if (OFF_TOPIC_PATTERNS.some((r) => r.test(message))) {
    return { allowed: false, reason: "off_topic" };
  }

  // 4. Ambiguo → dejar pasar (el prompt del AI se encarga)
  return { allowed: true };
}

export const OFF_TOPIC_REPLY =
  "Solo puedo ayudarte con consultas sobre nuestra clínica dental: servicios, precios, horarios y agendamiento. ¿En qué te puedo ayudar? 🦷";

export const TOO_LONG_REPLY =
  "Tu mensaje es demasiado largo. ¿Puedes resumir tu consulta en pocas palabras?";
