"use client";

import { useEffect, useState } from "react";
import { getToken } from "@/lib/auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/* ─── Types ──────────────────────────────────────────────────────────────── */
type JawType = "upper" | "lower";
type ToothType = "incisor" | "canine" | "premolar" | "molar";
type DentitionType = "definitiva" | "temporal" | "mixta";

interface ToothDef {
  fdi: string; cx: number; cy: number; w: number; h: number;
  type: ToothType; jaw: JawType; rot: number; primary?: boolean;
}

/* ─── Permanent teeth ─────────────────────────────────────────────────────── */
const TOOTH_DATA: ToothDef[] = [
  { fdi: "1.8", cx: 28,  cy: 90,  w: 22, h: 15, type: "molar",    jaw: "upper", rot: -58 },
  { fdi: "1.7", cx: 56,  cy: 76,  w: 24, h: 17, type: "molar",    jaw: "upper", rot: -46 },
  { fdi: "1.6", cx: 85,  cy: 64,  w: 27, h: 17, type: "molar",    jaw: "upper", rot: -36 },
  { fdi: "1.5", cx: 111, cy: 54,  w: 18, h: 21, type: "premolar", jaw: "upper", rot: -24 },
  { fdi: "1.4", cx: 133, cy: 47,  w: 18, h: 21, type: "premolar", jaw: "upper", rot: -14 },
  { fdi: "1.3", cx: 153, cy: 42,  w: 15, h: 24, type: "canine",   jaw: "upper", rot: -7  },
  { fdi: "1.2", cx: 172, cy: 39,  w: 13, h: 19, type: "incisor",  jaw: "upper", rot: -3  },
  { fdi: "1.1", cx: 191, cy: 38,  w: 16, h: 19, type: "incisor",  jaw: "upper", rot:  0  },
  { fdi: "2.1", cx: 211, cy: 38,  w: 16, h: 19, type: "incisor",  jaw: "upper", rot:  0  },
  { fdi: "2.2", cx: 230, cy: 39,  w: 13, h: 19, type: "incisor",  jaw: "upper", rot:  3  },
  { fdi: "2.3", cx: 249, cy: 42,  w: 15, h: 24, type: "canine",   jaw: "upper", rot:  7  },
  { fdi: "2.4", cx: 269, cy: 47,  w: 18, h: 21, type: "premolar", jaw: "upper", rot:  14 },
  { fdi: "2.5", cx: 291, cy: 54,  w: 18, h: 21, type: "premolar", jaw: "upper", rot:  24 },
  { fdi: "2.6", cx: 317, cy: 64,  w: 27, h: 17, type: "molar",    jaw: "upper", rot:  36 },
  { fdi: "2.7", cx: 346, cy: 76,  w: 24, h: 17, type: "molar",    jaw: "upper", rot:  46 },
  { fdi: "2.8", cx: 374, cy: 90,  w: 22, h: 15, type: "molar",    jaw: "upper", rot:  58 },
  { fdi: "3.1", cx: 211, cy: 218, w: 13, h: 19, type: "incisor",  jaw: "lower", rot:  0  },
  { fdi: "3.2", cx: 230, cy: 217, w: 12, h: 19, type: "incisor",  jaw: "lower", rot:  3  },
  { fdi: "3.3", cx: 249, cy: 213, w: 13, h: 24, type: "canine",   jaw: "lower", rot:  7  },
  { fdi: "3.4", cx: 269, cy: 208, w: 16, h: 21, type: "premolar", jaw: "lower", rot:  14 },
  { fdi: "3.5", cx: 291, cy: 202, w: 16, h: 21, type: "premolar", jaw: "lower", rot:  24 },
  { fdi: "3.6", cx: 317, cy: 193, w: 25, h: 17, type: "molar",    jaw: "lower", rot:  36 },
  { fdi: "3.7", cx: 346, cy: 181, w: 23, h: 17, type: "molar",    jaw: "lower", rot:  46 },
  { fdi: "3.8", cx: 374, cy: 168, w: 20, h: 15, type: "molar",    jaw: "lower", rot:  58 },
  { fdi: "4.1", cx: 191, cy: 218, w: 13, h: 19, type: "incisor",  jaw: "lower", rot:  0  },
  { fdi: "4.2", cx: 172, cy: 217, w: 12, h: 19, type: "incisor",  jaw: "lower", rot: -3  },
  { fdi: "4.3", cx: 153, cy: 213, w: 13, h: 24, type: "canine",   jaw: "lower", rot: -7  },
  { fdi: "4.4", cx: 133, cy: 208, w: 16, h: 21, type: "premolar", jaw: "lower", rot: -14 },
  { fdi: "4.5", cx: 111, cy: 202, w: 16, h: 21, type: "premolar", jaw: "lower", rot: -24 },
  { fdi: "4.6", cx: 85,  cy: 193, w: 25, h: 17, type: "molar",    jaw: "lower", rot: -36 },
  { fdi: "4.7", cx: 56,  cy: 181, w: 23, h: 17, type: "molar",    jaw: "lower", rot: -46 },
  { fdi: "4.8", cx: 28,  cy: 168, w: 20, h: 15, type: "molar",    jaw: "lower", rot: -58 },
];

/* ─── Deciduous teeth (FDI 5.x–8.x) ─────────────────────────────────────── */
const TOOTH_DATA_PRIMARY: ToothDef[] = [
  { fdi: "5.1", cx: 191, cy: 41,  w: 14, h: 17, type: "incisor", jaw: "upper", rot:  0,  primary: true },
  { fdi: "5.2", cx: 174, cy: 43,  w: 12, h: 16, type: "incisor", jaw: "upper", rot: -5,  primary: true },
  { fdi: "5.3", cx: 156, cy: 48,  w: 13, h: 20, type: "canine",  jaw: "upper", rot: -11, primary: true },
  { fdi: "5.4", cx: 129, cy: 60,  w: 20, h: 16, type: "molar",   jaw: "upper", rot: -25, primary: true },
  { fdi: "5.5", cx: 99,  cy: 76,  w: 22, h: 16, type: "molar",   jaw: "upper", rot: -41, primary: true },
  { fdi: "6.1", cx: 211, cy: 41,  w: 14, h: 17, type: "incisor", jaw: "upper", rot:  0,  primary: true },
  { fdi: "6.2", cx: 228, cy: 43,  w: 12, h: 16, type: "incisor", jaw: "upper", rot:  5,  primary: true },
  { fdi: "6.3", cx: 246, cy: 48,  w: 13, h: 20, type: "canine",  jaw: "upper", rot:  11, primary: true },
  { fdi: "6.4", cx: 273, cy: 60,  w: 20, h: 16, type: "molar",   jaw: "upper", rot:  25, primary: true },
  { fdi: "6.5", cx: 303, cy: 76,  w: 22, h: 16, type: "molar",   jaw: "upper", rot:  41, primary: true },
  { fdi: "7.1", cx: 211, cy: 215, w: 12, h: 17, type: "incisor", jaw: "lower", rot:  0,  primary: true },
  { fdi: "7.2", cx: 228, cy: 213, w: 11, h: 16, type: "incisor", jaw: "lower", rot:  5,  primary: true },
  { fdi: "7.3", cx: 246, cy: 209, w: 12, h: 20, type: "canine",  jaw: "lower", rot:  11, primary: true },
  { fdi: "7.4", cx: 273, cy: 197, w: 19, h: 16, type: "molar",   jaw: "lower", rot:  25, primary: true },
  { fdi: "7.5", cx: 303, cy: 182, w: 21, h: 16, type: "molar",   jaw: "lower", rot:  41, primary: true },
  { fdi: "8.1", cx: 191, cy: 215, w: 12, h: 17, type: "incisor", jaw: "lower", rot:  0,  primary: true },
  { fdi: "8.2", cx: 174, cy: 213, w: 11, h: 16, type: "incisor", jaw: "lower", rot: -5,  primary: true },
  { fdi: "8.3", cx: 156, cy: 209, w: 12, h: 20, type: "canine",  jaw: "lower", rot: -11, primary: true },
  { fdi: "8.4", cx: 129, cy: 197, w: 19, h: 16, type: "molar",   jaw: "lower", rot: -25, primary: true },
  { fdi: "8.5", cx: 99,  cy: 182, w: 21, h: 16, type: "molar",   jaw: "lower", rot: -41, primary: true },
];

const MIXTA_MOLARS = ["1.6","1.7","1.8","2.6","2.7","2.8","3.6","3.7","3.8","4.6","4.7","4.8"];

function getToothData(dentition: DentitionType): ToothDef[] {
  if (dentition === "temporal") return TOOTH_DATA_PRIMARY;
  if (dentition === "mixta") return [
    ...TOOTH_DATA.filter((t) => MIXTA_MOLARS.includes(t.fdi)),
    ...TOOTH_DATA_PRIMARY,
  ];
  return TOOTH_DATA;
}

/* ─── Quick-select groups ────────────────────────────────────────────────── */
const QUICK_GROUPS: { key: string; label: string; filter: (t: ToothDef) => boolean }[] = [
  { key: "todos",       label: "Boca completa", filter: () => true },
  { key: "maxilar",     label: "Maxilar",       filter: (t) => t.jaw === "upper" },
  { key: "mandibula",   label: "Mandíbula",     filter: (t) => t.jaw === "lower" },
  { key: "anteriores",  label: "Anteriores",    filter: (t) => t.type === "incisor" || t.type === "canine" },
  { key: "posteriores", label: "Posteriores",   filter: (t) => t.type === "premolar" || t.type === "molar" },
  { key: "derecha",     label: "Derecha",       filter: (t) => ["1","4","5","8"].some((q) => t.fdi.startsWith(`${q}.`)) },
  { key: "izquierda",   label: "Izquierda",     filter: (t) => ["2","3","6","7"].some((q) => t.fdi.startsWith(`${q}.`)) },
];

const SURFACES = ["V", "D", "O", "M", "P"] as const;
const SURF_LABEL: Record<string, string> = {
  V: "Vestibular", D: "Distal", O: "Oclusal", M: "Mesial", P: "Palatino/Lingual",
};

/* ─── Prestaciones ───────────────────────────────────────────────────────── */
const PRESTACION_CATEGORIES = [
  "Todas", "Diagnóstico", "Higiene", "Restauración",
  "Endodoncia", "Cirugía", "Implantes", "Ortodoncia", "Estética", "Prótesis",
] as const;
type PrestacionCategory = typeof PRESTACION_CATEGORIES[number];
// scope "per_arch" = se realiza una sola vez (boca completa, arcada o visita)
// scope "per_tooth" = se aplica por pieza dental
interface Prestacion { name: string; price: number; category: PrestacionCategory; scope?: "per_tooth" | "per_arch" }

const DEFAULT_PRESTACIONES: Prestacion[] = [
  { name: "Consulta general",         price: 15000,   category: "Diagnóstico",  scope: "per_arch"  },
  { name: "Radiografía periapical",   price: 8000,    category: "Diagnóstico",  scope: "per_tooth" },
  { name: "Radiografía panorámica",   price: 25000,   category: "Diagnóstico",  scope: "per_arch"  },
  { name: "Limpieza dental",          price: 35000,   category: "Higiene",      scope: "per_arch"  },
  { name: "Obturación (resina)",      price: 45000,   category: "Restauración", scope: "per_tooth" },
  { name: "Corona cerámica",          price: 350000,  category: "Restauración", scope: "per_tooth" },
  { name: "Corona metalcerámica",     price: 280000,  category: "Restauración", scope: "per_tooth" },
  { name: "Carilla de porcelana",     price: 450000,  category: "Restauración", scope: "per_tooth" },
  { name: "Endodoncia unirradicular", price: 180000,  category: "Endodoncia",   scope: "per_tooth" },
  { name: "Endodoncia birradicular",  price: 220000,  category: "Endodoncia",   scope: "per_tooth" },
  { name: "Endodoncia multirrad.",    price: 260000,  category: "Endodoncia",   scope: "per_tooth" },
  { name: "Extracción simple",        price: 35000,   category: "Cirugía",      scope: "per_tooth" },
  { name: "Extracción quirúrgica",    price: 80000,   category: "Cirugía",      scope: "per_tooth" },
  { name: "Implante dental",          price: 750000,  category: "Implantes",    scope: "per_tooth" },
  { name: "Corona sobre implante",    price: 350000,  category: "Implantes",    scope: "per_tooth" },
  { name: "Ortodoncia (setup)",       price: 1200000, category: "Ortodoncia",   scope: "per_arch"  },
  { name: "Control ortodoncia",       price: 30000,   category: "Ortodoncia",   scope: "per_arch"  },
  { name: "Blanqueamiento clínico",   price: 120000,  category: "Estética",     scope: "per_arch"  },
  { name: "Prótesis removible",       price: 320000,  category: "Prótesis",     scope: "per_arch"  },
];

export interface ClinicService {
  name: string;
  pricingType?: "fixed" | "range" | "variable";
  price?: string;
  priceMin?: string;
  priceMax?: string;
}

function parseClinicPrice(s: string | undefined): number {
  if (!s) return 0;
  return parseInt(s.replace(/[^0-9]/g, ""), 10) || 0;
}

function buildPrestaciones(clinicServices?: ClinicService[]): Prestacion[] {
  if (!clinicServices || clinicServices.length === 0) return DEFAULT_PRESTACIONES;
  const list = clinicServices
    .filter((s) => s.pricingType !== "variable")
    .map((s) => ({ name: s.name, price: parseClinicPrice(s.price ?? s.priceMin), category: "Restauración" as PrestacionCategory }))
    .filter((s) => s.price > 0);
  return list.length > 0 ? list : DEFAULT_PRESTACIONES;
}

const fmtCLP = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${Math.round(n / 1_000)}k`;

/* ─── Quote types ────────────────────────────────────────────────────────── */
interface QuoteItem {
  id?: string;
  toothFDI: string | null;
  surfaces: string | null;
  prestacion: string;
  unitPrice: number;
  quantity: number;
  discount: number;
  total: number;
}

// surfaces excluded — computed per-tooth from surfacesByTooth at add time
interface AddItemBase {
  prestacion: string;
  unitPrice: number;
  quantity: number;
  discount: number;
}

interface DentalQuote {
  id: string;
  patientRut: string | null;
  patientName: string;
  doctor: string | null;
  status: string;
  discount: number;
  totalAmount: number;
  notes: string | null;
  paymentInfo: string | null;
  accepted: boolean;
  sentAt: string | null;
  createdAt: string;
  items: QuoteItem[];
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  draft:    { label: "Borrador",  cls: "bg-gray-100 text-gray-500"      },
  sent:     { label: "Enviado",   cls: "bg-blue-50 text-blue-700"       },
  accepted: { label: "Aceptado",  cls: "bg-emerald-50 text-emerald-700" },
  rejected: { label: "Rechazado", cls: "bg-red-50 text-red-600"         },
};

/* ─── Tooth images — static SVG assets (pre-generated with Gemini) ────────── */
type JawKey = `${"upper" | "lower"}_${ToothType}`;
type AiImages = Partial<Record<JawKey, string>>;

function useToothImages(): { images: AiImages; loading: boolean } {
  return {
    images: {
      upper_incisor:  "/teeth/upper_incisor.png",
      upper_canine:   "/teeth/upper_canine.png",
      upper_premolar: "/teeth/upper_premolar.png",
      upper_molar:    "/teeth/upper_molar.png",
      lower_incisor:  "/teeth/lower_incisor.png",
      lower_canine:   "/teeth/lower_canine.png",
      lower_premolar: "/teeth/lower_premolar.png",
      lower_molar:    "/teeth/lower_molar.png",
    },
    loading: false,
  };
}

/* ─── SVG tooth crown (AI version) ──────────────────────────────────────── */
function ToothCrownAI({ w, h, fdi, type, jaw, rot, state, src }: {
  w: number; h: number; fdi: string; type: ToothType; jaw: JawType; rot: number; state: ToothState; src: string;
}) {
  const hw = w / 2, hh = h / 2;
  const S =
    jaw === "upper"
      ? type === "incisor" ? 2.4 : type === "canine" ? 2.1 : 2.2
      : type === "incisor" ? 2.9 : type === "canine" ? 2.5 : 2.2;
  const iw = w * S, ih = h * S;

  const filterRef = state === "active" || state === "selected" ? "url(#og-glow)" : undefined;

  // Counter-rotate so the tooth image stays visually upright despite the arc rotation on the parent.
  // Then apply per-quadrant mirror: Q4 mirror-X, Q2 mirror-Y, Q1 mirror-both, Q3 none.
  const cr = `rotate(${-rot})`;
  const imgTransform =
    fdi.startsWith("1.") ? `${cr} scale(-1,-1)` :
    fdi.startsWith("2.") ? `${cr} scale(1,-1)` :
    fdi.startsWith("4.") ? `${cr} scale(-1,1)` :
    cr;

  // Selection ring that tightly wraps the tooth — fits just the crown area
  const rx = hw * 0.95, ry = hh * 0.95;
  const ring =
    state === "active"
      ? { stroke: "#1A5C7A", sw: 2.5, fill: "rgba(26,92,122,0.12)" }
    : state === "selected"
      ? { stroke: "#2B87A8", sw: 2,   fill: "rgba(43,135,168,0.10)" }
    : state === "treatment"
      ? { stroke: "#2563EB", sw: 1.5, fill: "rgba(37,99,235,0.08)" }
    : state === "primary"
      ? { stroke: "#C47B3A", sw: 1.5, fill: "rgba(196,123,58,0.08)" }
    : state === "missing"
      ? { stroke: "#94A3B8", sw: 1.5, fill: "rgba(190,205,218,0.75)" }
    : null;

  return (
    <g filter={filterRef}>
      <image href={src} x={-iw / 2} y={-ih / 2} width={iw} height={ih}
        preserveAspectRatio="xMidYMid meet" transform={imgTransform} />
      {ring && (
        <ellipse cx={0} cy={0} rx={rx} ry={ry}
          fill={ring.fill} stroke={ring.stroke} strokeWidth={ring.sw} />
      )}
    </g>
  );
}

/* ─── SVG tooth crown ────────────────────────────────────────────────────── */
type ToothState = "normal" | "primary" | "selected" | "active" | "treatment" | "missing";

function ToothCrown({ w, h, type, jaw, state }: {
  w: number; h: number; type: ToothType; jaw: JawType; state: ToothState;
}) {
  const hw = w / 2, hh = h / 2;
  const labY  = jaw === "upper" ?  hh : -hh;
  const lingY = jaw === "upper" ? -hh :  hh;
  const sign  = labY > 0 ? 1 : -1;

  const fillId =
    state === "active"    ? "url(#og-active)"
    : state === "selected"  ? "url(#og-selected)"
    : state === "treatment" ? "url(#og-treat)"
    : state === "primary"   ? "url(#og-primary)"
    : state === "missing"   ? "#E8EEF3"
    : "url(#og-enamel)";

  const strokeColor =
    state === "active"    ? "#0d3d52"
    : state === "selected"  ? "#1565A0"
    : state === "treatment" ? "#2563EB"
    : state === "primary"   ? "#C47B3A"
    : state === "missing"   ? "#CBD5E1"
    : "#8FA8B8";

  const sw = state === "active" || state === "selected" ? 2 : 1.4;

  const grooveColor =
    state === "missing"   ? "#CBD5E1"
    : state === "active"    ? "#4DAFC8"
    : state === "selected"  ? "#6EC0D8"
    : state === "treatment" ? "#7BBCFA"
    : state === "primary"   ? "#D4A060"
    : "#9FBCCC";

  const filterRef = state === "active" || state === "selected" ? "url(#og-glow)" : undefined;
  const hiOpacity = state === "missing" ? 0 : state === "active" || state === "selected" ? 0.15 : 0.44;
  const isNatural = state === "normal" || state === "primary";

  // Gum collar — tejido gingival con dos capas para mayor realismo
  const gum = state !== "missing" ? (
    <g>
      <ellipse cx={0} cy={sign * hh * 0.12} rx={hw + 5} ry={hh + 5}
        fill="#C04868" fillOpacity={0.12} />
      <ellipse cx={0} cy={sign * hh * 0.12} rx={hw + 2.6} ry={hh + 2.6}
        fill="#D85878" fillOpacity={0.38} />
    </g>
  ) : null;

  /* ── INCISOR ── */
  if (type === "incisor") {
    const bW = hw * 0.97, lW = hw * 0.66;
    // Organic trapezoid: wider labially, narrower lingually, with curved sides
    const d = [
      `M${-lW},${lingY}`,
      `C${-lW},${lingY + sign * hh * 0.18} ${-bW},${labY - sign * hh * 0.18} ${-bW},${labY}`,
      `L${bW},${labY}`,
      `C${bW},${labY - sign * hh * 0.18} ${lW},${lingY + sign * hh * 0.18} ${lW},${lingY} Z`,
    ].join(" ");
    return (
      <g filter={filterRef}>
        {gum}
        <path d={d} fill={fillId} stroke={strokeColor} strokeWidth={sw} strokeLinejoin="round" />
        {isNatural && <path d={d} fill="url(#og-sub)" />}
        {isNatural && <path d={d} fill="url(#og-rim)" />}
        {state !== "missing" && (
          <>
            {/* 3 mamelons on incisal edge */}
            {([-0.35, 0, 0.35] as const).map((t) => (
              <ellipse key={t} cx={bW * t} cy={labY}
                rx={bW * 0.22} ry={hh * 0.11}
                fill="white" fillOpacity={hiOpacity * 0.55} />
            ))}
            {/* Marginal ridges */}
            <path d={`M${-bW * 0.85},${labY * 0.72} C${-bW * 0.9},${(labY + lingY) * 0.5} ${-lW * 0.9},${lingY * 0.72} ${-lW * 0.88},${lingY * 0.58}`}
              fill="none" stroke={grooveColor} strokeWidth={0.65} strokeLinecap="round" opacity={0.7} />
            <path d={`M${bW * 0.85},${labY * 0.72} C${bW * 0.9},${(labY + lingY) * 0.5} ${lW * 0.9},${lingY * 0.72} ${lW * 0.88},${lingY * 0.58}`}
              fill="none" stroke={grooveColor} strokeWidth={0.65} strokeLinecap="round" opacity={0.7} />
            {/* Central ridge */}
            <line x1={0} y1={labY * 0.68} x2={0} y2={lingY * 0.62}
              stroke={grooveColor} strokeWidth={0.55} strokeLinecap="round" opacity={0.55} />
            {/* Lingual fossa */}
            <ellipse cx={0} cy={lingY * 0.44} rx={lW * 0.42} ry={hh * 0.22}
              fill="none" stroke={grooveColor} strokeWidth={0.7} opacity={0.45} />
          </>
        )}
        {/* Specular highlight — broad soft + sharp bright */}
        <ellipse cx={-hw * 0.22} cy={lingY * 0.28 + labY * 0.14}
          rx={hw * 0.42} ry={hh * 0.24} fill="white" fillOpacity={hiOpacity * 0.55} />
        <ellipse cx={-hw * 0.28} cy={lingY * 0.22 + labY * 0.1}
          rx={hw * 0.18} ry={hh * 0.1} fill="white" fillOpacity={hiOpacity * 0.9} />
      </g>
    );
  }

  /* ── CANINE ── */
  if (type === "canine") {
    const shoulderH = hh * 0.28;
    const tipY = labY + sign * 1.8;
    // Organic pointed shape: cusp tip at labial, broad lingual cervix
    const d = [
      `M0,${tipY}`,
      `C${hw * 0.45},${tipY - sign * hh * 0.2} ${hw * 0.88},${lingY + sign * (shoulderH + hh * 0.3)} ${hw},${lingY + sign * shoulderH}`,
      `Q${hw},${lingY} ${hw * 0.6},${lingY}`,
      `L${-hw * 0.6},${lingY}`,
      `Q${-hw},${lingY} ${-hw},${lingY + sign * shoulderH}`,
      `C${-hw * 0.88},${lingY + sign * (shoulderH + hh * 0.3)} ${-hw * 0.45},${tipY - sign * hh * 0.2} 0,${tipY} Z`,
    ].join(" ");
    return (
      <g filter={filterRef}>
        {gum}
        <path d={d} fill={fillId} stroke={strokeColor} strokeWidth={sw} strokeLinejoin="round" />
        {isNatural && <path d={d} fill="url(#og-sub)" />}
        {isNatural && <path d={d} fill="url(#og-rim)" />}
        {state !== "missing" && (
          <>
            {/* Central ridge from tip to cingulum */}
            <line x1={0} y1={tipY + sign * 0.5} x2={0} y2={lingY + sign * shoulderH * 0.4}
              stroke={grooveColor} strokeWidth={0.8} strokeLinecap="round" opacity={0.65} />
            {/* Mesial & distal ridges */}
            <path d={`M${-hw * 0.55},${lingY + sign * shoulderH * 0.6} L${-hw * 0.2},${(tipY + lingY) * 0.42}`}
              stroke={grooveColor} strokeWidth={0.6} strokeLinecap="round" opacity={0.5} />
            <path d={`M${hw * 0.55},${lingY + sign * shoulderH * 0.6} L${hw * 0.2},${(tipY + lingY) * 0.42}`}
              stroke={grooveColor} strokeWidth={0.6} strokeLinecap="round" opacity={0.5} />
            {/* Lingual fossa */}
            <ellipse cx={0} cy={lingY * 0.48 + sign * hh * 0.06}
              rx={hw * 0.38} ry={hh * 0.19} fill="none" stroke={grooveColor} strokeWidth={0.65} opacity={0.5} />
          </>
        )}
        {/* Specular — broad soft + sharp */}
        <ellipse cx={-hw * 0.15} cy={lingY * 0.38 + labY * 0.16}
          rx={hw * 0.34} ry={hh * 0.2} fill="white" fillOpacity={hiOpacity * 0.52} />
        <ellipse cx={-hw * 0.2} cy={lingY * 0.3 + labY * 0.1}
          rx={hw * 0.15} ry={hh * 0.09} fill="white" fillOpacity={hiOpacity * 0.95} />
      </g>
    );
  }

  /* ── PREMOLAR ── */
  if (type === "premolar") {
    const rx = hw * 0.9, ry = hh * 0.93;
    // Buccal cusp (labial side) and lingual cusp
    const bCuspY = labY * 0.55;
    const lCuspY = lingY * 0.55;
    return (
      <g filter={filterRef}>
        {gum}
        {/* Crown body — rounded oval */}
        <ellipse cx={0} cy={0} rx={rx} ry={ry} fill={fillId} stroke={strokeColor} strokeWidth={sw} />
        {isNatural && <ellipse cx={0} cy={0} rx={rx} ry={ry} fill="url(#og-sub)" />}
        {isNatural && <ellipse cx={0} cy={0} rx={rx} ry={ry} fill="url(#og-rim)" />}
        {state !== "missing" && (
          <>
            {/* Buccal cusp highlight */}
            <ellipse cx={0} cy={bCuspY} rx={rx * 0.52} ry={ry * 0.25}
              fill="white" fillOpacity={hiOpacity * 0.62} />
            {/* Lingual cusp highlight (smaller) */}
            <ellipse cx={0} cy={lCuspY} rx={rx * 0.4} ry={ry * 0.2}
              fill="white" fillOpacity={hiOpacity * 0.42} />
            {/* Central transverse groove */}
            <path d={`M${-rx * 0.52},0 C${-rx * 0.2},${sign * ry * 0.08} ${rx * 0.2},${sign * ry * 0.08} ${rx * 0.52},0`}
              fill="none" stroke={grooveColor} strokeWidth={1.1} strokeLinecap="round" />
            {/* Mesial developmental groove */}
            <path d={`M${-rx * 0.52},0 L${-rx * 0.52},${labY * 0.18}`}
              stroke={grooveColor} strokeWidth={0.7} strokeLinecap="round" opacity={0.6} />
            {/* Distal developmental groove */}
            <path d={`M${rx * 0.52},0 L${rx * 0.52},${labY * 0.18}`}
              stroke={grooveColor} strokeWidth={0.7} strokeLinecap="round" opacity={0.6} />
            {/* Central fossa */}
            <circle cx={0} cy={sign * ry * 0.06} r={1.1} fill={grooveColor} fillOpacity={0.55} />
          </>
        )}
        {/* Specular — broad soft + sharp */}
        <ellipse cx={-hw * 0.18} cy={lCuspY * 0.38}
          rx={hw * 0.38} ry={hh * 0.2} fill="white" fillOpacity={hiOpacity * 0.52} />
        <ellipse cx={-hw * 0.24} cy={lCuspY * 0.28}
          rx={hw * 0.16} ry={hh * 0.09} fill="white" fillOpacity={hiOpacity * 0.95} />
      </g>
    );
  }

  /* ── MOLAR ── */
  const cpx = hw * 0.42, cpy = hh * 0.34;
  const cuspR = Math.min(hw, hh) * 0.22;
  // Organic molar outline: four convex sides (superellipse-like) — más anatómico que un rect
  const cr2 = Math.min(3.5, hw * 0.28);
  const molD = [
    `M${-hw + cr2},${-hh}`,
    `Q${0},${-hh * 1.08} ${hw - cr2},${-hh}`,
    `Q${hw},${-hh} ${hw},${-hh + cr2}`,
    `Q${hw * 1.06},${0} ${hw},${hh - cr2}`,
    `Q${hw},${hh} ${hw - cr2},${hh}`,
    `Q${0},${hh * 1.08} ${-hw + cr2},${hh}`,
    `Q${-hw},${hh} ${-hw},${hh - cr2}`,
    `Q${-hw * 1.06},${0} ${-hw},${-hh + cr2}`,
    `Q${-hw},${-hh} ${-hw + cr2},${-hh} Z`,
  ].join(" ");
  return (
    <g filter={filterRef}>
      {gum}
      {/* Crown body — superellipse orgánica */}
      <path d={molD} fill={fillId} stroke={strokeColor} strokeWidth={sw} />
      {isNatural && <path d={molD} fill="url(#og-sub)" />}
      {isNatural && <path d={molD} fill="url(#og-rim)" />}
      {state !== "missing" && (
        <>
          {/* 4 cusp highlights en posición anatómica */}
          {([-1, 1] as const).flatMap((sx) =>
            ([-1, 1] as const).map((sy) => (
              <ellipse key={`${sx}${sy}`} cx={sx * cpx} cy={sy * cpy}
                rx={cuspR * 1.25} ry={cuspR}
                fill="white" fillOpacity={hiOpacity * 0.65} />
            ))
          )}
          {/* Groove buco-lingual */}
          <path d={`M0,${-hh * 0.82} L0,${hh * 0.82}`}
            stroke={grooveColor} strokeWidth={1.15} strokeLinecap="round" />
          {/* Groove mesio-distal */}
          <path d={`M${-hw * 0.82},0 L${hw * 0.82},0`}
            stroke={grooveColor} strokeWidth={1.15} strokeLinecap="round" />
          {/* Cresta oblicua (mesiobucal → distolingual) */}
          <path d={`M${-cpx * 0.68},${-cpy * 0.78} L${cpx * 0.68},${cpy * 0.78}`}
            stroke={grooveColor} strokeWidth={0.6} strokeLinecap="round" opacity={0.55} />
          {/* Fosa central */}
          <circle cx={0} cy={0} r={1.5} fill={grooveColor} fillOpacity={0.72} />
          {/* Fosetas triangulares */}
          <circle cx={-cpx * 0.45} cy={-cpy * 0.38} r={0.8} fill={grooveColor} fillOpacity={0.45} />
          <circle cx={cpx * 0.45} cy={cpy * 0.38} r={0.8} fill={grooveColor} fillOpacity={0.45} />
        </>
      )}
      {/* Specular — broad soft + sharp */}
      <ellipse cx={-hw * 0.22} cy={-hh * 0.24}
        rx={hw * 0.4} ry={hh * 0.2} fill="white" fillOpacity={hiOpacity * 0.5} />
      <ellipse cx={-hw * 0.28} cy={-hh * 0.3}
        rx={hw * 0.16} ry={hh * 0.09} fill="white" fillOpacity={hiOpacity * 0.95} />
    </g>
  );
}

function ToothShape({ tooth, selected, active, hasItems, missing, aiImg }: {
  tooth: ToothDef; selected: boolean; active: boolean; hasItems: boolean; missing: boolean;
  aiImg?: string;
}) {
  const state: ToothState =
    missing    ? "missing"
    : active   ? "active"
    : selected ? "selected"
    : hasItems ? "treatment"
    : tooth.primary ? "primary"
    : "normal";

  const dotY = tooth.jaw === "upper" ? -tooth.h / 2 - 3 : tooth.h / 2 + 3;

  return (
    <g transform={`rotate(${tooth.rot}, ${tooth.cx}, ${tooth.cy})`}>
      <g transform={`translate(${tooth.cx}, ${tooth.cy})`}>
        {aiImg
          ? <ToothCrownAI w={tooth.w} h={tooth.h} fdi={tooth.fdi} type={tooth.type} jaw={tooth.jaw} rot={tooth.rot} state={state} src={aiImg} />
          : <ToothCrown w={tooth.w} h={tooth.h} type={tooth.type} jaw={tooth.jaw} state={state} />
        }
        {missing && (
          <>
            <line x1={-tooth.w * 0.28} y1={-tooth.h * 0.28} x2={tooth.w * 0.28} y2={tooth.h * 0.28}
              stroke="#EF4444" strokeWidth={2} strokeLinecap="round" />
            <line x1={tooth.w * 0.28} y1={-tooth.h * 0.28} x2={-tooth.w * 0.28} y2={tooth.h * 0.28}
              stroke="#EF4444" strokeWidth={2} strokeLinecap="round" />
          </>
        )}
        {hasItems && !selected && !active && !missing && (
          <circle cx={tooth.w / 2 - 2} cy={dotY} r={3} fill="#2563EB" />
        )}
      </g>
    </g>
  );
}

/* ─── Odontogram picker ──────────────────────────────────────────────────── */
type ArchView = "all" | "upper" | "lower";
type OdontMode = "select" | "missing";

function OdontogramPicker({
  selectedTeeth, activeToothFdi,
  onToggleTooth, onSetTeeth,
  missingTeeth, setMissingTeeth,
  dentitionType, setDentitionType,
  itemsByTooth,
}: {
  selectedTeeth: Set<string>;
  activeToothFdi: string | null;
  onToggleTooth: (fdi: string) => void;
  onSetTeeth: (teeth: Set<string>) => void;
  missingTeeth: Set<string>;
  setMissingTeeth: (t: Set<string>) => void;
  dentitionType: DentitionType;
  setDentitionType: (t: DentitionType) => void;
  itemsByTooth: Record<string, number>;
}) {
  const [view, setView] = useState<ArchView>("all");
  const [mode, setMode] = useState<OdontMode>("select");
  const { images: aiImages, loading: aiLoading } = useToothImages();

  const allTeeth = getToothData(dentitionType);
  const visible  = allTeeth.filter((t) => view === "all" ? true : t.jaw === view);

  const vb = view === "upper" ? "0 12 402 110"
           : view === "lower" ? "0 138 402 110"
           : "0 10 402 248";

  function handleToothClick(tooth: ToothDef) {
    if (mode === "missing") {
      const next = new Set(missingTeeth);
      if (next.has(tooth.fdi)) {
        next.delete(tooth.fdi);
      } else {
        next.add(tooth.fdi);
        // deselect if it was selected
        if (selectedTeeth.has(tooth.fdi)) onToggleTooth(tooth.fdi);
      }
      setMissingTeeth(next);
    } else {
      if (missingTeeth.has(tooth.fdi)) return;
      onToggleTooth(tooth.fdi);
    }
  }

  function selectGroup(filter: (t: ToothDef) => boolean) {
    const fdis = allTeeth.filter((t) => filter(t) && !missingTeeth.has(t.fdi)).map((t) => t.fdi);
    onSetTeeth(new Set(fdis));
  }

  const tabCls = (v: ArchView) =>
    `px-2.5 py-1 rounded-lg text-[10px] font-bold transition border ${
      view === v ? "bg-[#1A5C7A] text-white border-[#1A5C7A]" : "bg-white text-gray-400 border-gray-200 hover:border-gray-300"
    }`;
  const dentCls = (d: DentitionType) =>
    `px-2 py-0.5 rounded text-[10px] font-semibold transition border ${
      dentitionType === d ? "bg-[#1A5C7A] text-white border-[#1A5C7A]" : "bg-white text-gray-400 border-gray-200 hover:border-gray-300"
    }`;

  const selectedCount = selectedTeeth.size;

  return (
    <div style={{ background: "#F8FAFC", borderRadius: 14, padding: "10px 10px 8px", border: "1px solid #E2E8F0" }}>

      {/* ── Row 1: Dentición + Vista ───────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
        <div>
          <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#94a3b8", marginBottom: 4 }}>
            Tipo de dentición
          </p>
          <div style={{ display: "flex", gap: 4 }}>
            {(["definitiva", "temporal", "mixta"] as DentitionType[]).map((d) => (
              <button key={d} onClick={() => setDentitionType(d)} className={dentCls(d)}>
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
              <button key={v} onClick={() => setView(v)} className={tabCls(v)}>
                {v === "all" ? "Boca completa" : v === "upper" ? "Maxilar sup." : "Mandíbula inf."}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 9, color: "#b0bec5", marginTop: 3 }}>
            Filtra el diagrama para ver solo el arco que necesitas
          </p>
        </div>
      </div>

      {/* ── Row 2: Selección rápida + Marcar ausente (ARRIBA del SVG) ─────── */}
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #E8EDF2", padding: "7px 10px", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#94a3b8", whiteSpace: "nowrap" }}>
              Selección rápida
            </span>
            {selectedCount > 0 && (
              <button onClick={() => onSetTeeth(new Set())}
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
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 9, color: "#b0bec5" }}>|</span>
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
        </div>
        {mode === "missing" && (
          <p style={{ fontSize: 9, fontWeight: 700, color: "#EF4444", marginTop: 5 }}>
            Modo ausente activo — toca la pieza en el diagrama para marcarla. Tócala de nuevo para reactivarla.
          </p>
        )}
      </div>

      {/* ── SVG Odontograma ───────────────────────────────────────────────── */}
      <svg viewBox={vb} width="100%" style={{ display: "block", overflow: "visible", transition: "all 0.2s" }}
        aria-label="Odontograma dental FDI">
        <defs>
          {/* Esmalte porcelana: marfil cálido con profundidad */}
          <radialGradient id="og-enamel" cx="30%" cy="20%" r="82%" gradientUnits="objectBoundingBox">
            <stop offset="0%"   stopColor="#FEFDFB" />
            <stop offset="16%"  stopColor="#F8F3EC" />
            <stop offset="42%"  stopColor="#ECE2D4" />
            <stop offset="72%"  stopColor="#D4C6B4" />
            <stop offset="100%" stopColor="#B8A490" />
          </radialGradient>
          {/* Dispersión subsuperficial: brillo cálido de la dentina */}
          <radialGradient id="og-sub" cx="50%" cy="72%" r="55%" gradientUnits="objectBoundingBox">
            <stop offset="0%"   stopColor="#F59060" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#F59060" stopOpacity="0" />
          </radialGradient>
          {/* Penumbra de borde: oscurecimiento de bordes para dar profundidad */}
          <radialGradient id="og-rim" cx="50%" cy="50%" r="50%" gradientUnits="objectBoundingBox">
            <stop offset="54%"  stopColor="#5A3C28" stopOpacity="0" />
            <stop offset="100%" stopColor="#5A3C28" stopOpacity="0.3" />
          </radialGradient>
          {/* Diente temporal: marfil dorado */}
          <radialGradient id="og-primary" cx="30%" cy="20%" r="82%" gradientUnits="objectBoundingBox">
            <stop offset="0%"   stopColor="#FFFEF5" />
            <stop offset="28%"  stopColor="#FDF0C8" />
            <stop offset="65%"  stopColor="#E8CA6A" />
            <stop offset="100%" stopColor="#C4913A" />
          </radialGradient>
          {/* Seleccionado: teal nacarado */}
          <radialGradient id="og-selected" cx="30%" cy="20%" r="82%" gradientUnits="objectBoundingBox">
            <stop offset="0%"   stopColor="#DAFAFF" />
            <stop offset="36%"  stopColor="#3AAECE" />
            <stop offset="100%" stopColor="#1A5C7A" />
          </radialGradient>
          {/* Activo: teal brillante */}
          <radialGradient id="og-active" cx="30%" cy="20%" r="82%" gradientUnits="objectBoundingBox">
            <stop offset="0%"   stopColor="#98EEFF" />
            <stop offset="38%"  stopColor="#1E82A0" />
            <stop offset="100%" stopColor="#082C3E" />
          </radialGradient>
          {/* Tratamiento: porcelana azul */}
          <radialGradient id="og-treat" cx="30%" cy="20%" r="82%" gradientUnits="objectBoundingBox">
            <stop offset="0%"   stopColor="#EDF8FF" />
            <stop offset="44%"  stopColor="#A8D4F8" />
            <stop offset="100%" stopColor="#5A9ADE" />
          </radialGradient>
          {/* Glow para seleccionado/activo */}
          <filter id="og-glow" x="-32%" y="-32%" width="164%" height="164%">
            <feDropShadow dx="0" dy="2" stdDeviation="3.2" floodColor="#1A5C7A" floodOpacity="0.5" />
          </filter>
        </defs>
        {/* ── Maxilar superior ── */}
        {(view === "all" || view === "upper") && <>
          {/* Hueso alveolar — crema cálido */}
          <path d="M-6,122 Q52,36 201,10 Q350,36 408,122 L402,116 Q344,42 201,18 Q58,42 0,116 Z"
            fill="#EDE0CC" opacity="0.55" />
          {/* Tejido gingival externo — coral profundo */}
          <path d="M0,116 Q58,42 201,18 Q344,42 402,116 L392,108 Q338,50 201,26 Q64,50 10,108 Z"
            fill="#C0566A" opacity="0.28" />
          {/* Encía adherida — rosa vivo, banda más estrecha */}
          <path d="M10,108 Q64,50 201,26 Q338,50 392,108 L382,100 Q332,58 201,34 Q70,58 20,100 Z"
            fill="#E8738A" opacity="0.45" />
          {/* Margen gingival libre — línea brillante */}
          <path d="M20,100 Q70,58 201,34 Q332,58 382,100"
            fill="none" stroke="#F4A0B0" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
        </>}

        {/* ── Mandíbula inferior ── */}
        {(view === "all" || view === "lower") && <>
          {/* Hueso alveolar */}
          <path d="M-6,136 Q52,222 201,248 Q350,222 408,136 L402,142 Q344,216 201,240 Q58,216 0,142 Z"
            fill="#EDE0CC" opacity="0.55" />
          {/* Tejido gingival externo */}
          <path d="M0,142 Q58,216 201,240 Q344,216 402,142 L392,150 Q338,208 201,232 Q64,208 10,150 Z"
            fill="#C0566A" opacity="0.28" />
          {/* Encía adherida */}
          <path d="M10,150 Q64,208 201,232 Q338,208 392,150 L382,158 Q332,200 201,224 Q70,200 20,158 Z"
            fill="#E8738A" opacity="0.45" />
          {/* Margen gingival libre */}
          <path d="M20,158 Q70,200 201,224 Q332,200 382,158"
            fill="none" stroke="#F4A0B0" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
        </>}
        {(view === "all" || view === "upper") && (
          <line x1="201" y1="15" x2="201" y2="118" stroke="#E2E8F0" strokeDasharray="3,3" strokeWidth="1" />
        )}
        {(view === "all" || view === "lower") && (
          <line x1="201" y1="140" x2="201" y2="243" stroke="#E2E8F0" strokeDasharray="3,3" strokeWidth="1" />
        )}
        {view === "all" && <line x1="0" y1="128" x2="402" y2="128" stroke="#E2E8F0" strokeWidth="1" />}
        {(view === "all" || view === "upper") && <>
          <text x="196" y="13" textAnchor="end" fontSize="7" fill="#D1D5DB" fontWeight="600">Q1</text>
          <text x="206" y="13" textAnchor="start" fontSize="7" fill="#D1D5DB" fontWeight="600">Q2</text>
        </>}
        {(view === "all" || view === "lower") && <>
          <text x="199" y="248" textAnchor="end" fontSize="7" fill="#D1D5DB" fontWeight="600">Q4</text>
          <text x="203" y="248" textAnchor="start" fontSize="7" fill="#D1D5DB" fontWeight="600">Q3</text>
        </>}

        {visible.map((tooth) => {
          const isSelected = selectedTeeth.has(tooth.fdi);
          const isActive   = activeToothFdi === tooth.fdi;
          const isMissing  = missingTeeth.has(tooth.fdi);
          const hasItems   = (itemsByTooth[tooth.fdi] ?? 0) > 0;
          const sApprox = tooth.jaw === "upper"
            ? (tooth.type === "incisor" ? 2.4 : tooth.type === "canine" ? 2.1 : 2.2)
            : (tooth.type === "incisor" ? 2.9 : tooth.type === "canine" ? 2.5 : 2.2);
          const labelOffset = tooth.jaw === "upper"
            ? -(tooth.h * sApprox / 2 + 5)
            : (tooth.h * sApprox / 2 + 5);
          const cursor = mode === "missing" ? "crosshair" : isMissing ? "not-allowed" : "pointer";

          return (
            <g key={tooth.fdi} onClick={() => handleToothClick(tooth)} style={{ cursor, outline: "none" }}
              role="button" aria-label={`Pieza ${tooth.fdi}${isMissing ? " (ausente)" : ""}`}
              tabIndex={0} onKeyDown={(e) => e.key === "Enter" && handleToothClick(tooth)}>
              <circle cx={tooth.cx} cy={tooth.cy} r={Math.max(tooth.w, tooth.h) / 2 + 4} fill="transparent" />
              <ToothShape tooth={tooth} selected={isSelected} active={isActive} hasItems={hasItems} missing={isMissing}
                aiImg={aiImages[`${tooth.jaw}_${tooth.type}` as JawKey]} />
              <text x={tooth.cx} y={tooth.cy + labelOffset} textAnchor="middle" fontSize="7"
                fill={isMissing ? "#CBD5E1" : isActive ? "#1A5C7A" : isSelected ? "#2B87A8" : "#94a3b8"}
                fontWeight={(isActive || isSelected) ? "700" : "400"} style={{ userSelect: "none" }}>
                {tooth.fdi}
              </text>
            </g>
          );
        })}
      </svg>

      {/* ── Estado de selección (debajo del SVG) ─────────────────────────── */}
      <div style={{ textAlign: "center", marginTop: 4 }}>
        {selectedCount > 0 ? (
          <p style={{ fontSize: 10, fontWeight: 700, color: "#1A5C7A", margin: 0 }}>
            {selectedCount === 1
              ? `Pieza ${activeToothFdi} seleccionada — elige la prestación y agrega`
              : `${selectedCount} piezas seleccionadas · activa: ${activeToothFdi}`}
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

/* ─── Add item form ──────────────────────────────────────────────────────── */
function AddItemForm({
  selectedTeeth,
  activeToothFdi,
  surfacesByTooth,
  onToggleSurface,
  onSetActiveTooth,
  prestaciones,
  onAdd,
  onAddAll,
  onAddOnce,
}: {
  selectedTeeth: Set<string>;
  activeToothFdi: string | null;
  surfacesByTooth: Map<string, string[]>;
  onToggleSurface: (fdi: string, surface: string) => void;
  onSetActiveTooth: (fdi: string) => void;
  prestaciones: Prestacion[];
  onAdd: (item: AddItemBase) => void;
  onAddAll: (item: AddItemBase) => void;
  onAddOnce: (item: AddItemBase) => void;
}) {
  const [prestacion, setPrestacion]             = useState("");
  const [customPrestacion, setCustomPrestacion] = useState("");
  const [unitPrice, setUnitPrice]               = useState("");
  const [quantity, setQuantity]                 = useState("1");
  const [discount, setDiscount]                 = useState("0");
  const [category, setCategory]                 = useState<PrestacionCategory>("Todas");

  const hasCategories = prestaciones.some((p) => p.category !== "Restauración");
  const filtered = hasCategories && category !== "Todas"
    ? prestaciones.filter((p) => p.category === category)
    : prestaciones;

  const selectedPreset = prestaciones.find((p) => p.name === prestacion);
  const teethArr = Array.from(selectedTeeth);
  const teethCount = teethArr.length;

  // Detectar si la prestación seleccionada es por boca (no por pieza)
  const isPerArch = selectedPreset?.scope === "per_arch";
  const showArchWarning = isPerArch && teethCount > 1;

  // Surfaces are per-tooth and shown only for the active tooth
  const activeSurfaces = activeToothFdi ? (surfacesByTooth.get(activeToothFdi) ?? []) : [];

  function buildBase(): AddItemBase | null {
    const name  = prestacion === "__custom__" ? customPrestacion : prestacion;
    const price = selectedPreset?.price ?? parseFloat(unitPrice);
    if (!name || !price) return null;
    return { prestacion: name, unitPrice: price, quantity: parseInt(quantity) || 1, discount: parseFloat(discount) || 0 };
  }

  function resetForm() {
    setPrestacion(""); setCustomPrestacion(""); setUnitPrice("");
    setQuantity("1"); setDiscount("0");
  }

  function handleAdd() {
    const base = buildBase();
    if (!base) return;
    onAdd(base);
    resetForm();
  }

  function handleAddAll() {
    const base = buildBase();
    if (!base) return;
    onAddAll(base);
    resetForm();
  }

  // Para prestaciones per_arch con muchas piezas: agregar una sola vez sin pieza específica
  function handleAddArchOnce() {
    const base = buildBase();
    if (!base) return;
    onAddOnce(base);
    resetForm();
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col gap-3">

      {/* Tooth pills — one per selected tooth, click to activate */}
      {teethCount > 0 ? (
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">
            Piezas seleccionadas
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {teethArr.map((fdi) => {
              const surfs = surfacesByTooth.get(fdi) ?? [];
              const isActive = fdi === activeToothFdi;
              return (
                <button key={fdi} onClick={() => onSetActiveTooth(fdi)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border transition"
                  style={isActive
                    ? { background: "#1A5C7A", color: "#fff", borderColor: "#1A5C7A" }
                    : { background: "#EFF6FF", color: "#1d4ed8", borderColor: "#BFDBFE" }}>
                  {fdi}
                  {surfs.length > 0 && (
                    <span style={{ fontSize: 8, opacity: 0.8 }}>· {surfs.join(",")}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-gray-300 shrink-0" />
          <p className="text-xs font-bold text-gray-400">Sin pieza específica</p>
        </div>
      )}

      {/* Surface picker — for the active tooth */}
      {activeToothFdi && (
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">
            Superficies · pieza <span style={{ color: "#1A5C7A" }}>{activeToothFdi}</span>
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {SURFACES.map((s) => (
              <button key={s} onClick={() => onToggleSurface(activeToothFdi, s)} title={SURF_LABEL[s]}
                className="px-2 py-1 rounded-lg text-[10px] font-bold border transition"
                style={activeSurfaces.includes(s)
                  ? { background: "#1A5C7A", color: "#fff", borderColor: "#1A5C7A" }
                  : { background: "#F7F5F1", color: "#607281", borderColor: "#E5E0D9" }}>
                {s}
              </button>
            ))}
          </div>
          {teethCount > 1 && (
            <p className="text-[9px] text-gray-400 mt-1">
              Selecciona otra pieza arriba para configurar sus superficies individualmente
            </p>
          )}
        </div>
      )}

      {/* Category filter */}
      {hasCategories && (
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Categoría</p>
          <div className="flex gap-1 flex-wrap">
            {PRESTACION_CATEGORIES.map((cat) => (
              <button key={cat}
                onClick={() => { setCategory(cat); setPrestacion(""); setUnitPrice(""); }}
                className="px-2 py-0.5 rounded text-[10px] font-semibold transition border"
                style={category === cat
                  ? { background: "#1A5C7A", color: "#fff", borderColor: "#1A5C7A" }
                  : { background: "#F8FAFC", color: "#64748B", borderColor: "#E2E8F0" }}>
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Prestación</p>
        <select value={prestacion}
          onChange={(e) => {
            setPrestacion(e.target.value);
            const preset = prestaciones.find((p) => p.name === e.target.value);
            if (preset) setUnitPrice(String(preset.price));
            else setUnitPrice("");
          }}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="">Seleccionar prestación…</option>
          {filtered.map((p) => (
            <option key={p.name} value={p.name}>{p.name} — {fmtCLP(p.price)}</option>
          ))}
          <option value="__custom__">+ Otra (personalizada)</option>
        </select>
        {prestacion === "__custom__" && (
          <input value={customPrestacion} onChange={(e) => setCustomPrestacion(e.target.value)}
            placeholder="Nombre de la prestación"
            className="mt-2 w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400" />
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Precio CLP</p>
          <input type="number" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="0"
            className="w-full px-2 py-1.5 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Cant.</p>
          <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)}
            className="w-full px-2 py-1.5 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Dcto %</p>
          <input type="number" min="0" max="100" value={discount} onChange={(e) => setDiscount(e.target.value)}
            className="w-full px-2 py-1.5 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
      </div>

      {/* Aviso per_arch cuando hay múltiples piezas seleccionadas */}
      {showArchWarning && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200">
          <span className="text-amber-500 text-sm shrink-0 mt-0.5">⚠</span>
          <div>
            <p className="text-[11px] font-bold text-amber-700">Prestación por boca completa</p>
            <p className="text-[10px] text-amber-600 mt-0.5">
              "{selectedPreset?.name}" se realiza una sola vez, no por pieza.
              Usa el botón de abajo para agregarla correctamente.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {showArchWarning ? (
          /* Modo per_arch con múltiples piezas: solo ofrecer agregar una vez */
          <button onClick={handleAddArchOnce}
            disabled={!prestacion || (!selectedPreset && !unitPrice && !customPrestacion)}
            className="w-full py-2 rounded-xl text-xs font-bold text-white transition disabled:opacity-40"
            style={{ background: "#B45309" }}>
            + Agregar una vez (boca completa) — {selectedPreset ? fmtCLP(selectedPreset.price) : ""}
          </button>
        ) : (
          <>
            <button onClick={handleAdd}
              disabled={!prestacion || (!selectedPreset && !unitPrice && !customPrestacion)}
              className="w-full py-2 rounded-xl text-xs font-bold text-white transition disabled:opacity-40"
              style={{ background: "#1A5C7A" }}>
              {activeToothFdi
                ? `+ Agregar a pieza ${activeToothFdi}`
                : "+ Agregar al presupuesto (sin pieza)"}
            </button>
            {teethCount > 1 && !isPerArch && (
              <button onClick={handleAddAll}
                disabled={!prestacion || (!selectedPreset && !unitPrice && !customPrestacion)}
                className="w-full py-1.5 rounded-xl text-xs font-semibold text-gray-500 border border-gray-200 hover:bg-gray-50 transition disabled:opacity-40">
                Aplicar misma prestación a las {teethCount} piezas seleccionadas
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Quote builder modal ────────────────────────────────────────────────── */
function QuoteBuilderModal({
  patient, clinicServices, onClose, onSaved,
}: {
  patient: { name: string; rut: string | null };
  clinicServices?: ClinicService[];
  onClose: () => void;
  onSaved: (q: DentalQuote) => void;
}) {
  const [selectedTeeth, setSelectedTeeth] = useState<Set<string>>(new Set());
  const [activeToothFdi, setActiveToothFdi] = useState<string | null>(null);
  const [surfacesByTooth, setSurfacesByTooth] = useState<Map<string, string[]>>(new Map());
  const [missingTeeth, setMissingTeeth]   = useState<Set<string>>(new Set());
  const [dentitionType, setDentitionType] = useState<DentitionType>("definitiva");
  const [items, setItems]                 = useState<Omit<QuoteItem, "id">[]>([]);
  const [generalDiscount, setGeneralDiscount] = useState(0);
  const [notes, setNotes]                 = useState("");
  const [paymentInfo, setPaymentInfo]     = useState("");
  const [saving, setSaving]               = useState(false);
  const [error, setError]                 = useState("");
  const [doctor, setDoctor]               = useState("");
  const [DOCTORS, setDoctors]             = useState<string[]>([]);

  useEffect(() => {
    import("@/lib/auth").then(({ getMe }) =>
      getMe().then((data) => {
        const cfg = data?.clinic?.config as { doctors?: { name: string }[] } | undefined;
        if (cfg?.doctors) setDoctors(cfg.doctors.map((d) => d.name));
      })
    );
  }, []);

  const prestaciones = buildPrestaciones(clinicServices);

  function handleToggleTooth(fdi: string) {
    setSelectedTeeth((prev) => {
      const next = new Set(prev);
      if (next.has(fdi)) {
        next.delete(fdi);
        setSurfacesByTooth((sm) => { const m = new Map(sm); m.delete(fdi); return m; });
        if (activeToothFdi === fdi) {
          const rem = Array.from(next);
          setActiveToothFdi(rem.length > 0 ? rem[rem.length - 1] : null);
        }
      } else {
        next.add(fdi);
        setActiveToothFdi(fdi);
      }
      return next;
    });
  }

  function handleSetTeeth(teeth: Set<string>) {
    setSelectedTeeth(teeth);
    setSurfacesByTooth(new Map());
    const arr = Array.from(teeth);
    setActiveToothFdi(arr.length > 0 ? arr[arr.length - 1] : null);
  }

  function handleToggleSurface(fdi: string, surface: string) {
    setSurfacesByTooth((prev) => {
      const next = new Map(prev);
      const cur = next.get(fdi) ?? [];
      if (cur.includes(surface)) next.set(fdi, cur.filter((s) => s !== surface));
      else next.set(fdi, [...cur, surface]);
      return next;
    });
  }

  function addItemToActive(base: AddItemBase) {
    const tooth = activeToothFdi;
    const surfs = tooth ? (surfacesByTooth.get(tooth) ?? []) : [];
    const total = base.unitPrice * base.quantity * (1 - base.discount / 100);
    setItems((prev) => [...prev, { ...base, toothFDI: tooth, surfaces: surfs.length > 0 ? surfs.join(",") : null, total }]);
    // advance to next unprocessed tooth, or clear if last
    const arr = Array.from(selectedTeeth);
    const idx  = tooth ? arr.indexOf(tooth) : -1;
    if (idx >= 0 && idx < arr.length - 1) {
      setActiveToothFdi(arr[idx + 1]);
    } else {
      setSelectedTeeth(new Set());
      setSurfacesByTooth(new Map());
      setActiveToothFdi(null);
    }
  }

  function addItemsToAll(base: AddItemBase) {
    const teeth: (string | null)[] = selectedTeeth.size > 0 ? Array.from(selectedTeeth) : [null];
    const newItems: Omit<QuoteItem, "id">[] = teeth.map((toothFDI) => {
      const surfs = toothFDI ? (surfacesByTooth.get(toothFDI) ?? []) : [];
      const total = base.unitPrice * base.quantity * (1 - base.discount / 100);
      return { ...base, toothFDI, surfaces: surfs.length > 0 ? surfs.join(",") : null, total };
    });
    setItems((prev) => [...prev, ...newItems]);
    setSelectedTeeth(new Set());
    setSurfacesByTooth(new Map());
    setActiveToothFdi(null);
  }

  // Prestaciones por boca (per_arch): agregar una sola vez sin pieza específica
  function addArchItem(base: AddItemBase) {
    const total = base.unitPrice * base.quantity * (1 - base.discount / 100);
    setItems((prev) => [...prev, { ...base, toothFDI: null, surfaces: null, total }]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  const subtotal   = items.reduce((s, i) => s + i.total, 0);
  const totalFinal = subtotal * (1 - generalDiscount / 100);

  const itemsByTooth: Record<string, number> = {};
  for (const item of items) {
    if (item.toothFDI) itemsByTooth[item.toothFDI] = (itemsByTooth[item.toothFDI] ?? 0) + 1;
  }

  async function handleSave() {
    if (items.length === 0) { setError("Agrega al menos una prestación"); return; }
    setSaving(true); setError("");
    try {
      const token = getToken();
      const res = await fetch(`${API}/api/dental-quotes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          patientRut:  patient.rut ?? undefined,
          patientName: patient.name,
          doctor:      doctor || undefined,
          discount:    generalDiscount,
          notes:       notes || undefined,
          paymentInfo: paymentInfo || undefined,
          items: items.map((i) => ({
            toothFDI:   i.toothFDI ?? undefined,
            surfaces:   i.surfaces ?? undefined,
            prestacion: i.prestacion,
            unitPrice:  i.unitPrice,
            quantity:   i.quantity,
            discount:   i.discount,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Error al guardar"); return; }
      onSaved(data);
    } catch {
      setError("Error de conexión");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-gray-50 rounded-2xl border border-gray-200 shadow-2xl w-full max-w-5xl my-4 overflow-hidden">
        <div className="px-6 py-4 bg-white border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-black text-gray-900">Nuevo presupuesto dental</h2>
            <p className="text-xs text-gray-400 mt-0.5">{patient.name}{patient.rut ? ` · ${patient.rut}` : ""}</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 transition flex items-center justify-center text-gray-500">
            ✕
          </button>
        </div>

        <div className="p-4 flex flex-col gap-4">
          <OdontogramPicker
            selectedTeeth={selectedTeeth} activeToothFdi={activeToothFdi}
            onToggleTooth={handleToggleTooth} onSetTeeth={handleSetTeeth}
            missingTeeth={missingTeeth}       setMissingTeeth={setMissingTeeth}
            dentitionType={dentitionType}     setDentitionType={setDentitionType}
            itemsByTooth={itemsByTooth}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="flex flex-col gap-3">
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Doctor responsable</p>
                <select value={doctor} onChange={(e) => setDoctor(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
                  <option value="">Sin asignar</option>
                  {DOCTORS.map((d) => <option key={d} value={d}>{d.replace(/Dra?\. /, "")}</option>)}
                </select>
              </div>

              <AddItemForm
                selectedTeeth={selectedTeeth}
                activeToothFdi={activeToothFdi}
                surfacesByTooth={surfacesByTooth}
                onToggleSurface={handleToggleSurface}
                onSetActiveTooth={setActiveToothFdi}
                prestaciones={prestaciones}
                onAdd={addItemToActive}
                onAddAll={addItemsToAll}
                onAddOnce={addArchItem}
              />
            </div>

            <div className="flex flex-col gap-3">
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden flex flex-col">
                <div className="px-4 py-3 border-b border-gray-50">
                  <p className="text-xs font-bold text-gray-800">Prestaciones ({items.length})</p>
                </div>
                {items.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6">Sin prestaciones — selecciona pieza y agrega arriba</p>
                ) : (
                  <div className="divide-y divide-gray-50 overflow-y-auto" style={{ maxHeight: 260 }}>
                    {items.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2 px-4 py-2.5">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {item.toothFDI && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                                {item.toothFDI}
                              </span>
                            )}
                            {item.surfaces && item.surfaces.split(",").map((s) => (
                              <span key={s} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{s}</span>
                            ))}
                          </div>
                          <p className="text-xs font-semibold text-gray-800 mt-0.5">{item.prestacion}</p>
                          <p className="text-[10px] text-gray-400">
                            {fmtCLP(item.unitPrice)}
                            {item.quantity > 1 && ` × ${item.quantity}`}
                            {item.discount > 0 && ` · ${item.discount}% dto`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-bold text-gray-700">{fmtCLP(item.total)}</span>
                          <button onClick={() => removeItem(idx)}
                            className="text-gray-300 hover:text-red-500 transition text-sm leading-none">✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Subtotal</span>
                  <span className="font-semibold text-gray-800">{fmtCLP(subtotal)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 shrink-0">Descuento general</span>
                  <div className="flex items-center gap-1 flex-1">
                    <input type="range" min="0" max="50" value={generalDiscount}
                      onChange={(e) => setGeneralDiscount(Number(e.target.value))} className="flex-1 accent-blue-600" />
                    <span className="text-xs font-bold text-blue-600 w-8 text-right">{generalDiscount}%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-gray-50">
                  <span className="text-sm font-bold text-gray-900">Total</span>
                  <span className="text-lg font-black" style={{ color: "#1A5C7A" }}>{fmtCLP(totalFinal)}</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col gap-3">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Observaciones</p>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                    placeholder="Observaciones clínicas del presupuesto…"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Formas de pago</p>
                  <input value={paymentInfo} onChange={(e) => setPaymentInfo(e.target.value)}
                    placeholder="Ej: Efectivo, transferencia o hasta 3 cuotas"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
              </div>

              {error && <p className="text-xs text-red-600 font-medium px-1">{error}</p>}

              <button onClick={handleSave} disabled={saving || items.length === 0}
                className="w-full py-3 rounded-2xl text-sm font-black text-white transition disabled:opacity-40"
                style={{ background: "#1A5C7A", boxShadow: "0 4px 16px rgba(26,92,122,0.25)" }}>
                {saving ? "Guardando…" : `Guardar presupuesto · ${fmtCLP(totalFinal)}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Print helper ───────────────────────────────────────────────────────── */
function printQuote(quote: DentalQuote) {
  const MONTHS = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  const d = new Date(quote.createdAt);
  const dateStr = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  const fmt = (n: number) => n >= 1_000_000 ? `$${(n/1_000_000).toFixed(2)}M` : `$${Math.round(n/1_000)}k`;
  const rows = quote.items.map((item) => `
    <tr>
      <td>${item.toothFDI ?? "General"}${item.surfaces ? ` (${item.surfaces})` : ""}</td>
      <td>${item.prestacion}</td>
      <td class="r">${fmt(item.unitPrice)}${item.quantity > 1 ? ` × ${item.quantity}` : ""}</td>
      <td class="r">${item.discount > 0 ? `${item.discount}%` : "—"}</td>
      <td class="r">${fmt(item.total)}</td>
    </tr>`).join("");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Presupuesto — ${quote.patientName}</title>
  <style>
    body{font-family:system-ui,sans-serif;padding:36px;max-width:680px;margin:0 auto;color:#111;font-size:13px}
    h1{font-size:20px;margin:0 0 4px}
    .sub{color:#666;font-size:12px;margin-bottom:24px}
    table{width:100%;border-collapse:collapse}
    th{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#888;border-bottom:2px solid #e5e7eb;padding:6px 4px;text-align:left}
    td{padding:8px 4px;border-bottom:1px solid #f3f4f6}
    .r{text-align:right}
    .total td{font-weight:700;font-size:15px;border-top:2px solid #111;border-bottom:none}
    .note{margin-top:24px;font-size:11px;color:#888}
    @media print{body{padding:16px}}
  </style></head><body>
  <h1>Presupuesto Dental</h1>
  <p class="sub">
    Paciente: <strong>${quote.patientName}</strong>${quote.patientRut ? ` &nbsp;·&nbsp; RUT: ${quote.patientRut}` : ""}${quote.doctor ? ` &nbsp;·&nbsp; Dr/a: ${quote.doctor}` : ""}<br>
    Fecha: ${dateStr}
  </p>
  <table>
    <thead><tr><th>Pieza</th><th>Prestación</th><th class="r">Precio unit.</th><th class="r">Dto.</th><th class="r">Total</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr class="total"><td colspan="4" class="r">Total${quote.discount > 0 ? ` (${quote.discount}% dto. general)` : ""}</td><td class="r">${fmt(quote.totalAmount)}</td></tr></tfoot>
  </table>
  ${quote.notes ? `<p class="note">Notas: ${quote.notes}</p>` : ""}
  ${quote.paymentInfo ? `<p class="note">Forma de pago: ${quote.paymentInfo}</p>` : ""}
  <p class="note">Generado con molari.ai</p>
  </body></html>`;
  const win = window.open("", "_blank", "width=800,height=600");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 300);
}

/* ─── Quote card ─────────────────────────────────────────────────────────── */
function QuoteCard({ quote, onStatusChange }: {
  quote: DentalQuote;
  onStatusChange: (id: string, status: string) => void;
}) {
  const [expanded, setExpanded]         = useState(false);
  const [showEmail, setShowEmail]       = useState(false);
  const [emailInput, setEmailInput]     = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailMsg, setEmailMsg]         = useState("");

  const st = STATUS_LABELS[quote.status] ?? STATUS_LABELS.draft;
  const MONTHS = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  const d = new Date(quote.createdAt);
  const dateStr = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

  async function sendEmail() {
    if (!emailInput.trim()) return;
    setSendingEmail(true); setEmailMsg("");
    try {
      const token = getToken();
      const res = await fetch(`${API}/api/dental-quotes/${quote.id}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: emailInput.trim() }),
      });
      if (res.ok) { setEmailMsg("Enviado"); setShowEmail(false); setTimeout(() => setEmailMsg(""), 4000); }
      else setEmailMsg("Error al enviar");
    } catch { setEmailMsg("Error de conexión"); }
    finally { setSendingEmail(false); }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <button className="w-full text-left px-5 py-4 flex items-center gap-3" onClick={() => setExpanded(!expanded)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
            {quote.accepted && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">✓ Aceptado</span>
            )}
            <span className="text-[10px] text-gray-400">{dateStr}</span>
            {emailMsg === "Enviado" && <span className="text-[10px] text-blue-600 font-semibold">✉ Enviado</span>}
          </div>
          <p className="text-sm font-bold text-gray-800 mt-1">
            {quote.items.length} prestación{quote.items.length !== 1 ? "es" : ""}
            {quote.doctor && <span className="text-gray-400 font-normal"> · {quote.doctor.replace(/Dra?\. /, "")}</span>}
          </p>
          {quote.notes && <p className="text-[11px] text-gray-400 truncate">{quote.notes}</p>}
        </div>
        <div className="text-right shrink-0">
          <p className="text-base font-black" style={{ color: "#1A5C7A" }}>{fmtCLP(quote.totalAmount)}</p>
          {quote.discount > 0 && <p className="text-[10px] text-amber-600">{quote.discount}% dto</p>}
        </div>
        <span className="text-gray-300 text-sm ml-1">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="border-t border-gray-50">
          <div className="px-5 py-3 space-y-2">
            {quote.items.map((item, idx) => (
              <div key={item.id ?? idx} className="flex items-center gap-3">
                <div className="flex gap-1 flex-wrap w-20 shrink-0">
                  {item.toothFDI && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">{item.toothFDI}</span>
                  )}
                  {item.surfaces && item.surfaces.split(",").map((s) => (
                    <span key={s} className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{s}</span>
                  ))}
                  {!item.toothFDI && <span className="text-[9px] text-gray-300">General</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-700">{item.prestacion}</p>
                  <p className="text-[10px] text-gray-400">
                    {fmtCLP(item.unitPrice)}
                    {item.quantity > 1 && ` × ${item.quantity}`}
                    {item.discount > 0 && ` · ${item.discount}% dto`}
                  </p>
                </div>
                <span className="text-xs font-bold text-gray-700 shrink-0">{fmtCLP(item.total)}</span>
              </div>
            ))}
            {quote.paymentInfo && (
              <p className="text-[11px] text-gray-400 pt-3 border-t border-gray-50">💳 {quote.paymentInfo}</p>
            )}
          </div>

          <div className="px-5 py-3 border-t border-gray-50 flex gap-2 flex-wrap items-center">
            {quote.status !== "accepted" && (
              <>
                {quote.status === "draft" && (
                  <button onClick={() => onStatusChange(quote.id, "sent")}
                    className="text-xs font-bold px-3 py-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition">
                    Marcar como enviado
                  </button>
                )}
                {quote.status === "sent" && (
                  <button onClick={() => onStatusChange(quote.id, "accepted")}
                    className="text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition">
                    Paciente aceptó
                  </button>
                )}
                <button onClick={() => onStatusChange(quote.id, "rejected")}
                  className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition">
                  Rechazado
                </button>
              </>
            )}
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => printQuote(quote)}
                className="text-xs font-semibold text-gray-500 hover:text-gray-700">
                🖨 Imprimir
              </button>
              {emailMsg && emailMsg !== "Enviado" && <span className="text-[10px] text-red-500">{emailMsg}</span>}
              {showEmail ? (
                <>
                  <input type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendEmail()}
                    placeholder="correo@paciente.cl" autoFocus
                    className="px-2 py-1 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 w-44" />
                  <button onClick={sendEmail} disabled={sendingEmail}
                    className="text-xs font-bold px-3 py-1.5 rounded-xl bg-[#1A5C7A] text-white hover:bg-[#0e4560] transition disabled:opacity-50">
                    {sendingEmail ? "…" : "Enviar"}
                  </button>
                  <button onClick={() => setShowEmail(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancelar</button>
                </>
              ) : (
                <button onClick={() => setShowEmail(true)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700">
                  ✉ Enviar por email
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main DentalQuoteTab ────────────────────────────────────────────────── */
export function DentalQuoteTab({
  patient, clinicServices,
}: {
  patient: { name: string; rut: string | null };
  clinicServices?: ClinicService[];
}) {
  const [quotes, setQuotes]           = useState<DentalQuote[]>([]);
  const [loading, setLoading]         = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    const url = patient.rut
      ? `${API}/api/dental-quotes?patientRut=${encodeURIComponent(patient.rut)}`
      : `${API}/api/dental-quotes`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data: DentalQuote[]) => {
        setQuotes(patient.rut ? data : data.filter((q) => q.patientName === patient.name));
      })
      .finally(() => setLoading(false));
  }, [patient.rut, patient.name]);

  async function handleStatusChange(id: string, status: string) {
    const token = getToken();
    const res = await fetch(`${API}/api/dental-quotes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status, ...(status === "accepted" ? { accepted: true } : {}) }),
    });
    if (res.ok) {
      const updated = await res.json();
      setQuotes((prev) => prev.map((q) => (q.id === id ? updated : q)));
    }
  }

  const totalSent     = quotes.filter((q) => q.status !== "rejected").reduce((s, q) => s + q.totalAmount, 0);
  const totalAccepted = quotes.filter((q) => q.accepted).reduce((s, q) => s + q.totalAmount, 0);

  return (
    <div className="flex flex-col gap-3">
      {quotes.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-xl border border-gray-100 px-3 py-2.5 text-center">
            <p className="text-[9px] text-gray-400 font-bold uppercase">Presupuestos</p>
            <p className="text-lg font-black text-gray-800">{quotes.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 px-3 py-2.5 text-center">
            <p className="text-[9px] text-gray-400 font-bold uppercase">Total cotizado</p>
            <p className="text-base font-black" style={{ color: "#1A5C7A" }}>{fmtCLP(totalSent)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 px-3 py-2.5 text-center">
            <p className="text-[9px] text-gray-400 font-bold uppercase">Aceptado</p>
            <p className="text-base font-black text-emerald-600">{fmtCLP(totalAccepted)}</p>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={() => setShowBuilder(true)}
          className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 transition">
          <span className="text-base leading-none">+</span> Nuevo presupuesto
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : quotes.length === 0 ? (
        <div className="flex flex-col items-center py-8 gap-2">
          <p className="text-2xl">🦷</p>
          <p className="text-sm text-gray-400">Sin presupuestos aún</p>
          <button onClick={() => setShowBuilder(true)} className="text-xs font-bold text-blue-600 hover:underline mt-1">
            Crear el primero
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {quotes.map((q) => <QuoteCard key={q.id} quote={q} onStatusChange={handleStatusChange} />)}
        </div>
      )}

      {showBuilder && (
        <QuoteBuilderModal
          patient={patient} clinicServices={clinicServices}
          onClose={() => setShowBuilder(false)}
          onSaved={(q) => { setQuotes((prev) => [q, ...prev]); setShowBuilder(false); }}
        />
      )}
    </div>
  );
}
