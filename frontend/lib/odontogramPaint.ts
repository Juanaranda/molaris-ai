/**
 * Cómo se pinta un diente según sus hallazgos clínicos.
 *
 * Vive acá y no dentro de un componente porque lo usan los dos odontogramas:
 * el de la ficha clínica (donde se registran los hallazgos) y el del
 * presupuesto (donde se cotiza el tratamiento). Un mismo hallazgo tiene que
 * verse igual en ambos — si no, el dentista presupuesta mirando un diente que
 * parece sano.
 */

import type { ToothProjection, DentalSurface } from "@/lib/odontogram";

export type StateKey = "pending" | "treated" | "prosthetic" | "extracted" | "healthy";

/** Nombre legible de cada condición. El código crudo ("periodontal_bolsa")
 *  no se le muestra a un dentista. */
export const CONDITION_LABELS: Record<string, string> = {
  caries: "Caries", obturacion: "Obturación", endodoncia: "Endodoncia",
  corona: "Corona", implante: "Implante", perno: "Perno",
  extraccion: "Extracción", ortodoncia: "Ortodoncia", sellante: "Sellante",
  limpieza: "Limpieza dental", fractura: "Fractura", movilidad: "Movilidad",
  periodontal_bolsa: "Bolsa periodontal", sano: "Sano", ausente: "Ausente",
};

export function conditionLabel(code: string): string {
  return CONDITION_LABELS[code] ?? code.replace(/_/g, " ");
}

/* Una extracción solo llega como condición activa cuando está INDICADA (la
   realizada deja la pieza con isExtracted): es algo pendiente, no una pieza
   ausente. */
export const CONDITION_TO_STATE: Record<string, StateKey> = {
  caries: "pending",  fractura: "pending",  movilidad: "pending",  periodontal_bolsa: "pending",
  extraccion: "pending",
  obturacion: "treated",  endodoncia: "treated",  sellante: "treated",  limpieza: "treated",  ortodoncia: "treated",
  corona: "prosthetic",  implante: "prosthetic",  perno: "prosthetic",
  ausente: "extracted",
  sano: "healthy",
};

/**
 * Cómo se ve cada estado, en un solo lugar: la cara pintada del diagrama, el
 * punto de la pieza, la leyenda, la tabla y los chips leen de acá. Antes había
 * tres fuentes que no coincidían ("Tratado" salía en tres azules distintos).
 *
 * `color` es el hex para los SVG; las clases usan los tokens clinical-* de
 * globals.css, que tienen los mismos valores (lo revisa un test). "healthy"
 * no se dibuja: un diente sin marca es un diente sin hallazgos.
 */
export const STATE_META: Record<Exclude<StateKey, "healthy">, {
  label: string; color: string; soft: string;
  text: string; dot: string; bgSoft: string;
}> = {
  pending: {
    label: "Pendiente", color: "#B3261E", soft: "#FDECEA",
    text: "text-clinical-pending", dot: "bg-clinical-pending", bgSoft: "bg-clinical-pending-soft",
  },
  treated: {
    label: "Tratado", color: "#1D4ED8", soft: "#E8EEFC",
    text: "text-clinical-treated", dot: "bg-clinical-treated", bgSoft: "bg-clinical-treated-soft",
  },
  prosthetic: {
    label: "Prótesis", color: "#6B3FA0", soft: "#F1EBF8",
    text: "text-clinical-prosthetic", dot: "bg-clinical-prosthetic", bgSoft: "bg-clinical-prosthetic-soft",
  },
  extracted: {
    label: "Extraído", color: "#56656F", soft: "#F0ECE6",
    text: "text-clinical-absent", dot: "bg-clinical-absent", bgSoft: "bg-clinical-absent-soft",
  },
};

/** Estado de una condición activa; lo que no está en el mapa se trata como tratado. */
export function stateOf(conditionCode: string): Exclude<StateKey, "healthy"> {
  const s = CONDITION_TO_STATE[conditionCode];
  return !s || s === "healthy" ? "treated" : s;
}

/* Color con que se pinta cada superficie según el estado de su hallazgo. */
export const SURFACE_PAINT: Partial<Record<StateKey, string>> = {
  pending:    STATE_META.pending.color,
  treated:    STATE_META.treated.color,
  prosthetic: STATE_META.prosthetic.color,
};

// Si dos hallazgos caen en la misma cara, gana el más grave.
const SURFACE_PRIORITY: StateKey[] = ["prosthetic", "pending", "treated"];

/**
 * Traduce las condiciones activas a color POR SUPERFICIE.
 *
 * Las condiciones sin superficie (endodoncia, corona, extracción) son de
 * diente completo y se devuelven aparte.
 */
export function surfacePaintFor(proj: ToothProjection | undefined): {
  surfaces: Partial<Record<DentalSurface, string>>;
  wholeTooth?: string;
} {
  if (!proj || proj.isExtracted) return { surfaces: {} };

  const rank = new Map<DentalSurface, number>();
  const surfaces: Partial<Record<DentalSurface, string>> = {};
  let wholeRank = Infinity;
  let wholeTooth: string | undefined;

  for (const c of proj.activeConditions) {
    const state = CONDITION_TO_STATE[c.conditionCode];
    const color = state ? SURFACE_PAINT[state] : undefined;
    if (!color || !state) continue;
    const prio = SURFACE_PRIORITY.indexOf(state);
    if (prio < 0) continue;

    if (c.surfaces.length === 0) {
      if (prio < wholeRank) { wholeRank = prio; wholeTooth = color; }
      continue;
    }
    for (const s of c.surfaces) {
      if (prio < (rank.get(s) ?? Infinity)) { rank.set(s, prio); surfaces[s] = color; }
    }
  }
  return { surfaces, wholeTooth };
}

/** Resumen legible de los hallazgos de una pieza, para tooltips. */
export function resumenHallazgos(proj: ToothProjection | undefined): string | null {
  if (!proj) return null;
  if (proj.isExtracted) return "Extraída";
  if (proj.activeConditions.length === 0) return null;
  return proj.activeConditions
    .map((c) => conditionLabel(c.conditionCode) + (c.surfaces.length > 0 ? ` (${c.surfaces.join("·")})` : ""))
    .join(" · ");
}
