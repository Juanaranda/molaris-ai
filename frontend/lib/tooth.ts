import type { DentalSurface } from "./odontogram";

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

/**
 * Qué cara del diente queda en cada lado de la pantalla.
 *
 * Existe una sola vez y a partir del FDI porque había dos versiones que no
 * coincidían: la grilla del odontograma dibujaba las piezas inferiores con
 * vestibular abajo (que es la convención: la cara mira hacia afuera de la
 * arcada) y la rueda del detalle la ponía siempre arriba. O sea que el mismo
 * molar inferior mostraba V y L al revés según dónde se mirara, y marcar "la
 * cara de abajo" registraba una cosa distinta en cada pantalla.
 *
 * Todo se deriva del FDI a propósito: cuando la arcada o el tipo de pieza se
 * pasaban por parámetro, dos componentes podían discrepar sobre el mismo diente.
 */
export function carasEnPantalla(fdi: string): {
  arriba: DentalSurface;
  abajo: DentalSurface;
  izquierda: DentalSurface;
  derecha: DentalSurface;
  centro: DentalSurface;
} {
  const { quadrant, position } = parseFdi(fdi);
  const superior = isUpperFdi(fdi);
  // Mesial mira a la línea media. En el lado derecho del paciente (cuadrantes
  // 1 y 4, y sus temporales 5 y 8) eso cae a la derecha en pantalla.
  const mesialDerecha = [1, 4, 5, 8].includes(quadrant);
  const anterior = position >= 1 && position <= 3;

  return {
    arriba:     superior ? "V" : "L",
    abajo:      superior ? "P" : "V",
    derecha:    mesialDerecha ? "M" : "D",
    izquierda:  mesialDerecha ? "D" : "M",
    centro:     anterior ? "I" : "O",
  };
}

/**
 * Colores base del diente, compartidos por la grilla y la rueda del detalle.
 *
 * Estaban duplicados y no coincidían: la grilla pintaba esmalte y la rueda
 * blanco puro, así que la misma pieza cambiaba de material al abrirla.
 */
export const ESMALTE = "#FBF6EC";
export const CONTORNO = "#94A3B8";

/**
 * Proporciones del círculo de superficies, como fracción del lado del dibujo.
 *
 * Las comparten la grilla y la rueda para que la misma pieza no cambie de
 * tamaño al abrirla: la grilla usaba 29/60 de radio y la rueda 0.46, y el
 * diente se encogía un 5% al pasar de una vista a la otra.
 */
// Van sobre 62 y no sobre 60: la grilla dibuja en un viewBox con una unidad de
// margen por lado para que el trazo no se corte, así que 29 unidades de radio
// ocupan 29/62 del cuadro que se ve. Usar 29/60 dejaba la rueda un 3% más
// grande que la grilla, que es justo lo que se quería emparejar.
export const RADIO_EXTERIOR = 29 / 62;
export const RADIO_CENTRO = 11 / 62;
