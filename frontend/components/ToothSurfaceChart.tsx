"use client";

/**
 * Diagrama clínico de superficies — la notación estándar del odontograma.
 *
 * Cada pieza es un círculo dividido en 5 zonas: 4 sectores perimetrales
 * (vestibular, palatino/lingual, mesial, distal) + el centro (oclusal en
 * posteriores, incisal en anteriores). Es lo que las clínicas ya leen en
 * Dentalink / Open Dental, y permite pintar la cara exacta de cada hallazgo
 * en vez de teñir el diente entero.
 *
 * Para la vista anatómica (corona + raíces) usar ToothFrontView, que es la
 * que se muestra al abrir la pieza en la ficha.
 */

import type { DentalSurface } from "@/lib/odontogram";

export type ToothType = "incisor" | "canine" | "premolar" | "molar";

export interface ToothSurfaceChartProps {
  /** FDI sin punto ("16"). Define el cuadrante, que decide de qué lado va mesial. */
  fdi: string;
  toothType: ToothType;
  jaw: "upper" | "lower";
  /** Color por superficie. Las que no vengan quedan en color esmalte. */
  surfaceColors?: Partial<Record<DentalSurface, string>>;
  /** Tinte del diente completo (condiciones sin superficie: endodoncia, corona…). */
  wholeToothColor?: string;
  size?: number;
  isMissing?: boolean;
  className?: string;
  /**
   * Registrar directo sobre la cara. Sin esto, marcar una caries oclusal es:
   * click en el diente → "Registrar evento" → elegir condición → marcar la cara
   * en la rueda. El diagrama YA dibuja cada cara por separado, así que
   * clickearla es el camino corto natural.
   */
  onSurfaceClick?: (surface: DentalSurface) => void;
}

const ENAMEL = "#FBF6EC";
const STROKE = "#94A3B8";

/* Geometría sobre viewBox 60×60: anillo dividido en cruz por las diagonales,
   con un círculo central. Es la forma que usan Dentalink y la mayoría de las
   fichas en papel — el ojo del dentista la reconoce de inmediato, y las caras
   quedan más parejas que en la versión cuadrada.
   Radios: 29 exterior, 11 el centro. Los cortes van en las diagonales (45°). */
const ZONE_PATHS = {
  // Cada sector: arco exterior en sentido horario, corte al centro, arco
  // interior de vuelta. Los extremos caen en las diagonales.
  top:    "M9.49,9.49 A29,29 0 0 1 50.51,9.49 L37.78,22.22 A11,11 0 0 0 22.22,22.22 Z",
  right:  "M50.51,9.49 A29,29 0 0 1 50.51,50.51 L37.78,37.78 A11,11 0 0 0 37.78,22.22 Z",
  bottom: "M50.51,50.51 A29,29 0 0 1 9.49,50.51 L22.22,37.78 A11,11 0 0 0 37.78,37.78 Z",
  left:   "M9.49,50.51 A29,29 0 0 1 9.49,9.49 L22.22,22.22 A11,11 0 0 0 22.22,37.78 Z",
} as const;

/**
 * Qué superficie anatómica cae en cada sector del círculo.
 *
 * - Vestibular siempre hacia AFUERA de la arcada: arriba en el maxilar,
 *   abajo en la mandíbula. Palatino/lingual queda del lado interno.
 * - Mesial es la cara que mira a la línea media. Como la grilla se dibuja de
 *   distal a mesial hacia el centro, en los cuadrantes derechos (1, 4 y sus
 *   temporales 5, 8) la mesial cae a la DERECHA, y a la izquierda en los
 *   cuadrantes izquierdos (2, 3, 6, 7). Sin este espejado, la mitad del
 *   odontograma marcaría la cara contraria.
 */
export function surfaceLayout(fdi: string, jaw: "upper" | "lower", toothType: ToothType) {
  const quadrant = parseInt(fdi[0] ?? "1", 10);
  const mesialOnRight = [1, 4, 5, 8].includes(quadrant);
  const isUpper = jaw === "upper";
  const isAnterior = toothType === "incisor" || toothType === "canine";

  return {
    top:    (isUpper ? "V" : "L") as DentalSurface,
    bottom: (isUpper ? "P" : "V") as DentalSurface,
    right:  (mesialOnRight ? "M" : "D") as DentalSurface,
    left:   (mesialOnRight ? "D" : "M") as DentalSurface,
    center: (isAnterior ? "I" : "O") as DentalSurface,
  };
}

export function ToothSurfaceChart({
  fdi, toothType, jaw, surfaceColors = {}, wholeToothColor,
  size = 36, isMissing = false, className, onSurfaceClick,
}: ToothSurfaceChartProps) {
  const layout = surfaceLayout(fdi, jaw, toothType);
  const clicable = Boolean(onSurfaceClick) && !isMissing;

  // stopPropagation: la celda entera es un botón que selecciona la pieza. Sin
  // esto, clickear una cara dispararía además la selección del diente.
  const zonaProps = (s: DentalSurface) =>
    clicable
      ? {
          onClick: (e: React.MouseEvent) => { e.stopPropagation(); onSurfaceClick!(s); },
          style: { cursor: "pointer" },
          role: "button" as const,
          tabIndex: -1,
          "aria-label": `Cara ${s} de la pieza ${fdi}`,
        }
      : {};

  // El tinte de diente completo pinta el fondo; una superficie con hallazgo
  // propio lo tapa, para que un sellante en O siga leyéndose sobre una corona.
  const base = isMissing ? "#F1F5F9" : wholeToothColor ?? ENAMEL;
  const fillOf = (s: DentalSurface) => surfaceColors[s] ?? base;
  const sw = 1.4;

  return (
    <svg viewBox="-1 -1 62 62" width={size} height={size} className={className}
      style={{ display: "block", opacity: isMissing ? 0.45 : 1 }}
      aria-hidden={!clicable}>
      <path d={ZONE_PATHS.top}    fill={fillOf(layout.top)}    stroke={STROKE} strokeWidth={sw} strokeLinejoin="round" {...zonaProps(layout.top)} />
      <path d={ZONE_PATHS.right}  fill={fillOf(layout.right)}  stroke={STROKE} strokeWidth={sw} strokeLinejoin="round" {...zonaProps(layout.right)} />
      <path d={ZONE_PATHS.bottom} fill={fillOf(layout.bottom)} stroke={STROKE} strokeWidth={sw} strokeLinejoin="round" {...zonaProps(layout.bottom)} />
      <path d={ZONE_PATHS.left}   fill={fillOf(layout.left)}   stroke={STROKE} strokeWidth={sw} strokeLinejoin="round" {...zonaProps(layout.left)} />
      <circle cx={30} cy={30} r={11}
        fill={fillOf(layout.center)} stroke={STROKE} strokeWidth={sw} {...zonaProps(layout.center)} />
    </svg>
  );
}
