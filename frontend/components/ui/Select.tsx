"use client";

import type { SelectHTMLAttributes } from "react";
import { useId } from "react";
import { cx } from "@/lib/cx";

/**
 * Las clases de un campo o desplegable del panel: las mismas de Field (borde
 * cálido, 44px de alto, texto de 16px para que el iPhone no haga zoom).
 * Exportadas para controles sueltos que no llevan etiqueta visible (filtros).
 */
export const CLASE_CAMPO =
  "w-full min-h-11 rounded-control border border-line bg-surface px-3 text-base text-ink " +
  "focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand";

export const CLASE_ETIQUETA = "text-sm font-semibold text-ink";

/** Desplegable con su etiqueta enlazada (tocarla lo enfoca), como Field. */
export function Select({ label, className, id: idPropio, children, ...rest }:
  SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const auto = useId();
  const id = idPropio ?? auto;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={CLASE_ETIQUETA}>{label}</label>
      <select id={id} {...rest} className={cx(CLASE_CAMPO, className)}>{children}</select>
    </div>
  );
}
