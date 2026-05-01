/**
 * contextInjector.ts
 *
 * Detección determinista de servicio → doctor.
 * Genera un hint focalizado que se inyecta en el contexto de la conversación
 * ANTES de llamar al LLM, para que el modelo reciba la instrucción exacta
 * en lugar de tener que inferirla de un prompt largo.
 */

interface Doctor {
  name: string;
  specialty: string;
  services?: string[];
  workDays?: number[];
  schedule?: string;
}

interface ClinicConfig {
  doctors?: Doctor[];
}

const DAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

// Mapa de palabras clave del mensaje → fragmento del nombre de servicio en config
const SERVICE_KEYWORDS: Array<{ pattern: RegExp; serviceKey: string }> = [
  { pattern: /endodoncia|conducto|nervio/i,           serviceKey: "endodoncia" },
  { pattern: /ortodoncia|bracket|alineador|aparato/i, serviceKey: "ortodoncia" },
  { pattern: /implante/i,                             serviceKey: "implante" },
  { pattern: /blanqueamiento|blanquear/i,             serviceKey: "blanqueamiento" },
  { pattern: /carilla/i,                              serviceKey: "carilla" },
  { pattern: /limpieza|profilaxis/i,                  serviceKey: "limpieza" },
  { pattern: /muela.*juicio|cordal|tercer molar/i,    serviceKey: "muela del juicio" },
  { pattern: /urgencia|dolor|duele|fractura|sangr/i,  serviceKey: "urgencia" },
  { pattern: /extracci[oó]n|extraer/i,                serviceKey: "extracción" },
];

function detectService(message: string): string | null {
  for (const { pattern, serviceKey } of SERVICE_KEYWORDS) {
    if (pattern.test(message)) return serviceKey;
  }
  return null;
}

function findDoctorsForService(doctors: Doctor[], serviceKey: string): Doctor[] {
  return doctors.filter((d) =>
    (d.services ?? []).some((s) => s.toLowerCase().includes(serviceKey.toLowerCase()))
  );
}

function getDayString(doc: Doctor): string {
  if (doc.schedule) return doc.schedule;
  if (doc.workDays) return doc.workDays.map((d) => DAY_NAMES[d]).join(", ");
  return "";
}

/**
 * Retorna un hint en lenguaje natural para inyectar como mensaje de sistema
 * adicional, o null si no hay servicio detectado o no hay doctor específico.
 */
export function buildContextHint(message: string, clinicConfig: unknown): string | null {
  const cfg = clinicConfig as ClinicConfig;
  if (!cfg.doctors || cfg.doctors.length === 0) return null;

  const serviceKey = detectService(message);
  if (!serviceKey) return null;

  const matched = findDoctorsForService(cfg.doctors, serviceKey);
  if (matched.length === 0) return null;

  // Si hay exactamente un especialista → hint directo y obligatorio
  if (matched.length === 1) {
    const doc = matched[0];
    const days = getDayString(doc);
    return `[CONTEXTO DETECTADO] El paciente pregunta por ${serviceKey}. El especialista es ${doc.name} (${doc.specialty})${days ? `, disponible: ${days}` : ""}. DEBES mencionar a ${doc.name} en tu próxima respuesta. No menciones otros doctores para este servicio.`;
  }

  // Si hay varios doctores para el servicio → menciona todos
  const names = matched.map((d) => {
    const days = getDayString(d);
    return days ? `${d.name} (${days})` : d.name;
  }).join(" / ");
  return `[CONTEXTO DETECTADO] El paciente pregunta por ${serviceKey}. Doctores disponibles: ${names}. Menciona al más adecuado según el día preferido.`;
}
