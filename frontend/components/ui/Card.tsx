"use client";

import type { ReactNode } from "react";
import { useId } from "react";
import { cx } from "@/lib/cx";

/**
 * Tarjeta del panel (MOL-46): fondo blanco, borde cálido, radio de tarjeta.
 *
 * Con `title` se vuelve una sección con nombre: el título queda enlazado por
 * aria-labelledby, así un lector de pantalla anuncia "Agenda de hoy, región"
 * en vez de un bloque sin nombre. `action` va a la derecha del título
 * ("Ver todo", un botón).
 */
export function Card({
  title, action, headingLevel = 2, padded = true, className, children,
}: {
  title?: ReactNode;
  action?: ReactNode;
  headingLevel?: 2 | 3;
  /** false para listas que llegan al borde (filas con su propio padding). */
  padded?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  const Titulo = headingLevel === 3 ? "h3" : "h2";
  const contenido = (
    <>
      {title && (
        <div className={cx("flex items-center justify-between gap-3", padded ? "mb-3" : "px-5 pt-4 pb-3")}>
          <Titulo id={id} className="text-base font-bold text-brand-strong">{title}</Titulo>
          {action}
        </div>
      )}
      {children}
    </>
  );
  const clases = cx("bg-surface border border-line rounded-card", padded && "p-5", className);
  return title
    ? <section aria-labelledby={id} className={clases}>{contenido}</section>
    : <div className={clases}>{contenido}</div>;
}
