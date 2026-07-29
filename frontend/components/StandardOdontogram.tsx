"use client";

import { useMemo, useState } from "react";
import type { ToothProjection, DentalSurface } from "@/lib/odontogram";
import { ToothSurfaceChart } from "@/components/ToothSurfaceChart";
import { ToothFrontView } from "@/components/ToothFrontView";
import { toothTypeOf, isUpperFdi } from "@/lib/tooth";

/**
 * Odontograma estándar — vista simple y profesional (Issue #43).
 *
 * Diseño: grid de cajas claras con números FDI, sin overlap, selección precisa.
 * Inspirado en DentaLink, Open Dental, CareCloud — el patrón que las clínicas reconocen.
 *
 * Soporta 2 modos:
 *   - "single": click reemplaza la selección (clinical record)
 *   - "multi":  click toggle (presupuesto, recall, etc.)
 *
 * Recibe datos clínicos opcionales para colorear estado por diente.
 */

type Mode = "single" | "multi";

interface ConditionSummary {
  /** Color de fondo de la celda según condición principal del diente */
  cellBg:    string;
  /** Color de la barra/punto indicador */
  accent:    string;
  /** Símbolo opcional (✕ extracción, ⌒ corona, ◊ implante) */
  symbol?:   string;
  /** Texto del tooltip (lista de condiciones) */
  tooltip:   string;
}

type StateKey = "pending" | "treated" | "prosthetic" | "extracted" | "healthy";

const STATE_STYLE: Record<StateKey, { cellBg: string; accent: string; ring: string; symbol?: string }> = {
  healthy:    { cellBg: "bg-white",        accent: "bg-emerald-400",  ring: "border-gray-200" },
  pending:    { cellBg: "bg-red-50",       accent: "bg-red-500",      ring: "border-red-200" },
  treated:    { cellBg: "bg-blue-50",      accent: "bg-blue-500",     ring: "border-blue-200" },
  prosthetic: { cellBg: "bg-violet-50",    accent: "bg-violet-500",   ring: "border-violet-200", symbol: "⌒" },
  extracted:  { cellBg: "bg-gray-100",     accent: "bg-gray-400",     ring: "border-gray-200", symbol: "✕" },
};

const CONDITION_TO_STATE: Record<string, StateKey> = {
  caries: "pending",  fractura: "pending",  movilidad: "pending",  periodontal_bolsa: "pending",
  obturacion: "treated",  endodoncia: "treated",  sellante: "treated",  limpieza: "treated",  ortodoncia: "treated",
  corona: "prosthetic",  implante: "prosthetic",  perno: "prosthetic",
  extraccion: "extracted",  ausente: "extracted",
  sano: "healthy",
};

/* Color con que se pinta cada superficie según el estado de su hallazgo. */
const SURFACE_PAINT: Partial<Record<StateKey, string>> = {
  pending:    "#DC2626",
  treated:    "#2563EB",
  prosthetic: "#6D28D9",
};

// Si dos hallazgos caen en la misma cara, gana el más grave.
const SURFACE_PRIORITY: StateKey[] = ["prosthetic", "pending", "treated"];

/**
 * Traduce las condiciones activas a color POR SUPERFICIE.
 *
 * El dato de superficies ya existía en el modelo (DentalEventSurface) pero la
 * grilla lo ignoraba y teñía la pieza entera: una caries oclusal pintaba todo
 * el diente de rojo y no se sabía qué cara tratar. Las condiciones sin
 * superficie (endodoncia, corona, extracción) siguen siendo de diente completo.
 */
function surfacePaintFor(proj: ToothProjection | undefined): {
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

function summarize(proj: ToothProjection | undefined): { state: StateKey; meta: ConditionSummary } {
  if (!proj) {
    return { state: "healthy", meta: { cellBg: STATE_STYLE.healthy.cellBg, accent: "", tooltip: "Sin eventos registrados" } };
  }
  if (proj.isExtracted) {
    return {
      state: "extracted",
      meta: { cellBg: STATE_STYLE.extracted.cellBg, accent: STATE_STYLE.extracted.accent, symbol: "✕", tooltip: "Extraída" },
    };
  }
  // Prioridad: prosthetic > pending > treated > healthy
  const order: StateKey[] = ["prosthetic", "pending", "treated", "healthy"];
  let chosen: StateKey = "healthy";
  for (const layer of order) {
    if (proj.activeConditions.some((c) => CONDITION_TO_STATE[c.conditionCode] === layer)) {
      chosen = layer;
      break;
    }
  }
  const style = STATE_STYLE[chosen];
  const tooltipLines = proj.activeConditions.map((c) => {
    const surf = c.surfaces.length > 0 ? ` (${c.surfaces.join("·")})` : "";
    return `• ${c.conditionCode}${surf}`;
  });
  return {
    state: chosen,
    meta: {
      cellBg: style.cellBg, accent: style.accent, symbol: style.symbol,
      tooltip: tooltipLines.length > 0 ? tooltipLines.join("\n") : "Sin eventos",
    },
  };
}

/* ─── Layout: cuadrantes en orden anatómico ──────────────────────────────── */
// Vista del dentista: el cuadrante 1 del paciente (su derecha) va en la IZQUIERDA del chart
// Q1 (1.x): 18-11   |   Q2 (2.x): 21-28
// Q4 (4.x): 48-41   |   Q3 (3.x): 31-38
const UPPER_RIGHT = ["18","17","16","15","14","13","12","11"];
const UPPER_LEFT  = ["21","22","23","24","25","26","27","28"];
const LOWER_RIGHT = ["48","47","46","45","44","43","42","41"];
const LOWER_LEFT  = ["31","32","33","34","35","36","37","38"];

type ArchView = "all" | "upper" | "lower";

interface Props {
  teeth?:           Record<string, ToothProjection>;
  selectedFdis?:    Set<string> | string | null;
  mode?:            Mode;
  /** Lista FDIs marcados como ausentes (para presupuesto sin necesidad de DentalEvent) */
  missingFdis?:     Set<string>;
  /** FDIs a resaltar (ej: piezas con prestación agregada en el presupuesto) */
  highlightFdis?:   Set<string>;
  onSelectTooth?:   (fdi: string) => void;
  onToggleMissing?: (fdi: string) => void;
  /** Vista inicial (uncontrolled) */
  defaultView?:     ArchView;
  /** Vista controlada externamente (si se pasa, oculta el toolbar interno) */
  view?:            ArchView;
  className?:       string;
  showLegend?:      boolean;
  /** Tamaño de la celda en px (default 44) */
  cellSize?:        number;
  /**
   * Vista anatómica: agrega la silueta del diente (corona + raíz) sobre el
   * diagrama de caras, con la raíz apuntando hacia afuera de la boca — el
   * layout que el ojo del dentista ya reconoce de Dentalink/Reservo. Las
   * condiciones de diente completo tiñen la silueta; las de cara puntual
   * pintan el diagrama. Apagada por defecto porque el builder de presupuesto
   * necesita la grilla compacta.
   */
  anatomical?:      boolean;
}

export function StandardOdontogram({
  teeth = {}, selectedFdis, mode = "single", missingFdis, highlightFdis,
  onSelectTooth, onToggleMissing, defaultView = "all", view: viewProp, className,
  showLegend = true, cellSize = 52, anatomical = false,
}: Props) {

  const [viewState, setView] = useState<ArchView>(defaultView);
  const view = viewProp ?? viewState;
  const showInternalToolbar = viewProp === undefined;

  const selectedSet = useMemo(() => {
    if (!selectedFdis) return new Set<string>();
    if (typeof selectedFdis === "string") return new Set([selectedFdis]);
    return selectedFdis;
  }, [selectedFdis]);

  return (
    <div className={className}>
      {/* Toolbar (oculta si el padre controla la vista) */}
      {showInternalToolbar && (
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mr-1.5">Vista:</span>
            {(["all", "upper", "lower"] as ArchView[]).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition ${
                  view === v
                    ? "bg-[#1A5C7A] text-white border-[#1A5C7A]"
                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                }`}>
                {v === "all" ? "Completa" : v === "upper" ? "Maxilar" : "Mandíbula"}
              </button>
            ))}
          </div>
          {mode === "multi" && selectedSet.size > 0 && (
            <span className="text-[11px] font-bold text-[#1A5C7A]">{selectedSet.size} seleccionados</span>
          )}
        </div>
      )}

      {/* Grid */}
      <div className="bg-gray-50 rounded-2xl border border-gray-100 p-4">
        {(view === "all" || view === "upper") && (
          <ArchRow
            label="Arcada superior"
            quadrants={[UPPER_RIGHT, UPPER_LEFT]}
            teeth={teeth}
            selectedSet={selectedSet}
            missingFdis={missingFdis}
            highlightFdis={highlightFdis}
            mode={mode}
            onSelectTooth={onSelectTooth}
            onToggleMissing={onToggleMissing}
            cellSize={cellSize}
            anatomical={anatomical}
            labelPosition="bottom"
          />
        )}
        {view === "all" && (
          <div className="my-3 flex items-center gap-2">
            <span className="flex-1 h-px bg-gray-200" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">línea media</span>
            <span className="flex-1 h-px bg-gray-200" />
          </div>
        )}
        {(view === "all" || view === "lower") && (
          <ArchRow
            label="Arcada inferior"
            quadrants={[LOWER_RIGHT, LOWER_LEFT]}
            teeth={teeth}
            selectedSet={selectedSet}
            missingFdis={missingFdis}
            highlightFdis={highlightFdis}
            mode={mode}
            onSelectTooth={onSelectTooth}
            onToggleMissing={onToggleMissing}
            cellSize={cellSize}
            anatomical={anatomical}
            labelPosition="top"
          />
        )}
      </div>

      {showLegend && (
        <div className="flex flex-wrap gap-3 mt-3 text-[10px] text-gray-500 justify-center">
          <LegendDot color="bg-red-500" label="Pendiente" />
          <LegendDot color="bg-blue-500" label="Tratado" />
          <LegendDot color="bg-violet-500" label="Prótesis" />
          <LegendDot color="bg-gray-400" label="Extraído" />
          <LegendDot color="bg-emerald-400" label="Sano" />
        </div>
      )}
    </div>
  );
}

interface ArchRowProps {
  label:           string;
  quadrants:       [string[], string[]];  // [derecha, izquierda]
  teeth:           Record<string, ToothProjection>;
  selectedSet:     Set<string>;
  missingFdis?:    Set<string>;
  highlightFdis?:  Set<string>;
  mode:            Mode;
  onSelectTooth?:  (fdi: string) => void;
  onToggleMissing?: (fdi: string) => void;
  cellSize:        number;
  labelPosition:   "top" | "bottom";
  anatomical?:     boolean;
}

function ArchRow({
  label, quadrants, teeth, selectedSet, missingFdis, highlightFdis, mode,
  onSelectTooth, onToggleMissing, cellSize, labelPosition, anatomical,
}: ArchRowProps) {
  const labelEl = (
    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5 text-center">
      {label}
    </p>
  );
  return (
    <div>
      {labelPosition === "top" && labelEl}
      <div className="flex justify-center gap-3 flex-wrap">
        {quadrants.map((quadrant, idx) => (
          <div key={idx} className="flex gap-1">
            {quadrant.map((fdi) => anatomical ? (
              <AnatomicalToothColumn key={fdi}
                fdi={fdi}
                proj={teeth[fdi]}
                isMissing={missingFdis?.has(fdi) ?? false}
                isSelected={selectedSet.has(fdi)}
                isHighlighted={highlightFdis?.has(fdi) ?? false}
                onSelect={() => onSelectTooth?.(fdi)}
                size={cellSize}
              />
            ) : (
              <ToothCell key={fdi}
                fdi={fdi}
                proj={teeth[fdi]}
                isMissing={missingFdis?.has(fdi) ?? false}
                isSelected={selectedSet.has(fdi)}
                isHighlighted={highlightFdis?.has(fdi) ?? false}
                mode={mode}
                onSelect={() => onSelectTooth?.(fdi)}
                onToggleMissing={onToggleMissing ? () => onToggleMissing(fdi) : undefined}
                size={cellSize}
              />
            ))}
          </div>
        ))}
      </div>
      {labelPosition === "bottom" && (
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mt-1.5 text-center">
          {label}
        </p>
      )}
    </div>
  );
}

interface ToothCellProps {
  fdi:             string;
  proj?:           ToothProjection;
  isMissing:       boolean;
  isSelected:      boolean;
  isHighlighted?:  boolean;
  mode:            Mode;
  onSelect:        () => void;
  onToggleMissing?: () => void;
  size:            number;
}

function ToothCell({ fdi, proj, isMissing, isSelected, isHighlighted, onSelect, size }: ToothCellProps) {
  const { state, meta } = summarize(proj);
  const paint = surfacePaintFor(proj);
  const style = STATE_STYLE[state];
  const symbol = isMissing ? "✕" : meta.symbol;
  // El resaltado (pieza con prestación) solo aplica si no está seleccionada ni ausente
  const showHighlight = Boolean(isHighlighted) && !isSelected && !isMissing;
  const cellClass = isMissing
    ? "bg-gray-100 border-gray-200"
    : showHighlight
    ? "bg-emerald-50 border-emerald-400"
    : `${style.cellBg} ${style.ring}`;
  const isUpper = isUpperFdi(fdi);

  // Tamaño total de la celda — altura mayor para acomodar diente + número
  const cellW = size;
  const cellH = Math.round(size * 1.4);

  return (
    <button
      onClick={onSelect}
      title={`Pieza ${fdi}\n${isMissing ? "Ausente" : meta.tooltip}`}
      style={{ width: cellW, height: cellH }}
      className={`relative flex flex-col items-center rounded-md border-2 transition-all p-0.5
        ${cellClass}
        ${isSelected
          ? "border-[#1A5C7A] ring-2 ring-[#1A5C7A]/30 shadow-md scale-105 z-10"
          : "hover:border-gray-400 hover:shadow"}
      `}>
      {/* Número FDI — arriba en superiores, abajo en inferiores */}
      {isUpper && (
        <span className={`text-[10px] font-bold leading-none ${
          isMissing ? "text-gray-400 line-through" :
          isSelected ? "text-[#1A5C7A]" : "text-gray-600"
        }`}>{fdi}</span>
      )}

      {/* Diagrama clínico de superficies — pinta la cara exacta del hallazgo */}
      <div className="flex-1 flex items-center justify-center w-full relative">
        <ToothSurfaceChart
          fdi={fdi}
          toothType={toothTypeOf(fdi)}
          jaw={isUpper ? "upper" : "lower"}
          size={Math.round(size * 0.66)}
          surfaceColors={paint.surfaces}
          wholeToothColor={paint.wholeTooth}
          isMissing={isMissing}
        />
        {/* Símbolo overlay (X de extracción, ⌒ corona) */}
        {symbol && (
          <span className={`absolute inset-0 flex items-center justify-center text-2xl font-black pointer-events-none ${
            isMissing ? "text-red-500" :
            state === "prosthetic" ? "text-violet-700" :
            "text-gray-700"
          }`} style={{ textShadow: "0 0 4px rgba(255,255,255,0.9)" }}>{symbol}</span>
        )}
        {/* Punto de estado si hay condición pero no símbolo */}
        {!symbol && state !== "healthy" && (proj?.activeConditions.length ?? 0) > 0 && (
          <span className={`absolute top-0 right-0 w-2 h-2 rounded-full ${meta.accent} ring-1 ring-white`} />
        )}
        {/* Badge de prestación agregada (presupuesto) */}
        {showHighlight && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-3.5 h-3.5 rounded-full bg-emerald-500 text-white text-[8px] font-black ring-1 ring-white pointer-events-none">
            ✓
          </span>
        )}
      </div>

      {!isUpper && (
        <span className={`text-[10px] font-bold leading-none ${
          isMissing ? "text-gray-400 line-through" :
          isSelected ? "text-[#1A5C7A]" : "text-gray-600"
        }`}>{fdi}</span>
      )}
    </button>
  );
}

/* ─── Vista anatómica (Dentalink-style, assets propios) ──────────────────
 * Columna por pieza: silueta anatómica + diagrama de caras + número FDI.
 * En la arcada superior la raíz apunta hacia arriba y el número queda junto a
 * la línea media; en la inferior todo va espejado. Así las coronas de ambas
 * arcadas se "miran" como en la boca real, que es como el dentista lee.
 */
interface AnatomicalToothColumnProps {
  fdi:            string;
  proj?:          ToothProjection;
  isMissing:      boolean;
  isSelected:     boolean;
  isHighlighted?: boolean;
  onSelect:       () => void;
  size:           number;
}

function AnatomicalToothColumn({
  fdi, proj, isMissing, isSelected, isHighlighted, onSelect, size,
}: AnatomicalToothColumnProps) {
  const { state, meta } = summarize(proj);
  const paint = surfacePaintFor(proj);
  const isUpper = isUpperFdi(fdi);
  const extracted = isMissing || state === "extracted";
  const showHighlight = Boolean(isHighlighted) && !isSelected && !extracted;

  const innerSize = Math.round(size * 0.62);

  const numberEl = (
    <span className={`text-[10px] font-bold leading-none tabular-nums ${
      extracted ? "text-gray-300 line-through" :
      isSelected ? "text-[#1A5C7A]" : "text-gray-500"
    }`}>
      {fdi[0]}.{fdi[1]}
    </span>
  );

  const chartEl = (
    <ToothSurfaceChart
      fdi={fdi}
      toothType={toothTypeOf(fdi)}
      jaw={isUpper ? "upper" : "lower"}
      size={innerSize}
      surfaceColors={paint.surfaces}
      wholeToothColor={paint.wholeTooth}
      isMissing={extracted}
    />
  );

  const toothEl = (
    <div className="relative">
      <div style={{ opacity: extracted ? 0.3 : 1 }}>
        <ToothFrontView
          type={toothTypeOf(fdi)}
          jaw={isUpper ? "upper" : "lower"}
          size={innerSize}
          tint={paint.wholeTooth}
        />
      </div>
      {extracted && (
        <span className="absolute inset-0 flex items-center justify-center text-xl font-black text-red-500 pointer-events-none"
          style={{ textShadow: "0 0 4px rgba(255,255,255,0.9)" }}>✕</span>
      )}
      {meta.symbol && !extracted && (
        <span className="absolute inset-0 flex items-center justify-center text-lg font-black text-violet-700 pointer-events-none"
          style={{ textShadow: "0 0 4px rgba(255,255,255,0.9)" }}>{meta.symbol}</span>
      )}
    </div>
  );

  return (
    <button
      onClick={onSelect}
      title={`Pieza ${fdi}\n${extracted ? "Ausente" : meta.tooltip}`}
      style={{ width: size }}
      className={`relative flex flex-col items-center gap-1 py-1.5 px-0.5 rounded-xl border-2 transition-all ${
        isSelected
          ? "border-[#1A5C7A] bg-[#1A5C7A]/5 ring-2 ring-[#1A5C7A]/25 shadow-md z-10"
          : showHighlight
          ? "border-emerald-400 bg-emerald-50"
          : "border-transparent hover:border-gray-200 hover:bg-white hover:shadow-sm"
      }`}>
      {/* Superior: diente → caras → número (número hacia la línea media) */}
      {isUpper ? (<>{toothEl}{chartEl}{numberEl}</>) : (<>{numberEl}{chartEl}{toothEl}</>)}
      {/* Punto de estado, visible sin abrir la pieza */}
      {!extracted && state !== "healthy" && (proj?.activeConditions.length ?? 0) > 0 && (
        <span className={`absolute top-1 right-1 w-2 h-2 rounded-full ${meta.accent} ring-1 ring-white`} />
      )}
      {showHighlight && (
        <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500 text-white text-[9px] font-black ring-2 ring-white pointer-events-none">✓</span>
      )}
    </button>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}
