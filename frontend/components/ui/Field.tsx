"use client";

import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { useId } from "react";
import { cx } from "@/lib/cx";

/**
 * Campo de formulario con su etiqueta, ayuda y error (MOL-46).
 *
 * Lo que resuelve: en varios formularios la etiqueta no estaba enlazada al
 * campo (tocarla no lo enfocaba) y los errores eran un texto rojo suelto que
 * el lector de pantalla no asociaba. Acá la etiqueta usa htmlFor, y la ayuda y
 * el error quedan en aria-describedby; con error, aria-invalid.
 *
 * Texto de 16px en el campo: con menos, el iPhone hace zoom al enfocarlo.
 */
interface Comunes {
  label: string;
  hint?: string;
  error?: string;
}

type FieldProps =
  | (Comunes & { multiline?: false } & InputHTMLAttributes<HTMLInputElement>)
  | (Comunes & { multiline: true } & TextareaHTMLAttributes<HTMLTextAreaElement>);

const CAMPO =
  "w-full rounded-control border bg-surface px-3 py-2.5 text-base text-ink placeholder:text-ink-muted/70 " +
  "focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand disabled:bg-gray-100 disabled:text-ink-muted";

export function Field(props: FieldProps) {
  const { label, hint, error, className, id: idPropio, multiline, ...rest } = props;
  const auto = useId();
  const id = idPropio ?? auto;
  const idHint = hint ? `${id}-ayuda` : undefined;
  const idError = error ? `${id}-error` : undefined;
  const describedBy = [idHint, idError].filter(Boolean).join(" ") || undefined;
  const clases = cx(CAMPO, error ? "border-danger" : "border-line", className);
  const aria = { id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined };

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-ink">{label}</label>
      {multiline
        ? <textarea {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)} {...aria} className={cx(clases, "min-h-24")} />
        : <input {...(rest as InputHTMLAttributes<HTMLInputElement>)} {...aria} className={cx(clases, "min-h-11")} />}
      {hint && <p id={idHint} className="text-[13px] text-ink-muted">{hint}</p>}
      {error && <p id={idError} className="text-[13px] font-semibold text-danger">{error}</p>}
    </div>
  );
}
