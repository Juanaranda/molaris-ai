/**
 * Servicio del odontograma — proyección event-sourced.
 *
 * Decisiones de discovery (#11):
 *   - Eventos inmutables (no UPDATE), proyección derivada
 *   - Notación FDI obligatoria
 *   - Diente ↔ condición M:N
 */

import type { DentalEvent, DentalSurface } from "@prisma/client";

/* ── Validación FDI ─────────────────────────────────────────────────────────
 * FDI notation usa 2 dígitos: el primero es el cuadrante (1-4 permanentes,
 * 5-8 deciduos/temporales), el segundo es la pieza (1-8 desde la línea media).
 * Adultos permanentes: 11-18, 21-28, 31-38, 41-48 (32 piezas).
 * Niños temporales:    51-55, 61-65, 71-75, 81-85 (20 piezas).
 */
const VALID_FDI = new Set<string>();
for (const quad of [1, 2, 3, 4]) {
  for (let pos = 1; pos <= 8; pos++) VALID_FDI.add(`${quad}${pos}`);
}
for (const quad of [5, 6, 7, 8]) {
  for (let pos = 1; pos <= 5; pos++) VALID_FDI.add(`${quad}${pos}`);
}

export function isValidFDI(toothFDI: string): boolean {
  return VALID_FDI.has(toothFDI);
}

/* ── Catálogo de condiciones (v1 hardcoded) ─────────────────────────────── */
/**
 * Cada condición indica si admite severidad estructurada (Issue #33).
 * Las escalas siguen estándares clínicos:
 *  - ICDAS (Internat. Caries Detection and Assessment System): 0-6 para caries
 *  - Bolsa periodontal: profundidad en mm (1-12 rango clínico habitual)
 *  - Movilidad: grados de Miller 1-3
 *
 * severityLabels permite mostrar tooltips contextuales en la UI.
 */
export const CONDITION_CATALOG = [
  {
    code: "caries", label: "Caries", allowsSeverity: true,
    severityScale: "ICDAS 0-6", severityMin: 0, severityMax: 6,
    severityLabels: {
      0: "Sano",
      1: "Cambio inicial visible solo seco",
      2: "Cambio visible en esmalte húmedo",
      3: "Microcavitación en esmalte",
      4: "Sombra subyacente desde dentina",
      5: "Cavidad detectable con dentina expuesta",
      6: "Cavidad extensa con dentina expuesta",
    },
  },
  { code: "obturacion", label: "Obturación", allowsSeverity: false },
  { code: "endodoncia", label: "Endodoncia", allowsSeverity: false },
  { code: "corona",     label: "Corona",     allowsSeverity: false },
  { code: "implante",   label: "Implante",   allowsSeverity: false },
  { code: "perno",      label: "Perno",      allowsSeverity: false },
  { code: "extraccion", label: "Extracción", allowsSeverity: false },
  { code: "ortodoncia", label: "Ortodoncia", allowsSeverity: false },
  { code: "sellante",   label: "Sellante",   allowsSeverity: false },
  { code: "limpieza",   label: "Limpieza dental", allowsSeverity: false },
  {
    code: "fractura", label: "Fractura", allowsSeverity: true,
    severityScale: "1-5", severityMin: 1, severityMax: 5,
    severityLabels: {
      1: "Línea de fractura sin desplazamiento",
      2: "Fractura coronal en esmalte",
      3: "Fractura coronal con compromiso dentinario",
      4: "Fractura con exposición pulpar",
      5: "Fractura radicular",
    },
  },
  {
    code: "movilidad", label: "Movilidad", allowsSeverity: true,
    severityScale: "Miller 1-3", severityMin: 1, severityMax: 3,
    severityLabels: {
      1: "Grado 1 — movilidad <1mm en sentido horizontal",
      2: "Grado 2 — movilidad >1mm en sentido horizontal",
      3: "Grado 3 — movilidad en sentido vertical",
    },
  },
  {
    code: "periodontal_bolsa", label: "Bolsa periodontal", allowsSeverity: true,
    severityScale: "Profundidad en mm", severityMin: 1, severityMax: 12,
    severityLabels: {
      1: "1 mm — fisiológico",
      2: "2 mm — fisiológico",
      3: "3 mm — surco gingival",
      4: "4 mm — bolsa inicial",
      5: "5 mm — bolsa moderada",
      6: "6 mm — bolsa moderada",
      7: "7 mm — bolsa profunda",
      8: "8+ mm — bolsa severa",
    },
  },
  { code: "sano",    label: "Sano",               allowsSeverity: false },
  { code: "ausente", label: "Ausente (sin info)", allowsSeverity: false },
] as const;

const CONDITION_CODES = new Set(CONDITION_CATALOG.map((c) => c.code));
export function isValidConditionCode(code: string): boolean {
  return CONDITION_CODES.has(code as never);
}

/* ── Proyección del odontograma ─────────────────────────────────────────── */
type EventWithSurfaces = DentalEvent & { surfaces: { surface: DentalSurface }[] };

export interface ToothProjection {
  toothFDI:        string;
  events:          EventWithSurfaces[];      // historial completo desc
  activeConditions: {                         // resolución simple para UI rápida
    conditionCode:  string;
    eventId:        string;
    occurredAt:     Date;
    surfaces:       DentalSurface[];
    severity:       number | null;
    professionalId: string;
  }[];
  isExtracted:     boolean;                  // si tiene un evento de extracción
}

/**
 * Resolución de "estado actual" por diente:
 *  - Si hay evento "extraccion" → marcar isExtracted=true; activeConditions vacío
 *  - Si hay evento "sano" más reciente que cualquier hallazgo previo → vacío
 *  - En otro caso → tomar la condición más reciente por cada conditionCode + superficie
 *    (esto permite ver "implante + corona" al mismo tiempo)
 */
export function projectTooth(toothFDI: string, events: EventWithSurfaces[]): ToothProjection {
  // Eventos vienen ordenados desc por occurredAt (responsabilidad del caller)
  const extraction = events.find((e) => e.conditionCode === "extraccion");
  if (extraction) {
    return { toothFDI, events, activeConditions: [], isExtracted: true };
  }

  const latestSano = events.find((e) => e.conditionCode === "sano");
  const latestSanoTime = latestSano?.occurredAt.getTime() ?? 0;

  // Tomar último evento por conditionCode (excepto observation y sano)
  const latestByCondition = new Map<string, EventWithSurfaces>();
  for (const e of events) {
    if (e.eventType === "OBSERVATION") continue;
    if (e.conditionCode === "sano") continue;
    if (e.occurredAt.getTime() < latestSanoTime) continue;  // limpiado por un "sano" posterior
    if (!latestByCondition.has(e.conditionCode)) {
      latestByCondition.set(e.conditionCode, e);
    }
  }

  return {
    toothFDI,
    events,
    isExtracted: false,
    activeConditions: Array.from(latestByCondition.values()).map((e) => ({
      conditionCode:  e.conditionCode,
      eventId:        e.id,
      occurredAt:     e.occurredAt,
      surfaces:       e.surfaces.map((s) => s.surface),
      severity:       e.severity,
      professionalId: e.professionalId,
    })),
  };
}

/**
 * Construye la proyección completa para un paciente — diccionario por FDI.
 * Incluye solo dientes con al menos un evento; el frontend renderiza
 * "sin info" para los que no estén en la respuesta.
 */
export function buildPatientOdontogram(events: EventWithSurfaces[]): Record<string, ToothProjection> {
  const byTooth = new Map<string, EventWithSurfaces[]>();
  for (const e of events) {
    const arr = byTooth.get(e.toothFDI) ?? [];
    arr.push(e);
    byTooth.set(e.toothFDI, arr);
  }
  const out: Record<string, ToothProjection> = {};
  for (const [toothFDI, evts] of byTooth) {
    // Orden desc por occurredAt
    evts.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
    out[toothFDI] = projectTooth(toothFDI, evts);
  }
  return out;
}
