"use client";

import { useId } from "react";
import { cx } from "@/lib/cx";

/**
 * Interruptor de prendido/apagado con su etiqueta.
 *
 * Los de configuración eran divs con onClick: el teclado no llegaba y el
 * lector de pantalla no sabía si estaban prendidos. Este es un role="switch"
 * de verdad, y se toca toda la fila (44px como mínimo), no solo la perilla.
 */
export function Interruptor({ checked, onChange, label, description, disabled, className }: {
  checked: boolean;
  onChange: (valor: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled}
      aria-labelledby={`${id}-l`} aria-describedby={description ? `${id}-d` : undefined}
      onClick={() => onChange(!checked)}
      className={cx(
        "flex min-h-11 w-full items-center justify-between gap-4 rounded-control px-3 py-2.5 text-left transition-colors",
        "focus-visible:outline-2 focus-visible:outline-brand disabled:cursor-default",
        !disabled && "hover:bg-ground",
        className,
      )}>
      <span className="min-w-0">
        <span id={`${id}-l`} className="block text-sm font-semibold text-ink">{label}</span>
        {description && <span id={`${id}-d`} className="block text-[13px] text-ink-muted">{description}</span>}
      </span>
      <span aria-hidden className={cx("relative h-6 w-10 shrink-0 rounded-full transition-colors", checked ? "bg-brand" : "bg-ink-muted/45")}>
        <span className={cx("absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform", checked ? "translate-x-5" : "translate-x-1")} />
      </span>
    </button>
  );
}
