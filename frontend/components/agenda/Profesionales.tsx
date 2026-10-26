import { cx } from "@/lib/cx";
import { nombreCorto } from "@/lib/agendaVista";

const iniciales = (n: string) =>
  n.replace(/^Dra?\.\s*/, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

/**
 * Filtro por profesional (opción A). Reemplaza las píldoras de colores: cada
 * profesional se reconoce por su nombre e iniciales, sin un color propio que
 * compita con el coral de lo que espera respuesta. En el celular es una fila
 * de chips que se desliza.
 */
export function Profesionales({ variante, soloCelular = true, nombres, conteo, filtro, onFiltro, etiquetaConteo }: {
  /** "lista": tarjeta de la columna derecha (escritorio). "chips": fila deslizable (celular y tablet). */
  variante: "lista" | "chips";
  /** Chips: false los muestra también en escritorio (vista semana, sin columna derecha). */
  soloCelular?: boolean;
  nombres: string[];
  /** Citas activas de cada profesional en lo que se está viendo; null = todas. */
  conteo: (nombre: string | null) => number;
  filtro: string | null;
  onFiltro: (nombre: string | null) => void;
  /** "hoy", "este día" o "esta semana". */
  etiquetaConteo: string;
}) {
  if (nombres.length === 0) return null;
  const opciones: (string | null)[] = [null, ...nombres];
  const fila = (n: string | null) => {
    const activo = filtro === n;
    return (
      <button key={n ?? "todos"} type="button" aria-pressed={activo} onClick={() => onFiltro(activo ? null : n)}
        className={cx(
          "grid w-full min-h-12 grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 rounded-control px-3 py-1.5 text-left transition-colors",
          "focus-visible:outline-2 focus-visible:outline-brand",
          activo ? "bg-brand-soft" : "hover:bg-ground",
        )}>
        <span className={cx("grid h-8 w-8 place-items-center rounded-full text-xs font-bold", activo ? "bg-surface text-brand-ink" : "bg-gray-100 text-ink")}>
          {n ? iniciales(n) : "·"}
        </span>
        <span className={cx("truncate text-sm font-semibold", activo ? "text-brand-ink" : "text-ink")}>{n ?? "Todos"}</span>
        <span className="text-[13px] text-ink-muted tabular-nums">{conteo(n)}</span>
      </button>
    );
  };

  if (variante === "lista") return (
      <section aria-labelledby="profesionales" className="hidden rounded-card border border-line bg-surface lg:block">
        <div className="flex items-baseline justify-between px-5 pt-4 pb-2">
          <h3 id="profesionales" className="text-base font-bold text-brand-strong">Profesionales</h3>
          <span className="text-xs text-ink-muted">citas {etiquetaConteo}</span>
        </div>
        <div className="flex flex-col px-2 pb-2">{opciones.map(fila)}</div>
      </section>
  );

  return (

      <div role="group" aria-label="Ver solo un profesional"
        className={cx("-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 sm:-mx-8 sm:px-8", soloCelular && "lg:hidden")} style={{ scrollbarWidth: "none" }}>
        {opciones.map((n) => {
          const activo = filtro === n;
          return (
            <button key={n ?? "todos"} type="button" aria-pressed={activo} onClick={() => onFiltro(activo ? null : n)}
              className={cx(
                "flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-colors",
                "focus-visible:outline-2 focus-visible:outline-brand",
                activo ? "border-brand bg-brand-soft text-brand-ink" : "border-line bg-surface text-ink",
              )}>
              {n ? nombreCorto(n) : "Todos"}
              <span className="text-[13px] font-medium text-ink-muted tabular-nums">{conteo(n)}</span>
            </button>
          );
        })}
      </div>
  );
}
