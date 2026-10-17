import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

/**
 * Etiqueta de estado (MOL-46): "Confirmada", "Por confirmar", "Cancelada"…
 *
 * El tono dice el significado, no el color: accent es lo que espera una
 * respuesta, ok lo que salió bien, danger lo que falló. Todos cumplen 4,5:1.
 * El estado nunca va solo en el color: el texto lo dice.
 */
export type TonoBadge = "neutral" | "brand" | "accent" | "ok" | "warn" | "danger";

const TONOS: Record<TonoBadge, string> = {
  neutral: "bg-gray-100 text-ink-muted",
  brand:   "bg-brand-soft text-brand-ink",
  accent:  "bg-accent-soft text-accent-ink",
  ok:      "bg-ok-soft text-ok",
  warn:    "bg-warn-soft text-warn",
  danger:  "bg-danger-soft text-danger",
};

export function Badge({ tone = "neutral", children, className }: {
  tone?: TonoBadge; children: ReactNode; className?: string;
}) {
  return (
    <span className={cx(
      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap",
      TONOS[tone], className,
    )}>
      {children}
    </span>
  );
}
