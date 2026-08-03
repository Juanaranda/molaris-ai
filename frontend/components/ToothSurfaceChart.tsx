"use client";

/**
 * Diagrama clínico de superficies — la notación estándar del odontograma.
 *
 * Cada pieza es un cuadrado dividido en 5 zonas: 4 trapecios perimetrales
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

/* Geometría sobre viewBox 60×60: cuadrado exterior + cuadrado central a 18px,
   unidos por las diagonales. Da los 4 trapecios perimetrales + el centro. */
const ZONE_PATHS = {
  top:    "M0,0 L60,0 L42,18 L18,18 Z",
  right:  "M60,0 L60,60 L42,42 L42,18 Z",
  bottom: "M60,60 L0,60 L18,42 L42,42 Z",
  left:   "M0,60 L0,0 L18,18 L18,42 Z",
} as const;

/**
 * Qué superficie anatómica cae en cada lado del cuadrado.
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
      <rect x={18} y={18} width={24} height={24}
        fill={fillOf(layout.center)} stroke={STROKE} strokeWidth={sw} strokeLinejoin="round" {...zonaProps(layout.center)} />
    </svg>
  );
}
