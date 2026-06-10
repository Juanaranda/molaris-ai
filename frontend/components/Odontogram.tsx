"use client";

import { useState } from "react";

/* ─── Types ──────────────────────────────────────────────────────────────── */
export type DentitionType = "definitiva" | "temporal" | "mixta";
export type ToothType = "incisor" | "canine" | "premolar" | "molar";

export interface ToothMeta {
  fdi: string;        // formato dato: "1.8" (compatible con presupuestos guardados)
  quadrant: number;   // 1-8 FDI
  num: number;        // posición dentro del cuadrante
  type: ToothType;
  jaw: "upper" | "lower";
  primary?: boolean;
}

const permType = (n: number): ToothType => n <= 2 ? "incisor" : n === 3 ? "canine" : n <= 5 ? "premolar" : "molar";
const primType = (n: number): ToothType => n <= 2 ? "incisor" : n === 3 ? "canine" : "molar";

function tooth(quadrant: number, num: number): ToothMeta {
  const primary = quadrant >= 5;
  return {
    fdi: `${quadrant}.${num}`,
    quadrant, num,
    type: primary ? primType(num) : permType(num),
    jaw: [1, 2, 5, 6].includes(quadrant) ? "upper" : "lower",
    primary,
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

const TOOTH_PATHS: Record<ToothType, { crown: string; roots: string[]; detail?: string }> = {
  incisor: {
    // Trapezoidal crown, wider at cervical, subtle mamelons at incisal edge
    crown: "M12,26 C11,24 11,18 13,12 C14,8 15,5 17,4 Q19,6 20,5 Q21,6 23,4 C25,5 26,8 27,12 C29,18 29,24 28,26 Z",
    roots: ["M13,26 C12,35 12,45 14,53 Q17,60 20,60 Q23,60 26,53 C28,45 28,35 27,26 Z"],
    detail: "M16,12 L16,23",
  },
  canine: {
    // Pentagonal crown with pronounced cusp tip
    crown: "M11,26 C10,22 10,15 13,9 C15,5 17,4 20,4 C23,4 25,5 27,9 C30,15 30,22 29,26 Z",
    roots: ["M13,26 C12,37 11,49 13,57 Q15,62 20,62 Q25,62 27,57 C29,49 28,37 27,26 Z"],
    detail: "M20,6 L20,22",
  },
  premolar: {
    // Bicuspid crown — two cusps with valley between them
    crown: "M10,26 C9,22 9,15 11,10 Q13,5 16,5 C17,9 18,12 20,10 C22,12 23,9 24,5 Q27,5 29,10 C31,15 31,22 30,26 Z",
    roots: [
      "M12,26 C11,34 10,44 12,52 Q14,58 17,57 Q19,53 18,44 C17,35 15,30 14,26 Z",
      "M23,26 C25,30 27,35 28,44 Q29,53 31,57 Q34,58 35,52 C36,44 35,34 34,26 Z",
    ],
    detail: "M20,7 L20,23 M14,13 Q20,17 26,13",
  },
  molar: {
    // Wide crown with 4 cusps and cross-shaped central fissure
    crown: "M7,26 C6,21 6,14 8,10 Q10,5 13,5 C14,9 15,12 17,9 Q19,7 20,8 Q21,7 23,9 C25,12 26,9 27,5 Q30,5 32,10 C34,14 34,21 33,26 Z",
    roots: [
      "M10,26 C9,34 8,44 10,52 Q12,58 15,57 Q17,53 16,44 C15,35 13,30 12,26 Z",
      "M26,26 C26,30 28,35 30,44 Q31,53 33,57 Q36,58 37,52 C38,44 37,34 36,26 Z",
    ],
    detail: "M20,8 L20,24 M11,17 Q20,21 29,17",
  },
};

const STATE_STYLE: Record<ToothState, { crown: string; root: string; stroke: string; sw: number }> = {
  normal:    { crown: "url(#od-crown)",   root: "url(#od-root)",   stroke: "#9DB2C4", sw: 1.3 },
  primary:   { crown: "url(#od-primary)", root: "url(#od-root)",   stroke: "#C4A06A", sw: 1.3 },
  selected:  { crown: "url(#od-sel)",     root: "url(#od-root)",   stroke: "#2B87A8", sw: 1.6 },
  active:    { crown: "url(#od-active)",  root: "url(#od-root)",   stroke: "#1A5C7A", sw: 2 },
  treatment: { crown: "url(#od-treat)",   root: "url(#od-root)",   stroke: "#3B82F6", sw: 1.5 },
  missing:   { crown: "#EDF1F5",          root: "#F3F6F9",         stroke: "#CBD5E1", sw: 1.2 },
};

function ToothGlyph({ type, jaw, state, scale = 1 }: {
  type: ToothType; jaw: "upper" | "lower"; state: ToothState; scale?: number;
}) {
  const p = TOOTH_PATHS[type];
  const s = STATE_STYLE[state];
  const w = 36 * scale, h = 58 * scale;
  return (
    <svg viewBox="0 0 40 64" width={w} height={h} aria-hidden style={{ display: "block" }}>
      <g transform={jaw === "upper" ? "translate(0,64) scale(1,-1)" : undefined}>
        {p.roots.map((d, i) => (
          <path key={i} d={d} fill={s.root} stroke={s.stroke} strokeWidth={s.sw * 0.85}
            strokeLinejoin="round" strokeLinecap="round" />
        ))}
        <path d={p.crown} fill={s.crown} stroke={s.stroke} strokeWidth={s.sw}
          strokeLinejoin="round" strokeLinecap="round" />
        {/* reflejo especular sobre el esmalte */}
        {state !== "missing" && (
          <path d={p.crown} fill="url(#od-hl)" />
        )}
        {/* surcos / detalle anatómico */}
        {state !== "missing" && p.detail && (
          <path d={p.detail} fill="none" stroke={s.stroke} strokeWidth={0.85}
            strokeLinecap="round" strokeLinejoin="round" opacity={0.38} />
        )}
        {/* línea cervical curva */}
        <path d="M9,26 Q20,28 31,26" fill="none" stroke={s.stroke} strokeWidth={0.65} opacity={0.4} />
        {state === "missing" && (
          <g stroke="#EF4444" strokeWidth={2.4} strokeLinecap="round"
            transform={jaw === "upper" ? "translate(0,64) scale(1,-1)" : undefined}>
            <line x1={11} y1={20} x2={29} y2={44} />
            <line x1={29} y1={20} x2={11} y2={44} />
          </g>
        )}
      </g>
    </svg>
  );
}

/* Gradientes compartidos — se renderizan una vez por instancia del odontograma */
function SharedDefs() {
  return (
    <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden>
      <defs>
        {/* Corona: gradiente radial para profundidad de esmalte */}
        <radialGradient id="od-crown" cx="38%" cy="32%" r="65%" gradientUnits="objectBoundingBox">
          <stop offset="0%"   stopColor="#FFFDF6" />
          <stop offset="55%"  stopColor="#EFE4CC" />
          <stop offset="100%" stopColor="#DBC898" />
        </radialGradient>
        {/* Overlay especular — reflejo de luz sobre el esmalte */}
        <radialGradient id="od-hl" cx="16" cy="12" r="14" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#FFFFFF" stopOpacity="0.52" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="od-root" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#EFE7D4" /><stop offset="100%" stopColor="#DCCBA6" />
        </linearGradient>
        <linearGradient id="od-primary" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FDF6E0" /><stop offset="100%" stopColor="#EBD49A" />
        </linearGradient>
        <linearGradient id="od-sel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#D8F0F7" /><stop offset="100%" stopColor="#8CC6DA" />
        </linearGradient>
        <linearGradient id="od-active" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#B8E4F2" /><stop offset="100%" stopColor="#4D9DBC" />
        </linearGradient>
        <linearGradient id="od-treat" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E3EFFD" /><stop offset="100%" stopColor="#A9CBF5" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ─── Card de pieza ──────────────────────────────────────────────────────── */
function ToothCard({ t, state, count, onClick, disabled, missingMode }: {
  t: ToothMeta; state: ToothState; count: number;
  onClick?: () => void; disabled?: boolean; missingMode?: boolean;
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
      {t.jaw === "upper" ? (<>{num}<ToothGlyph type={t.type} jaw="upper" state={state} scale={0.72} /></>)
                         : (<><ToothGlyph type={t.type} jaw="lower" state={state} scale={0.72} />{num}</>)}
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
  readOnly?: boolean;
}

export function Odontogram({
  dentitionType, setDentitionType,
  selectedTeeth = new Set(), activeToothFdi = null,
  onToggleTooth, onSetTeeth,
  missingTeeth = new Set(), setMissingTeeth,
  itemsByTooth = {}, readOnly = false,
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
      <SharedDefs />

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
                    onClick={() => handleClick(t)} disabled={readOnly} missingMode={mode === "missing"} />
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
                    onClick={() => handleClick(t)} disabled={readOnly} missingMode={mode === "missing"} />
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
