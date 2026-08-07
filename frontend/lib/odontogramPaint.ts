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

export const CONDITION_TO_STATE: Record<string, StateKey> = {
  caries: "pending",  fractura: "pending",  movilidad: "pending",  periodontal_bolsa: "pending",
  obturacion: "treated",  endodoncia: "treated",  sellante: "treated",  limpieza: "treated",  ortodoncia: "treated",
  corona: "prosthetic",  implante: "prosthetic",  perno: "prosthetic",
  extraccion: "extracted",  ausente: "extracted",
  sano: "healthy",
};

/* Color con que se pinta cada superficie según el estado de su hallazgo. */
export const SURFACE_PAINT: Partial<Record<StateKey, string>> = {
  pending:    "#DC2626",
  treated:    "#2563EB",
  prosthetic: "#6D28D9",
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
    .map((c) => c.conditionCode + (c.surfaces.length > 0 ? ` (${c.surfaces.join("·")})` : ""))
    .join(" · ");
}
