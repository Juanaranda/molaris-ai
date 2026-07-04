"use client";

import { useMemo } from "react";
import type { DentalSurface } from "@/lib/odontogram";

/**
 * Rueda anatómica de superficies dentales (Issue #40).
 *
 * Renderiza un círculo SVG dividido en 5 sectores clickeables:
 *   - Centro: O (oclusal, posteriores) o I (incisal, anteriores 11-13, 21-23, 31-33, 41-43)
 *   - Top:    V (vestibular/buccal)
 *   - Bottom: L (lingual, inferiores) o P (palatino, superiores)
 *   - Left/Right: M y D — orientación según cuadrante FDI:
 *       - Cuadrante 1 (11-18) y 4 (41-48): pieza en derecha del paciente → M va a la DERECHA, D a la IZQUIERDA
 *         (porque "mesial" = hacia la línea media, y en la derecha del paciente la línea media está a la derecha de cada pieza)
 *       - Cuadrante 2 (21-28) y 3 (31-38): pieza en izquierda del paciente → M va a la IZQUIERDA, D a la DERECHA
 */

interface Props {
  toothFDI:  string;
  selected:  DentalSurface[];
  onToggle:  (surface: DentalSurface) => void;
  size?:     number;            // px del SVG (default 160)
  readOnly?: boolean;
}

interface SurfaceMeta {
  code:  DentalSurface;
  label: string;
  pathD: (size: number) => string;
  textX: (size: number) => number;
  textY: (size: number) => number;
}

export function ToothSurfaceWheel({ toothFDI, selected, onToggle, size = 160, readOnly }: Props) {
  const sectors = useMemo(() => computeSectors(toothFDI), [toothFDI]);

  const handleClick = (code: DentalSurface) => {
    if (!readOnly) onToggle(code);
  };

  return (
    <div className="inline-flex flex-col items-center gap-1">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="select-none">
        {sectors.map((s) => {
          const isSelected = selected.includes(s.code);
          return (
            <g key={s.code}
              onClick={() => handleClick(s.code)}
              style={{ cursor: readOnly ? "default" : "pointer" }}
              role={readOnly ? undefined : "button"}
              tabIndex={readOnly ? undefined : 0}
              aria-label={`${s.label} ${s.code}${isSelected ? " (seleccionada)" : ""}`}>
              <path
                d={s.pathD(size)}
                fill={isSelected ? "#1A5C7A" : "#FFFFFF"}
                stroke="#94A3B8"
                strokeWidth={1.5}
                className={readOnly ? "" : "transition hover:opacity-80"}
              />
              <text
                x={s.textX(size)}
                y={s.textY(size)}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={size * 0.11}
                fontWeight={700}
                fill={isSelected ? "#FFFFFF" : "#475569"}
                pointerEvents="none">
                {s.code}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Leyenda de superficies */}
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-[10px] text-gray-500 max-w-[200px]">
        {sectors.map((s) => (
          <span key={s.code} className={selected.includes(s.code) ? "text-[#1A5C7A] font-bold" : ""}>
            {s.code} · {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Computa los 5 sectores con su posición y label correctos según el diente FDI.
 */
function computeSectors(toothFDI: string): SurfaceMeta[] {
  const quadrant = parseInt(toothFDI[0] ?? "1", 10);
  const position = parseInt(toothFDI[1] ?? "1", 10);

  const isUpper    = quadrant === 1 || quadrant === 2 || quadrant === 5 || quadrant === 6;
  const isAnterior = position >= 1 && position <= 3;        // incisivos + canino
  const isPatientRight = quadrant === 1 || quadrant === 4 || quadrant === 5 || quadrant === 8;

  // Centro: I para anteriores, O para posteriores
  const centerSurface: DentalSurface = isAnterior ? "I" : "O";
  const centerLabel = isAnterior ? "Incisal" : "Oclusal";

  // Bottom: P si es superior, L si es inferior
  const bottomSurface: DentalSurface = isUpper ? "P" : "L";
  const bottomLabel   = isUpper ? "Palatino" : "Lingual";

  // M/D según lado del paciente
  // Pieza en lado DERECHO del paciente (cuadrantes 1 y 4): la línea media (donde está M) queda a la
  // izquierda del paciente y por convención de chart en espejo, a la DERECHA del diente en pantalla.
  // Pieza en lado IZQUIERDO del paciente (cuadrantes 2 y 3): M queda a la IZQUIERDA del diente.
  const leftSurface:  DentalSurface = isPatientRight ? "D" : "M";
  const rightSurface: DentalSurface = isPatientRight ? "M" : "D";

  // Paths (función del size para que escale)
  const c = (s: number) => s / 2;
  const innerR = (s: number) => s * 0.18;
  const outerR = (s: number) => s * 0.46;

  // Cada sector externo es un anillo de 90° clipped al cuadrante correspondiente
  const arcPath = (s: number, startAngle: number, endAngle: number): string => {
    const cx = c(s), cy = c(s), rOuter = outerR(s), rInner = innerR(s);
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const outerStart = { x: cx + rOuter * Math.cos(toRad(startAngle)), y: cy + rOuter * Math.sin(toRad(startAngle)) };
    const outerEnd   = { x: cx + rOuter * Math.cos(toRad(endAngle)),   y: cy + rOuter * Math.sin(toRad(endAngle))   };
    const innerEnd   = { x: cx + rInner * Math.cos(toRad(endAngle)),   y: cy + rInner * Math.sin(toRad(endAngle))   };
    const innerStart = { x: cx + rInner * Math.cos(toRad(startAngle)), y: cy + rInner * Math.sin(toRad(startAngle)) };
    return [
      `M ${outerStart.x} ${outerStart.y}`,
      `A ${rOuter} ${rOuter} 0 0 1 ${outerEnd.x} ${outerEnd.y}`,
      `L ${innerEnd.x} ${innerEnd.y}`,
      `A ${rInner} ${rInner} 0 0 0 ${innerStart.x} ${innerStart.y}`,
      `Z`,
    ].join(" ");
  };

  // Posiciones de label (mid-radius en el centro de cada cuadrante angular)
  const labelPos = (s: number, angle: number): { x: number; y: number } => {
    const cx = c(s), cy = c(s);
    const midR = (outerR(s) + innerR(s)) / 2;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    return { x: cx + midR * Math.cos(toRad(angle)), y: cy + midR * Math.sin(toRad(angle)) };
  };

  // Cuadrantes angulares (SVG: 0° apunta a la derecha, crece en sentido horario):
  //  TOP:    225°…315°
  //  RIGHT:  315°…45°  (wraparound)
  //  BOTTOM: 45°…135°
  //  LEFT:   135°…225°
  return [
    {
      code:  "V" as DentalSurface,
      label: "Vestibular",
      pathD: (s) => arcPath(s, 225, 315),
      textX: (s) => labelPos(s, 270).x,
      textY: (s) => labelPos(s, 270).y,
    },
    {
      code:  rightSurface,
      label: rightSurface === "M" ? "Mesial" : "Distal",
      pathD: (s) => arcPath(s, 315, 405), // 405 = 45° wraparound
      textX: (s) => labelPos(s, 0).x,
      textY: (s) => labelPos(s, 0).y,
    },
    {
      code:  bottomSurface,
      label: bottomLabel,
      pathD: (s) => arcPath(s, 45, 135),
      textX: (s) => labelPos(s, 90).x,
      textY: (s) => labelPos(s, 90).y,
    },
    {
      code:  leftSurface,
      label: leftSurface === "M" ? "Mesial" : "Distal",
      pathD: (s) => arcPath(s, 135, 225),
      textX: (s) => labelPos(s, 180).x,
      textY: (s) => labelPos(s, 180).y,
    },
    {
      // Centro como círculo (no arc — un círculo simple)
      code:  centerSurface,
      label: centerLabel,
      pathD: (s) => {
        const cx = c(s), cy = c(s), r = innerR(s);
        return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
      },
      textX: (s) => c(s),
      textY: (s) => c(s),
    },
  ];
}
