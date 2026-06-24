"use client";

/**
 * Vista FRONTAL anatómica de un diente — SVG escalable (Issue #43).
 * Cada tipo (incisor/canine/premolar/molar) y arcada (upper/lower) tiene una
 * silueta característica con corona + raíces visibles.
 *
 * Para vista oclusal (desde arriba) usar los PNGs en /public/teeth/.
 */

type ToothType = "incisor" | "canine" | "premolar" | "molar";

interface Props {
  type:   ToothType;
  jaw:    "upper" | "lower";
  /** Color de relleno de la corona (esmalte). Default crema. */
  fill?:        string;
  /** Color del trazo */
  stroke?:      string;
  /** Color de la raíz (default beige) */
  rootFill?:    string;
  /** Tinte de overlay (caries, corona, etc.) — semitransparente */
  tint?:        string;
  /** Tamaño en px (ancho del SVG; alto se calcula proporcional) */
  size?:        number;
  /** Si la raíz va arriba (diente superior) o abajo (diente inferior) */
  rootUp?:      boolean;
  className?:   string;
}

export function ToothFrontView({
  type, jaw, fill, stroke, rootFill, tint, size = 48, rootUp, className,
}: Props) {
  // viewBox: ancho 60, alto 100 (proporción diente real)
  const W = 60, H = 100;
  const finalFill   = fill   ?? "#FBF6EC";    // esmalte cálido marfil
  const finalRoot   = rootFill ?? "#F0E4CC";  // raíz beige
  const finalStroke = stroke ?? "#94A3B8";

  const isUpper = jaw === "upper";
  const flipY   = rootUp ?? isUpper;          // upper: raíz arriba, lower: raíz abajo

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={size} height={size * (H / W)}
      className={className}
      style={{ display: "block", transform: flipY ? "scaleY(-1)" : undefined }}>
      <defs>
        {/* Gradiente esmalte: brillante arriba, sombra abajo */}
        <linearGradient id={`enamel-${type}`} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%"   stopColor="#FFFEF8" />
          <stop offset="40%"  stopColor={finalFill} />
          <stop offset="100%" stopColor="#D9CDB8" />
        </linearGradient>
        <linearGradient id={`root-${type}`} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%"   stopColor={finalRoot} />
          <stop offset="100%" stopColor="#C9B89A" />
        </linearGradient>
        {/* Highlight de cúspide */}
        <linearGradient id={`shine-${type}`} x1="50%" y1="0%" x2="50%" y2="50%">
          <stop offset="0%"  stopColor="#FFFFFF" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>

      {renderToothPath(type, jaw, finalStroke)}

      {/* Tint overlay (caries, corona, etc.) */}
      {tint && (
        <g style={{ pointerEvents: "none" }}>
          {renderToothPath(type, jaw, "transparent", tint, 0.4)}
        </g>
      )}
    </svg>
  );
}

/* ── Paths anatómicos por tipo de diente ───────────────────────────────────
 * viewBox 60×100. Corona arriba (0–45), línea cervical (~45–50), raíz abajo (50–100).
 * Inspirado en ilustraciones de Wheeler's Dental Anatomy. Paths refinados con curvas
 * Bezier más naturales, surcos visibles, cervix marcado y ápices curvados.
 */
function renderToothPath(type: ToothType, jaw: "upper" | "lower", stroke: string, fill?: string, opacity?: number) {
  const sw = 1.2;
  const enamelFill = fill ?? `url(#enamel-${type})`;
  const rootFill   = fill ?? `url(#root-${type})`;
  const opa = opacity ?? 1;

  // Línea cervical sutil — separación corona/raíz (color natural más oscuro)
  const cervix = !fill ? (
    <line x1="14" y1="46" x2="46" y2="46" stroke="#C8B89E" strokeWidth={0.6} opacity={0.7} />
  ) : null;

  switch (type) {
    case "incisor":
      return (
        <g opacity={opa}>
          {/* Corona: forma de pala con curvas suaves, ligeramente cóncava en mesial/distal */}
          <path
            d="M 17,6
               C 17,14 16,30 19,44
               Q 22,46 30,46
               Q 38,46 41,44
               C 44,30 43,14 43,6
               Q 38,3 30,3
               Q 22,3 17,6 Z"
            fill={enamelFill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
          {/* Borde incisal con curva incisal natural */}
          <path d="M 19,44 Q 30,47 41,44" fill="none" stroke={stroke} strokeWidth={sw * 1.3} strokeLinecap="round" />
          {/* Línea media labial — relieve longitudinal característico */}
          {!fill && <line x1="30" y1="10" x2="30" y2="42" stroke="#D8C9B0" strokeWidth={0.5} opacity="0.6" />}
          {/* Crestas marginales sutiles */}
          {!fill && <>
            <path d="M 21,12 Q 22,28 23,42" fill="none" stroke="#E0D2BC" strokeWidth={0.4} opacity="0.5" />
            <path d="M 39,12 Q 38,28 37,42" fill="none" stroke="#E0D2BC" strokeWidth={0.4} opacity="0.5" />
          </>}
          {cervix}
          {/* Raíz cónica con apex curvado distalmente */}
          <path
            d="M 21,48
               C 19,60 17,76 23,92
               Q 26,98 30,98
               Q 34,98 37,92
               C 43,76 41,60 39,48
               Q 37,47 30,47 Q 23,47 21,48 Z"
            fill={rootFill} stroke={stroke} strokeWidth={sw * 0.85} strokeLinejoin="round" />
          {/* Sombra de profundidad raíz */}
          {!fill && <path d="M 28,55 Q 28,75 30,92" fill="none" stroke="#B8A788" strokeWidth={0.6} opacity={0.5} />}
          {/* Highlight de esmalte (reflejo) */}
          {!fill && <path d="M 21,8 Q 23,22 26,42 L 28,42 Q 25,20 24,7 Z" fill={`url(#shine-incisor)`} />}
        </g>
      );

    case "canine":
      return (
        <g opacity={opa}>
          {/* Corona: cúspide central prominente con vertientes mesial/distal */}
          <path
            d="M 18,8
               C 18,16 18,32 22,44
               L 25,46
               L 30,38
               L 35,46
               L 38,44
               C 42,32 42,16 42,8
               Q 36,3 30,3
               Q 24,3 18,8 Z"
            fill={enamelFill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
          {/* Cúspide central — punta de canino */}
          <path d="M 25,46 L 30,36 L 35,46" fill="none" stroke={stroke} strokeWidth={sw * 1.1} strokeLinejoin="round" />
          {/* Cresta vertical media (la "espina" del canino) */}
          {!fill && <line x1="30" y1="8" x2="30" y2="38" stroke="#C8B89E" strokeWidth={0.7} opacity={0.6} />}
          {cervix}
          {/* Raíz larga y robusta, característica del canino */}
          <path
            d="M 22,48
               C 19,62 16,80 23,96
               Q 27,99 30,99
               Q 33,99 37,96
               C 44,80 41,62 38,48
               Q 36,47 30,47 Q 24,47 22,48 Z"
            fill={rootFill} stroke={stroke} strokeWidth={sw * 0.85} strokeLinejoin="round" />
          {!fill && <path d="M 29,56 Q 30,78 30,96" fill="none" stroke="#B8A788" strokeWidth={0.6} opacity={0.5} />}
          {!fill && <path d="M 22,12 Q 25,26 29,40 L 30,38 Q 28,18 25,9 Z" fill={`url(#shine-canine)`} />}
        </g>
      );

    case "premolar":
      return (
        <g opacity={opa}>
          {/* Corona: 2 cúspides (vestibular más alta + lingual/palatina) */}
          <path
            d="M 16,10
               C 16,18 18,30 19,44
               L 23,46
               L 26,40
               L 30,44
               L 34,40
               L 37,46
               L 41,44
               C 42,30 44,18 44,10
               Q 38,4 30,4
               Q 22,4 16,10 Z"
            fill={enamelFill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
          {/* Surco oclusal mesio-distal entre las 2 cúspides */}
          <path d="M 23,46 L 30,44 L 37,46" fill="none" stroke={stroke} strokeWidth={sw * 0.7} opacity="0.8" strokeLinejoin="round" />
          {/* Cúspide vestibular (izquierda — más alta y puntiaguda) */}
          {!fill && <>
            <line x1="23" y1="46" x2="26" y2="38" stroke="#C8B89E" strokeWidth={0.6} opacity={0.7} />
            <line x1="30" y1="44" x2="26" y2="38" stroke="#C8B89E" strokeWidth={0.6} opacity={0.7} />
            <line x1="30" y1="44" x2="34" y2="40" stroke="#C8B89E" strokeWidth={0.5} opacity={0.6} />
            <line x1="37" y1="46" x2="34" y2="40" stroke="#C8B89E" strokeWidth={0.5} opacity={0.6} />
          </>}
          {cervix}
          {/* Raíz: bifurcada (superior) o única (inferior) */}
          {jaw === "upper" ? (
            <g>
              {/* Tronco común corto */}
              <path
                d="M 20,48
                   L 20,58
                   Q 22,62 26,62
                   L 34,62
                   Q 38,62 40,58
                   L 40,48
                   Q 30,47 20,48 Z"
                fill={rootFill} stroke={stroke} strokeWidth={sw * 0.85} strokeLinejoin="round" />
              {/* Raíz vestibular */}
              <path
                d="M 20,60
                   C 17,72 18,88 22,94
                   Q 25,96 27,94
                   C 28,82 28,72 27,62
                   Q 23,60 20,60 Z"
                fill={rootFill} stroke={stroke} strokeWidth={sw * 0.85} strokeLinejoin="round" />
              {/* Raíz palatina */}
              <path
                d="M 33,62
                   C 32,72 32,82 33,94
                   Q 35,96 38,94
                   C 42,88 43,72 40,60
                   Q 37,60 33,62 Z"
                fill={rootFill} stroke={stroke} strokeWidth={sw * 0.85} strokeLinejoin="round" />
            </g>
          ) : (
            <path
              d="M 22,48
                 C 19,62 16,80 24,96
                 Q 27,99 30,99
                 Q 33,99 36,96
                 C 44,80 41,62 38,48
                 Q 36,47 30,47 Q 24,47 22,48 Z"
              fill={rootFill} stroke={stroke} strokeWidth={sw * 0.85} strokeLinejoin="round" />
          )}
          {!fill && <path d="M 20,12 L 26,18 L 30,12 L 34,18 L 40,12 L 35,32 L 25,32 Z" fill={`url(#shine-premolar)`} opacity="0.5" />}
        </g>
      );

    case "molar":
      return (
        <g opacity={opa}>
          {/* Corona: 4 cúspides — forma cuadrada ancha */}
          <path
            d="M 11,12
               C 11,22 13,32 14,44
               L 18,46
               L 21,40
               L 25,44
               L 30,42
               L 35,44
               L 39,40
               L 42,46
               L 46,44
               C 47,32 49,22 49,12
               Q 40,3 30,3
               Q 20,3 11,12 Z"
            fill={enamelFill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
          {/* Fosa central — surcos en Y característicos de molar */}
          <path d="M 18,46 L 25,44 L 30,42 L 35,44 L 42,46" fill="none" stroke={stroke} strokeWidth={sw * 0.7} opacity="0.8" strokeLinejoin="round" />
          {/* Surcos verticales que separan cúspides */}
          {!fill && <>
            <line x1="21" y1="40" x2="22" y2="14" stroke="#C8B89E" strokeWidth={0.5} opacity={0.6} />
            <line x1="30" y1="42" x2="30" y2="10" stroke="#C8B89E" strokeWidth={0.6} opacity={0.6} />
            <line x1="39" y1="40" x2="38" y2="14" stroke="#C8B89E" strokeWidth={0.5} opacity={0.6} />
          </>}
          {cervix}
          {/* Raíces: 3 (superior) o 2 (inferior) — todas con apex curvado */}
          {jaw === "upper" ? (
            <g>
              {/* Tronco radicular común corto */}
              <path d="M 14,48 L 14,58 Q 16,62 22,62 L 38,62 Q 44,62 46,58 L 46,48 Q 30,47 14,48 Z"
                fill={rootFill} stroke={stroke} strokeWidth={sw * 0.8} strokeLinejoin="round" />
              {/* Raíz mesio-vestibular */}
              <path
                d="M 14,60 C 11,72 12,86 16,92 Q 19,94 21,92 C 22,82 22,72 21,62 Q 17,60 14,60 Z"
                fill={rootFill} stroke={stroke} strokeWidth={sw * 0.8} strokeLinejoin="round" />
              {/* Raíz palatina (central) */}
              <path
                d="M 26,62 C 25,74 25,84 27,94 Q 30,96 33,94 C 35,84 35,74 34,62 Q 30,60 26,62 Z"
                fill={rootFill} stroke={stroke} strokeWidth={sw * 0.8} strokeLinejoin="round" />
              {/* Raíz disto-vestibular */}
              <path
                d="M 39,62 C 38,72 38,82 39,92 Q 41,94 44,92 C 48,86 49,72 46,60 Q 43,60 39,62 Z"
                fill={rootFill} stroke={stroke} strokeWidth={sw * 0.8} strokeLinejoin="round" />
            </g>
          ) : (
            <g>
              <path d="M 14,48 L 14,56 Q 18,60 24,60 L 36,60 Q 42,60 46,56 L 46,48 Q 30,47 14,48 Z"
                fill={rootFill} stroke={stroke} strokeWidth={sw * 0.8} strokeLinejoin="round" />
              {/* Raíz mesial */}
              <path
                d="M 16,58 C 13,70 12,86 19,94 Q 23,96 25,94 C 27,82 26,70 25,60 Q 20,58 16,58 Z"
                fill={rootFill} stroke={stroke} strokeWidth={sw * 0.8} strokeLinejoin="round" />
              {/* Raíz distal */}
              <path
                d="M 35,60 C 34,70 33,82 35,94 Q 37,96 41,94 C 48,86 47,70 44,58 Q 40,58 35,60 Z"
                fill={rootFill} stroke={stroke} strokeWidth={sw * 0.8} strokeLinejoin="round" />
            </g>
          )}
          {!fill && <path d="M 14,14 L 22,20 L 30,12 L 38,20 L 46,14 L 40,34 L 20,34 Z" fill={`url(#shine-molar)`} opacity="0.45" />}
        </g>
      );
  }
}
