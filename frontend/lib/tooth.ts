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

export type DentitionType = "definitiva" | "temporal" | "mixta";

/** FDIs de un cuadrante, del número `from` al `to` (admite orden descendente). */
function quadRange(quadrant: number, from: number, to: number): string[] {
  const step = from <= to ? 1 : -1;
  const out: string[] = [];
  for (let n = from; step > 0 ? n <= to : n >= to; n += step) out.push(`${quadrant}${n}`);
  return out;
}

/**
 * Filas del odontograma por dentición, en orden anatómico y en la vista del
 * dentista: el cuadrante derecho del paciente va a la IZQUIERDA del chart, y
 * cada fila se lee de distal a mesial hacia la línea media.
 *
 * En dentición mixta los molares permanentes (6-7-8) NO reemplazan a los
 * temporales: erupcionan DETRÁS de ellos. Por eso la fila mixta va molares
 * permanentes por distal + piezas temporales por mesial, que es la boca real
 * de un niño de 6 a 12 años, y no dos arcadas separadas.
 */
export function getArchRows(dentition: DentitionType): {
  upper: [string[], string[]];
  lower: [string[], string[]];
} {
  if (dentition === "temporal") {
    return {
      upper: [quadRange(5, 5, 1), quadRange(6, 1, 5)],
      lower: [quadRange(8, 5, 1), quadRange(7, 1, 5)],
    };
  }
  if (dentition === "mixta") {
    return {
      upper: [[...quadRange(1, 8, 6), ...quadRange(5, 5, 1)], [...quadRange(6, 1, 5), ...quadRange(2, 6, 8)]],
      lower: [[...quadRange(4, 8, 6), ...quadRange(8, 5, 1)], [...quadRange(7, 1, 5), ...quadRange(3, 6, 8)]],
    };
  }
  return {
    upper: [quadRange(1, 8, 1), quadRange(2, 1, 8)],
    lower: [quadRange(4, 8, 1), quadRange(3, 1, 8)],
  };
}
