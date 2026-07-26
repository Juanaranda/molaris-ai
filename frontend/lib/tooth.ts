/**
 * Taxonomía dental FDI — fuente única para todo el producto.
 *
 * Antes cada odontograma resolvía el tipo de pieza por su cuenta (uno en
 * components/Odontogram.tsx, otro en components/StandardOdontogram.tsx), y
 * además usaban formatos de FDI distintos: "1.8" en el flujo de presupuesto y
 * "18" en el de ficha clínica. Estas funciones aceptan ambos.
 */

export type ToothType = "incisor" | "canine" | "premolar" | "molar";

/** "1.8" | "18" → { quadrant: 1, position: 8 } */
export function parseFdi(fdi: string): { quadrant: number; position: number } {
  const digits = fdi.replace(/\D/g, "");
  return {
    quadrant: parseInt(digits[0] ?? "1", 10),
    position: parseInt(digits[1] ?? "1", 10),
  };
}

/**
 * Tipo de pieza. Los cuadrantes 5–8 son dentición temporal, que no tiene
 * premolares: las posiciones 4 y 5 son molares temporales.
 */
export function toothTypeOf(fdi: string): ToothType {
  const { quadrant, position } = parseFdi(fdi);
  if (position <= 2) return "incisor";
  if (position === 3) return "canine";
  const isPrimary = quadrant >= 5;
  if (isPrimary) return "molar";
  return position <= 5 ? "premolar" : "molar";
}

/** Maxilar (arcada superior): cuadrantes 1, 2 y sus temporales 5, 6. */
export function isUpperFdi(fdi: string): boolean {
  const { quadrant } = parseFdi(fdi);
  return [1, 2, 5, 6].includes(quadrant);
}

export function jawOf(fdi: string): "upper" | "lower" {
  return isUpperFdi(fdi) ? "upper" : "lower";
}
