import prisma from "../config/prisma";

const URGENCY_WORDS = ["urgente", "dolor", "emergencia", "urgencia"];
const PRICE_WORDS   = ["precio", "costo", "cuánto", "cuanto", "presupuesto", "cotización", "cotizacion"];

/**
 * Calcula el lead score de una sesión aplicando reglas deterministas (0-100).
 * Actualiza session.leadScore en la DB y retorna el valor calculado.
 *
 * Reglas:
 *   +30  agendó una cita (hay booking asociado a la sesión)
 *   +20  mencionó urgencia en algún mensaje de usuario
 *   +20  preguntó por precio/presupuesto
 *   +15  conversación larga (>5 mensajes)
 *   +10  dejó datos de contacto (email o phone en PatientContext)
 *   +5   es retorno (mismo RUT en sesión anterior de la misma clínica)
 */
export async function calculateLeadScore(sessionId: string): Promise<number> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      messages: { select: { role: true, content: true } },
      context:  true,
    },
  });

  if (!session) return 0;

  let score = 0;

  // +30 si hay booking asociado a esta sesión
  const booking = await prisma.booking.findFirst({
    where: { sessionId },
  });
  if (booking) score += 30;

  // Mensajes del usuario para analizar palabras clave
  const userMessages = session.messages
    .filter((m) => m.role === "user")
    .map((m) => m.content.toLowerCase());

  const fullText = userMessages.join(" ");

  // +20 si mencionó urgencia
  if (URGENCY_WORDS.some((w) => fullText.includes(w))) score += 20;

  // +20 si preguntó por precio
  if (PRICE_WORDS.some((w) => fullText.includes(w))) score += 20;

  // +15 si más de 5 mensajes totales
  if (session.messages.length > 5) score += 15;

  // +10 si dejó datos de contacto
  const ctx = session.context;
  if (ctx && (ctx.email || (ctx as any).phone)) score += 10;

  // +5 si es retorno (mismo RUT en otra sesión de la misma clínica)
  const rut = ctx?.rut;
  if (rut) {
    const otherSession = await prisma.session.findFirst({
      where: {
        clinicId: session.clinicId,
        id: { not: sessionId },
        context: { rut },
      },
    });
    if (otherSession) score += 5;
  }

  score = Math.min(100, score);

  // Persistir en la sesión
  await prisma.session.update({
    where: { id: sessionId },
    data: { leadScore: score },
  });

  return score;
}
