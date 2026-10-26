"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ToothProjection, DentalSurface } from "@/lib/odontogram";
import { ToothSurfaceChart } from "@/components/ToothSurfaceChart";
import { ToothFrontView } from "@/components/ToothFrontView";
import { toothTypeOf, isUpperFdi, getArchRows, type DentitionType } from "@/lib/tooth";
import { CONDITION_TO_STATE, STATE_META, surfacePaintFor, conditionLabel, resumenHallazgos } from "@/lib/odontogramPaint";
import { Check } from "lucide-react";

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

// Los colores salen de STATE_META: el mismo criterio en el diagrama, la
// leyenda y la tabla.
const STATE_STYLE: Record<StateKey, { cellBg: string; accent: string; ring: string; symbol?: string }> = {
  healthy:    { cellBg: "bg-white",                         accent: "",                         ring: "border-line" },
  pending:    { cellBg: STATE_META.pending.bgSoft,          accent: STATE_META.pending.dot,     ring: "border-clinical-pending/30" },
  treated:    { cellBg: STATE_META.treated.bgSoft,          accent: STATE_META.treated.dot,     ring: "border-clinical-treated/30" },
  prosthetic: { cellBg: STATE_META.prosthetic.bgSoft,       accent: STATE_META.prosthetic.dot,  ring: "border-clinical-prosthetic/30", symbol: "⌒" },
  extracted:  { cellBg: STATE_META.extracted.bgSoft,        accent: STATE_META.extracted.dot,   ring: "border-line", symbol: "✕" },
};

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
    return `• ${conditionLabel(c.conditionCode)}${surf}`;
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
type ArchView = "all" | "upper" | "lower";

const DENTITION_LABEL: Record<DentitionType, string> = {
  definitiva: "Adulto",
  mixta:      "Mixta",
  temporal:   "Niño",
};

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
  /**
   * Dentición a mostrar. Sin esto la ficha clínica solo tenía piezas
   * permanentes y un paciente niño no se podía odontografiar.
   */
  dentition?:        DentitionType;
  onDentitionChange?: (d: DentitionType) => void;
  /** Click directo sobre una cara del diente (registrar hallazgo en 1 paso). */
  onSelectSurface?:  (fdi: string, surface: DentalSurface) => void;
  /**
   * Click sobre la silueta del diente (corona + raíz), no sobre el diagrama de
   * caras. Los dentistas la tocan para lo que es de la pieza completa —
   * movilidad, bolsa periodontal, endodoncia— porque es lo único que muestra
   * la raíz. Antes no hacía nada.
   */
  onSelectWholeTooth?: (fdi: string) => void;
  /**
   * Atajos de selección (boca completa, maxilar, anteriores…). Solo tienen
   * sentido en modo "multi": presupuestar 16 piezas de a una es inviable.
   */
  quickGroups?:     boolean;
  onSetTeeth?:      (fdis: Set<string>) => void;
  /** Prestaciones ya agregadas por pieza — badge numérico sobre la celda. */
  itemCounts?:      Record<string, number>;
}

export function StandardOdontogram({
  teeth = {}, selectedFdis, mode = "single", missingFdis, highlightFdis,
  onSelectTooth, onToggleMissing, defaultView = "all", view: viewProp, className,
  showLegend = true, cellSize = 52, anatomical = false,
  dentition: dentitionProp, onDentitionChange, onSelectSurface, onSelectWholeTooth,
  quickGroups = false, onSetTeeth, itemCounts,
}: Props) {

  const [viewState, setView] = useState<ArchView>(defaultView);
  const view = viewProp ?? viewState;
  const showInternalToolbar = viewProp === undefined;

  const [dentitionState, setDentitionState] = useState<DentitionType>("definitiva");
  const dentition = dentitionProp ?? dentitionState;
  function changeDentition(d: DentitionType) {
    setDentitionState(d);
    onDentitionChange?.(d);
  }
  const rows = useMemo(() => getArchRows(dentition), [dentition]);

  /** Atajos de selección, derivados de la dentición visible. */
  const grupos = useMemo(() => {
    const todas = [...rows.upper[0], ...rows.upper[1], ...rows.lower[0], ...rows.lower[1]];
    const esAnterior = (f: string) => Number(f[1]) <= 3;
    return [
      { key: "todos",       label: "Boca completa", fdis: todas },
      { key: "maxilar",     label: "Maxilar",       fdis: todas.filter(isUpperFdi) },
      { key: "mandibula",   label: "Mandíbula",     fdis: todas.filter((f) => !isUpperFdi(f)) },
      { key: "anteriores",  label: "Anteriores",    fdis: todas.filter(esAnterior) },
      { key: "posteriores", label: "Posteriores",   fdis: todas.filter((f) => !esAnterior(f)) },
    ];
  }, [rows]);

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
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted mr-1.5">Vista:</span>
            {(["all", "upper", "lower"] as ArchView[]).map((v) => (
              <button key={v} onClick={() => setView(v)} aria-pressed={view === v}
                className={`min-h-9 px-3 text-xs font-bold rounded-lg border transition ${
                  view === v
                    ? "bg-brand text-white border-brand"
                    : "bg-white text-ink-muted border-line hover:border-brand hover:text-brand"
                }`}>
                {v === "all" ? "Completa" : v === "upper" ? "Maxilar" : "Mandíbula"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted mr-1.5">Dentición:</span>
            {(["definitiva", "mixta", "temporal"] as DentitionType[]).map((d) => (
              <button key={d} onClick={() => changeDentition(d)} aria-pressed={dentition === d}
                className={`min-h-9 px-3 text-xs font-bold rounded-lg border transition ${
                  dentition === d
                    ? "bg-brand text-white border-brand"
                    : "bg-white text-ink-muted border-line hover:border-brand hover:text-brand"
                }`}>
                {DENTITION_LABEL[d]}
              </button>
            ))}
          </div>
          {mode === "multi" && selectedSet.size > 0 && (
            <span className="text-xs font-bold text-brand">{selectedSet.size} seleccionados</span>
          )}
        </div>
      )}

      {/* Atajos de selección — presupuestar 16 piezas de a una es inviable */}
      {quickGroups && onSetTeeth && (
        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted mr-1">Selección rápida:</span>
          {grupos.map((g) => (
            <button key={g.key} onClick={() => onSetTeeth(new Set(g.fdis))}
              className="min-h-9 px-3 text-xs font-bold rounded-lg border border-line bg-white text-ink-muted hover:border-brand hover:text-brand transition">
              {g.label}
            </button>
          ))}
          {selectedSet.size > 0 && (
            <button onClick={() => onSetTeeth(new Set())}
              className="min-h-9 text-xs font-semibold text-ink-muted hover:text-ink transition px-1.5">
              Limpiar
            </button>
          )}
        </div>
      )}

      {/* Grid */}
      <div className="bg-gray-50 rounded-2xl border border-gray-100 p-4">
        {(view === "all" || view === "upper") && (
          <ArchRow
            label="Arcada superior"
            quadrants={rows.upper}
            teeth={teeth}
            selectedSet={selectedSet}
            missingFdis={missingFdis}
            highlightFdis={highlightFdis}
            mode={mode}
            onSelectTooth={onSelectTooth}
            onSelectSurface={onSelectSurface}
            onSelectWholeTooth={onSelectWholeTooth}
            itemCounts={itemCounts}
            onToggleMissing={onToggleMissing}
            cellSize={cellSize}
            anatomical={anatomical}
            labelPosition="bottom"
          />
        )}
        {/* Separa las arcadas (plano oclusal). La línea media es la vertical
            entre cuadrantes, dibujada en cada fila. */}
        {view === "all" && <div className="my-3 h-px bg-line" />}
        {(view === "all" || view === "lower") && (
          <ArchRow
            label="Arcada inferior"
            quadrants={rows.lower}
            teeth={teeth}
            selectedSet={selectedSet}
            missingFdis={missingFdis}
            highlightFdis={highlightFdis}
            mode={mode}
            onSelectTooth={onSelectTooth}
            onSelectSurface={onSelectSurface}
            onSelectWholeTooth={onSelectWholeTooth}
            itemCounts={itemCounts}
            onToggleMissing={onToggleMissing}
            cellSize={cellSize}
            anatomical={anatomical}
            labelPosition="top"
          />
        )}
      </div>

      {/* Sin "Sano": ningún diente se pinta de ese color. Sin marca = sin hallazgos. */}
      {showLegend && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-ink-muted justify-center">
          <LegendDot color={STATE_META.pending.dot} label={STATE_META.pending.label} />
          <LegendDot color={STATE_META.treated.dot} label={STATE_META.treated.label} />
          <LegendDot color={STATE_META.prosthetic.dot} label={`${STATE_META.prosthetic.label} ⌒`} />
          <LegendDot color={STATE_META.extracted.dot} label={`${STATE_META.extracted.label} ✕`} />
          <span className="basis-full sm:basis-auto text-center">Sin marca: sin hallazgos</span>
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
  onSelectSurface?: (fdi: string, surface: DentalSurface) => void;
  onSelectWholeTooth?: (fdi: string) => void;
  itemCounts?:      Record<string, number>;
  onToggleMissing?: (fdi: string) => void;
  cellSize:        number;
  labelPosition:   "top" | "bottom";
  anatomical?:     boolean;
}

function ArchRow({
  label, quadrants, teeth, selectedSet, missingFdis, highlightFdis, mode,
  onSelectTooth, onSelectSurface, onSelectWholeTooth, itemCounts, onToggleMissing, cellSize, labelPosition, anatomical,
}: ArchRowProps) {
  // La línea media (vertical entre cuadrantes) solo tiene sentido si los dos
  // cuadrantes quedan en la misma fila; en pantallas angostas se apilan.
  const filaRef = useRef<HTMLDivElement>(null);
  const [enLinea, setEnLinea] = useState(true);
  useLayoutEffect(() => {
    const fila = filaRef.current;
    if (!fila) return;
    const medir = () => {
      const [a, b] = fila.children as unknown as HTMLElement[];
      setEnLinea(!a || !b || a.offsetTop === b.offsetTop);
    };
    medir();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(medir);
    ro.observe(fila);
    return () => ro.disconnect();
  }, []);

  const labelEl = (
    <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-1.5 text-center">
      {label}
    </p>
  );
  return (
    <div>
      {labelPosition === "top" && labelEl}
      {/* justify-center-safe: centrado mientras cabe; si la fila es más ancha
          que la pantalla, arranca a la izquierda y se alcanza con scroll. Con
          justify-center a secas, en el celular las piezas del borde (1.8,
          4.8…) quedaban fuera de alcance. La línea vertical entre cuadrantes
          es la línea media. */}
      <div ref={filaRef} className="flex justify-center-safe gap-3 flex-wrap">
        {quadrants.map((quadrant, idx) => (
          <div key={idx} className={`flex gap-1 ${idx === 1 && enLinea ? "border-l-2 border-line pl-3" : ""}`}>
            {quadrant.map((fdi) => anatomical ? (
              <AnatomicalToothColumn key={fdi}
                fdi={fdi}
                proj={teeth[fdi]}
                isMissing={missingFdis?.has(fdi) ?? false}
                isSelected={selectedSet.has(fdi)}
                isHighlighted={highlightFdis?.has(fdi) ?? false}
                onSelect={() => onSelectTooth?.(fdi)}
                onSelectSurface={onSelectSurface ? (s2: DentalSurface) => onSelectSurface(fdi, s2) : undefined}
                onSelectWholeTooth={onSelectWholeTooth ? () => onSelectWholeTooth(fdi) : undefined}
                itemCount={itemCounts?.[fdi] ?? 0}
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
                onSelectSurface={onSelectSurface ? (s2: DentalSurface) => onSelectSurface(fdi, s2) : undefined}
                onToggleMissing={onToggleMissing ? () => onToggleMissing(fdi) : undefined}
                size={cellSize}
              />
            ))}
          </div>
        ))}
      </div>
      {labelPosition === "bottom" && (
        <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted mt-1.5 text-center">
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
  onSelectSurface?: (surface: DentalSurface) => void;
  onToggleMissing?: () => void;
  size:            number;
}

function ToothCell({ fdi, proj, isMissing, isSelected, isHighlighted, onSelect, onSelectSurface, size }: ToothCellProps) {
  const { state, meta } = summarize(proj);
  const paint = surfacePaintFor(proj);
  const style = STATE_STYLE[state];
  const symbol = isMissing ? "✕" : meta.symbol;
  // El resaltado (pieza con prestación) solo aplica si no está seleccionada ni ausente
  const showHighlight = Boolean(isHighlighted) && !isSelected && !isMissing;
  const cellClass = isMissing
    ? `${STATE_META.extracted.bgSoft} border-line`
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
      aria-label={etiquetaPieza(fdi, proj, isMissing)}
      aria-pressed={isSelected}
      style={{ width: cellW, height: cellH }}
      className={`relative flex flex-col items-center rounded-md border-2 transition-all p-0.5
        ${cellClass}
        ${isSelected
          ? "border-brand ring-2 ring-brand/30 shadow-md motion-safe:scale-105 z-10"
          : "hover:border-ink-muted hover:shadow"}
      `}>
      {/* Número FDI — arriba en superiores, abajo en inferiores */}
      {isUpper && (
        <span className={`text-[11px] font-bold leading-none ${
          isMissing ? "text-ink-muted line-through" :
          isSelected ? "text-brand" : "text-ink"
        }`}>{fdi}</span>
      )}

      {/* Diagrama clínico de superficies — pinta la cara exacta del hallazgo */}
      <div className="flex-1 flex items-center justify-center w-full relative">
        <ToothSurfaceChart
          fdi={fdi}
          size={Math.round(size * 0.66)}
          surfaceColors={paint.surfaces}
          wholeToothColor={paint.wholeTooth}
          isMissing={isMissing}
          onSurfaceClick={onSelectSurface}
        />
        {/* Símbolo overlay (X de extracción, ⌒ corona) */}
        {symbol && (
          // ✕ en el color de "Extraído", no en rojo: el rojo es lo pendiente.
          <span aria-hidden className={`absolute inset-0 flex items-center justify-center text-2xl font-black pointer-events-none ${
            isMissing || state === "extracted" ? STATE_META.extracted.text :
            state === "prosthetic" ? STATE_META.prosthetic.text :
            "text-ink"
          }`} style={{ textShadow: "0 0 4px rgba(255,255,255,0.9)" }}>{symbol}</span>
        )}
        {/* Punto de estado si hay condición pero no símbolo */}
        {!symbol && state !== "healthy" && (proj?.activeConditions.length ?? 0) > 0 && (
          <span className={`absolute top-0 right-0 w-2 h-2 rounded-full ${meta.accent} ring-1 ring-white`} />
        )}
        {/* Badge de prestación agregada (presupuesto) */}
        {showHighlight && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-3.5 h-3.5 rounded-full bg-emerald-500 text-white text-[8px] font-black ring-1 ring-white pointer-events-none">
           
          </span>
        )}
      </div>

      {!isUpper && (
        <span className={`text-[11px] font-bold leading-none ${
          isMissing ? "text-ink-muted line-through" :
          isSelected ? "text-brand" : "text-ink"
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
  onSelectSurface?: (surface: DentalSurface) => void;
  onSelectWholeTooth?: () => void;
  itemCount?:     number;
  size:           number;
}

function AnatomicalToothColumn({
  fdi, proj, isMissing, isSelected, isHighlighted, onSelect, onSelectSurface, onSelectWholeTooth, itemCount = 0, size,
}: AnatomicalToothColumnProps) {
  const { state, meta } = summarize(proj);
  const paint = surfacePaintFor(proj);
  const isUpper = isUpperFdi(fdi);
  const extracted = isMissing || state === "extracted";
  const showHighlight = Boolean(isHighlighted) && !isSelected && !extracted;

  const innerSize = Math.round(size * 0.62);

  const numberEl = (
    <span className={`text-xs font-bold leading-none tabular-nums ${
      extracted ? "text-ink-muted line-through" :
      isSelected ? "text-brand" : "text-ink"
    }`}>
      {fdi[0]}.{fdi[1]}
    </span>
  );

  const chartEl = (
    <ToothSurfaceChart
      fdi={fdi}
      size={innerSize}
      surfaceColors={paint.surfaces}
      wholeToothColor={paint.wholeTooth}
      isMissing={extracted}
      onSurfaceClick={onSelectSurface}
    />
  );

  const toothEl = (
    <div className="relative"
      // La silueta muestra la RAÍZ: es donde el dentista apunta para lo que es
      // de la pieza completa (movilidad, bolsa periodontal, endodoncia).
      // stopPropagation porque la celda entera ya es un botón de selección.
      onClick={onSelectWholeTooth ? (e) => { e.stopPropagation(); onSelectWholeTooth(); } : undefined}
      style={onSelectWholeTooth ? { cursor: "pointer" } : undefined}
      title={onSelectWholeTooth ? `Registrar en la pieza completa (raíz, movilidad, periodontal)` : undefined}>
      <div style={{ opacity: extracted ? 0.3 : 1 }}>
        <ToothFrontView
          type={toothTypeOf(fdi)}
          jaw={isUpper ? "upper" : "lower"}
          size={innerSize}
          tint={paint.wholeTooth}
        />
      </div>
      {/* ✕ en el color de "Extraído", no en rojo: el rojo es lo pendiente. */}
      {extracted && (
        <span aria-hidden className={`absolute inset-0 flex items-center justify-center text-xl font-black pointer-events-none ${STATE_META.extracted.text}`}
          style={{ textShadow: "0 0 4px rgba(255,255,255,0.9)" }}>✕</span>
      )}
      {meta.symbol && !extracted && (
        <span aria-hidden className={`absolute inset-0 flex items-center justify-center text-lg font-black pointer-events-none ${STATE_META.prosthetic.text}`}
          style={{ textShadow: "0 0 4px rgba(255,255,255,0.9)" }}>{meta.symbol}</span>
      )}
    </div>
  );

  return (
    <button
      onClick={onSelect}
      title={`Pieza ${fdi}\n${extracted ? "Ausente" : meta.tooltip}`}
      aria-label={etiquetaPieza(fdi, proj, extracted)}
      aria-pressed={isSelected}
      style={{ width: size }}
      className={`relative flex flex-col items-center gap-1 py-1.5 px-0.5 rounded-xl border-2 transition-all ${
        isSelected
          ? "border-brand bg-brand-soft ring-2 ring-brand/25 shadow-md z-10"
          : showHighlight
          ? "border-emerald-400 bg-emerald-50"
          : "border-transparent hover:border-line hover:bg-white hover:shadow-sm"
      }`}>
      {/* Superior: diente → caras → número (número hacia la línea media) */}
      {isUpper ? (<>{toothEl}{chartEl}{numberEl}</>) : (<>{numberEl}{chartEl}{toothEl}</>)}
      {/* Punto de estado, visible sin abrir la pieza */}
      {!extracted && state !== "healthy" && (proj?.activeConditions.length ?? 0) > 0 && (
        <span className={`absolute top-1 right-1 w-2 h-2 rounded-full ${meta.accent} ring-1 ring-white`} />
      )}
      {/* Prestaciones ya agregadas a esta pieza en el presupuesto */}
      {itemCount > 0 ? (
        <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-brand-strong text-white text-[10px] font-black ring-2 ring-white pointer-events-none">
          {itemCount}
        </span>
      ) : showHighlight && (
        <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500 text-white text-[9px] font-black ring-2 ring-white pointer-events-none"><Check className="w-3 h-3" aria-hidden /></span>
      )}
    </button>
  );
}

/** Lo que anuncia el lector de pantalla: el número solo no dice qué tiene la pieza. */
function etiquetaPieza(fdi: string, proj: ToothProjection | undefined, ausente: boolean): string {
  const nombre = `Pieza ${fdi[0]}.${fdi[1]}`;
  if (ausente) return `${nombre}: ausente`;
  const resumen = resumenHallazgos(proj);
  return resumen ? `${nombre}: ${resumen}` : `${nombre}: sin hallazgos`;
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}
