"use client";

import { useRef, type KeyboardEvent } from "react";
import { cx } from "@/lib/cx";

/**
 * Pestañas accesibles (MOL-46).
 *
 * Las del panel eran botones sin rol: un lector de pantalla no sabía cuál
 * estaba elegida y el teclado tenía que pasar por las once con Tab. Estas son
 * un tablist de verdad: aria-selected en la activa, y flechas / Inicio / Fin
 * para moverse (solo la activa entra en el orden de Tab).
 *
 * Controladas: el estado vive en quien las usa (value + onChange).
 */
export interface TabItem {
  id: string;
  label: string;
  /** Número pequeño al lado (p. ej. solicitudes por confirmar). */
  badge?: number;
}

export function Tabs({ items, value, onChange, label, className }: {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  /** Nombre del grupo para lectores de pantalla, p. ej. "Secciones del panel". */
  label: string;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function mover(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const ultimo = items.length - 1;
    const destino =
      e.key === "ArrowRight" ? (i === ultimo ? 0 : i + 1) :
      e.key === "ArrowLeft"  ? (i === 0 ? ultimo : i - 1) :
      e.key === "Home" ? 0 :
      e.key === "End" ? ultimo : null;
    if (destino === null) return;
    e.preventDefault();
    onChange(items[destino].id);
    refs.current[destino]?.focus();
  }

  return (
    <div role="tablist" aria-label={label}
      className={cx("flex gap-1 overflow-x-auto border-b border-line", className)}>
      {items.map((t, i) => {
        const activa = t.id === value;
        return (
          <button
            key={t.id}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="tab"
            aria-selected={activa}
            tabIndex={activa ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => mover(e, i)}
            className={cx(
              "inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-semibold whitespace-nowrap transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand",
              activa ? "border-brand text-brand-strong" : "border-transparent text-ink-muted hover:text-brand",
            )}
          >
            {t.label}
            {t.badge ? (
              <span className="rounded-full bg-accent-soft px-2 text-xs font-bold text-accent-ink">{t.badge}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
