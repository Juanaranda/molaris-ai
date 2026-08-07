"use client";

import { useState } from "react";
import { ToothSurfaceChart } from "@/components/ToothSurfaceChart";
import { toothTypeOf, type ToothType } from "@/lib/tooth";
import type { ToothProjection } from "@/lib/odontogram";
import { surfacePaintFor, resumenHallazgos } from "@/lib/odontogramPaint";

/* ─── Types ──────────────────────────────────────────────────────────────── */
export type DentitionType = "definitiva" | "temporal" | "mixta";
export type { ToothType };

export interface ToothMeta {
  fdi: string;        // formato dato: "1.8" (compatible con presupuestos guardados)
  quadrant: number;   // 1-8 FDI
  num: number;        // posición dentro del cuadrante
  type: ToothType;
  jaw: "upper" | "lower";
  primary?: boolean;
}

function tooth(quadrant: number, num: number): ToothMeta {
  return {
    fdi: `${quadrant}.${num}`,
    quadrant, num,
    type: toothTypeOf(`${quadrant}${num}`),
    jaw: [1, 2, 5, 6].includes(quadrant) ? "upper" : "lower",
    primary: quadrant >= 5,
  };
}

const desc = (q: number, max: number) => Array.from({ length: max }, (_, i) => tooth(q, max - i));
const asc  = (q: number, max: number) => Array.from({ length: max }, (_, i) => tooth(q, i + 1));

/* Filas ordenadas de distal derecha → distal izquierda (como se lee el odontograma) */
export function getRows(dentition: DentitionType): { upper: ToothMeta[]; lower: ToothMeta[] } {
  if (dentition === "temporal") {
    return { upper: [...desc(5, 5), ...asc(6, 5)], lower: [...desc(8, 5), ...asc(7, 5)] };
  }
  if (dentition === "mixta") {
    // Molares definitivos (6-8) + dentición temporal en posiciones anteriores
    return {
      upper: [...desc(1, 8).filter((t) => t.num >= 6), ...desc(5, 5), ...asc(6, 5), ...asc(2, 8).filter((t) => t.num >= 6)],
      lower: [...desc(4, 8).filter((t) => t.num >= 6), ...desc(8, 5), ...asc(7, 5), ...asc(3, 8).filter((t) => t.num >= 6)],
    };
  }
  return { upper: [...desc(1, 8), ...asc(2, 8)], lower: [...desc(4, 8), ...asc(3, 8)] };
}

/* ─── Selección rápida ───────────────────────────────────────────────────── */
const QUICK_GROUPS: { key: string; label: string; filter: (t: ToothMeta) => boolean }[] = [
  { key: "todos",       label: "Boca completa", filter: () => true },
  { key: "maxilar",     label: "Maxilar",       filter: (t) => t.jaw === "upper" },
  { key: "mandibula",   label: "Mandíbula",     filter: (t) => t.jaw === "lower" },
  { key: "anteriores",  label: "Anteriores",    filter: (t) => t.type === "incisor" || t.type === "canine" },
  { key: "posteriores", label: "Posteriores",   filter: (t) => t.type === "premolar" || t.type === "molar" },
  { key: "derecha",     label: "Derecha",       filter: (t) => [1, 4, 5, 8].includes(t.quadrant) },
  { key: "izquierda",   label: "Izquierda",     filter: (t) => [2, 3, 6, 7].includes(t.quadrant) },
];

/* ─── Diente anatómico SVG (corona + raíces) ─────────────────────────────── */
type ToothState = "normal" | "primary" | "selected" | "active" | "treatment" | "missing";

/**
 * Colores del diagrama de superficies según el estado de selección del
 * presupuesto. Acá se eligen piezas completas (no caras), así que se pinta el
 * diente entero; el detalle por superficie vive en la ficha clínica.
 */
const STATE_TINT: Record<ToothState, string | undefined> = {
  normal:    undefined,
  primary:   "#FDF3DA",
  selected:  "#C7E5F0",
  active:    "#8FC9DE",
  treatment: "#DBE9FE",
  missing:   undefined,
};

function ToothGlyph({ fdi, type, jaw, state, scale = 1, clinical }: {
  fdi: string; type: ToothType; jaw: "upper" | "lower"; state: ToothState;
  scale?: number; clinical?: ToothProjection;
}) {
  // Los hallazgos clínicos mandan sobre el tinte de selección: presupuestar
  // mirando un diente que parece sano obliga a recordar de memoria lo que se
  // acaba de diagnosticar. La selección se sigue viendo en el borde de la card.
  const paint = surfacePaintFor(clinical);
  const hayHallazgos = Object.keys(paint.surfaces).length > 0 || paint.wholeTooth;

  return (
    <div style={{ position: "relative", display: "block" }}>
      <ToothSurfaceChart
        fdi={fdi}
        toothType={type}
        jaw={jaw}
        size={34 * scale}
        surfaceColors={paint.surfaces}
        wholeToothColor={hayHallazgos ? paint.wholeTooth : STATE_TINT[state]}
        isMissing={state === "missing" || Boolean(clinical?.isExtracted)}
      />
      {state === "missing" && (
        <svg viewBox="0 0 40 40" width={34 * scale} height={34 * scale} aria-hidden
          style={{ position: "absolute", inset: 0 }}>
          <g stroke="#EF4444" strokeWidth={3} strokeLinecap="round">
            <line x1={9} y1={9} x2={31} y2={31} />
            <line x1={31} y1={9} x2={9} y2={31} />
          </g>
        </svg>
      )}
    </div>
  );
}

/* ─── Card de pieza ──────────────────────────────────────────────────────── */
function ToothCard({ t, state, count, onClick, disabled, missingMode, clinical }: {
  t: ToothMeta; state: ToothState; count: number;
  onClick?: () => void; disabled?: boolean; missingMode?: boolean;
  clinical?: ToothProjection;
}) {
  const displayFdi = t.fdi.replace(".", "");
  const border =
    state === "active"    ? "2px solid #1A5C7A"
    : state === "selected"  ? "1.5px solid #2B87A8"
    : state === "treatment" ? "1.5px solid #93C5FD"
    : state === "missing"   ? "1px dashed #CBD5E1"
    : "1px solid #E2E8F0";
  const bg =
    state === "active"    ? "#E3F2F9"
    : state === "selected"  ? "#EDF7FA"
    : state === "treatment" ? "#F2F7FE"
    : state === "missing"   ? "#F8FAFC"
    : "#fff";
  const numColor =
    state === "active" ? "#1A5C7A" : state === "selected" ? "#2B87A8"
    : state === "treatment" ? "#3B82F6" : state === "missing" ? "#CBD5E1" : "#475569";

  const num = (
    <span style={{ fontSize: 11, fontWeight: 800, color: numColor, lineHeight: 1, userSelect: "none" }}>
      {displayFdi}
    </span>
  );

  return (
    <button type="button" onClick={onClick} disabled={disabled}
      aria-label={`Pieza ${displayFdi}${state === "missing" ? " (ausente)" : ""}`}
      title={[`Pieza ${displayFdi}`, resumenHallazgos(clinical)].filter(Boolean).join(" — ")}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
        padding: "7px 4px", borderRadius: 10, border, background: bg,
        cursor: disabled ? "default" : missingMode ? "crosshair" : "pointer",
        position: "relative", flex: "1 0 0", minWidth: 38, transition: "all .12s",
      }}>
      {count > 0 && state !== "missing" && (
        <span style={{
          position: "absolute", top: -5, right: -3, minWidth: 14, height: 14, borderRadius: 7,
          background: "#2563EB", color: "#fff", fontSize: 8, fontWeight: 800,
          display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px",
        }}>{count}</span>
      )}
      {t.jaw === "upper"
        ? (<>{num}<ToothGlyph fdi={t.fdi} type={t.type} jaw="upper" state={state} scale={0.72} clinical={clinical} /></>)
        : (<><ToothGlyph fdi={t.fdi} type={t.type} jaw="lower" state={state} scale={0.72} clinical={clinical} />{num}</>)}
    </button>
  );
}

/* ─── Odontograma compartido (ficha + presupuesto) ───────────────────────── */
type ArchView = "all" | "upper" | "lower";
type OdontMode = "select" | "missing";

export interface OdontogramProps {
  dentitionType: DentitionType;
  setDentitionType: (t: DentitionType) => void;
  selectedTeeth?: Set<string>;
  activeToothFdi?: string | null;
  onToggleTooth?: (fdi: string) => void;
  onSetTeeth?: (teeth: Set<string>) => void;
  missingTeeth?: Set<string>;
  setMissingTeeth?: (t: Set<string>) => void;
  itemsByTooth?: Record<string, number>;
  /**
   * Hallazgos clínicos del paciente (proyección del odontograma de la ficha),
   * indexados por FDI sin punto. Se pintan sobre las piezas para poder
   * presupuestar viendo lo que se diagnosticó, en vez de recordarlo.
   */
  clinicalTeeth?: Record<string, ToothProjection>;
  readOnly?: boolean;
}

export function Odontogram({
  dentitionType, setDentitionType,
  selectedTeeth = new Set(), activeToothFdi = null,
  onToggleTooth, onSetTeeth,
  missingTeeth = new Set(), setMissingTeeth,
  itemsByTooth = {}, clinicalTeeth = {}, readOnly = false,
}: OdontogramProps) {
  const [view, setView] = useState<ArchView>("all");
  const [mode, setMode] = useState<OdontMode>("select");

  const rows = getRows(dentitionType);
  const allTeeth = [...rows.upper, ...rows.lower];
  const selectedCount = selectedTeeth.size;
  const treatedCount = allTeeth.filter((t) => (itemsByTooth[t.fdi] ?? 0) > 0).length;

  function stateOf(t: ToothMeta): ToothState {
    if (missingTeeth.has(t.fdi)) return "missing";
    if (t.fdi === activeToothFdi) return "active";
    if (selectedTeeth.has(t.fdi)) return "selected";
    if ((itemsByTooth[t.fdi] ?? 0) > 0) return "treatment";
    if (t.primary) return "primary";
    return "normal";
  }

  function handleClick(t: ToothMeta) {
    if (readOnly) return;
    if (mode === "missing") {
      const next = new Set(missingTeeth);
      if (next.has(t.fdi)) next.delete(t.fdi);
      else {
        next.add(t.fdi);
        if (selectedTeeth.has(t.fdi)) onToggleTooth?.(t.fdi);
      }
      setMissingTeeth?.(next);
    } else {
      if (missingTeeth.has(t.fdi)) return;
      onToggleTooth?.(t.fdi);
    }
  }

  function selectGroup(filter: (t: ToothMeta) => boolean) {
    onSetTeeth?.(new Set(allTeeth.filter((t) => filter(t) && !missingTeeth.has(t.fdi)).map((t) => t.fdi)));
  }

  const tabCls = (on: boolean) =>
    `px-2.5 py-1 rounded-lg text-[10px] font-bold transition border ${
      on ? "bg-[#1A5C7A] text-white border-[#1A5C7A]" : "bg-white text-gray-400 border-gray-200 hover:border-gray-300"
    }`;

  const rowLabel = (txt: string) => (
    <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em",
      color: "#94A3B8", textAlign: "center", margin: "6px 0", userSelect: "none" }}>{txt}</p>
  );

  return (
    <div style={{ background: "#F8FAFC", borderRadius: 14, padding: "10px 10px 8px", border: "1px solid #E2E8F0" }}>
      {/* ── Fila 1: Dentición + Vista ─────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
        <div>
          <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#94a3b8", marginBottom: 4 }}>
            Tipo de dentición
          </p>
          <div style={{ display: "flex", gap: 4 }}>
            {(["definitiva", "temporal", "mixta"] as DentitionType[]).map((d) => (
              <button key={d} onClick={() => setDentitionType(d)} className={tabCls(dentitionType === d)}>
                {d === "definitiva" ? "Definitiva (adulto)" : d === "temporal" ? "Temporal (niño)" : "Mixta"}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 9, color: "#b0bec5", marginTop: 3 }}>
            {dentitionType === "definitiva" && "Dentición permanente — 32 piezas FDI 1–4"}
            {dentitionType === "temporal" && "Dentición de leche — 20 piezas FDI 5–8"}
            {dentitionType === "mixta" && "Molares definitivos + piezas temporales anteriores"}
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#94a3b8", marginBottom: 4 }}>
            Vista del odontograma
          </p>
          <div style={{ display: "flex", gap: 4 }}>
            {(["all", "upper", "lower"] as ArchView[]).map((v) => (
              <button key={v} onClick={() => setView(v)} className={tabCls(view === v)}>
                {v === "all" ? "Boca completa" : v === "upper" ? "Maxilar sup." : "Mandíbula inf."}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 9, color: "#b0bec5", marginTop: 3 }}>
            Filtra el diagrama para ver solo el arco que necesitas
          </p>
        </div>
      </div>

      {/* ── Fila 2: Selección rápida + Marcar ausente ─────────────────────── */}
      {!readOnly && (
        <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #E8EDF2", padding: "7px 10px", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#94a3b8", whiteSpace: "nowrap" }}>
                Selección rápida
              </span>
              {selectedCount > 0 && (
                <button onClick={() => onSetTeeth?.(new Set())}
                  className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#1A5C7A]/10 text-[#1A5C7A] hover:bg-[#1A5C7A]/20 transition">
                  ✕ Limpiar ({selectedCount})
                </button>
              )}
              {QUICK_GROUPS.map((g) => (
                <button key={g.key} onClick={() => selectGroup(g.filter)}
                  className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-500 hover:bg-gray-200 transition">
                  {g.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setMode((m) => m === "select" ? "missing" : "select")}
              className={`px-2.5 py-0.5 rounded text-[10px] font-semibold transition border ${
                mode === "missing"
                  ? "bg-red-50 text-red-600 border-red-200"
                  : "bg-white text-gray-400 border-gray-200 hover:text-red-500 hover:border-red-200"
              }`}>
              {mode === "missing" ? "✕ Cancelar ausentes" : "Marcar pieza ausente"}
            </button>
          </div>
          {mode === "missing" && (
            <p style={{ fontSize: 9, fontWeight: 700, color: "#EF4444", marginTop: 5 }}>
              Modo ausente activo — toca la pieza en el diagrama para marcarla. Tócala de nuevo para reactivarla.
            </p>
          )}
        </div>
      )}

      {/* ── Diagrama: cards lineales ──────────────────────────────────────── */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E8EDF2", padding: "10px 8px 6px", overflowX: "auto" }}>
        <div style={{ minWidth: 680 }}>
          {(view === "all" || view === "upper") && (
            <>
              <div style={{ display: "flex", gap: 4 }}>
                {rows.upper.map((t) => (
                  <ToothCard key={t.fdi} t={t} state={stateOf(t)} count={itemsByTooth[t.fdi] ?? 0}
                    onClick={() => handleClick(t)} disabled={readOnly} missingMode={mode === "missing"}
                    clinical={clinicalTeeth[t.fdi.replace(".", "")]} />
                ))}
              </div>
              {rowLabel("Arcada superior")}
            </>
          )}
          {view === "all" && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "2px 0 2px" }}>
              <div style={{ flex: 1, height: 1, background: "#E2E8F0" }} />
              <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: "#94A3B8" }}>
                Línea media
              </span>
              <div style={{ flex: 1, height: 1, background: "#E2E8F0" }} />
            </div>
          )}
          {(view === "all" || view === "lower") && (
            <>
              {rowLabel("Arcada inferior")}
              <div style={{ display: "flex", gap: 4 }}>
                {rows.lower.map((t) => (
                  <ToothCard key={t.fdi} t={t} state={stateOf(t)} count={itemsByTooth[t.fdi] ?? 0}
                    onClick={() => handleClick(t)} disabled={readOnly} missingMode={mode === "missing"}
                    clinical={clinicalTeeth[t.fdi.replace(".", "")]} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Estado ────────────────────────────────────────────────────────── */}
      <div style={{ textAlign: "center", marginTop: 6 }}>
        {readOnly ? (
          <p style={{ fontSize: 10, color: "#94a3b8", margin: 0 }}>
            {treatedCount > 0
              ? `${treatedCount} pieza${treatedCount !== 1 ? "s" : ""} con prestaciones registradas`
              : "Sin prestaciones registradas en el odontograma"}
          </p>
        ) : selectedCount > 0 ? (
          <p style={{ fontSize: 10, fontWeight: 700, color: "#1A5C7A", margin: 0 }}>
            {selectedCount === 1
              ? `Pieza ${activeToothFdi?.replace(".", "")} seleccionada — elige la prestación y agrega`
              : `${selectedCount} piezas seleccionadas · activa: ${activeToothFdi?.replace(".", "")}`}
          </p>
        ) : (
          <p style={{ fontSize: 10, color: "#94a3b8", margin: 0 }}>
            Toca una pieza en el diagrama · usa los grupos rápidos · o agrega prestaciones sin pieza específica
          </p>
        )}
      </div>
    </div>
  );
}
