"use client";

import { cx } from "@/lib/cx";
import { PAIS_POR_DEFECTO, digitosLocales, formatearLocal, telefonoCompleto } from "@/lib/telefono";

/**
 * Campo de teléfono con el +56 fijo y la bandera de Chile (ver lib/telefono).
 *
 * Recibe y devuelve el número completo (+56912345678). La bandera está
 * dibujada y no es un emoji: en Windows el emoji de bandera se ve como "CL".
 */
export function BanderaChile({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 16" className={cx("h-4 w-6 shrink-0 rounded-[2px]", className)} aria-hidden>
      <rect width="24" height="16" fill="#fff" />
      <rect y="8" width="24" height="8" fill="#D52B1E" />
      <rect width="8" height="8" fill="#0039A6" />
      <path d="M4 2.1l.68 2.08h2.19L5.1 5.47l.68 2.08L4 6.26 2.22 7.55l.68-2.08L1.13 4.18h2.19z" fill="#fff" />
      <rect width="24" height="16" fill="none" stroke="rgba(12,27,38,.15)" />
    </svg>
  );
}

export function CampoTelefono({
  id, value, onChange, placeholder = "9 1234 5678", className, autoFocus, required, invalido, describedBy, readOnly,
}: {
  id?: string;
  /** El número completo guardado (+56…), o vacío. */
  value: string;
  onChange: (completo: string) => void;
  placeholder?: string;
  /** Clases del contenedor, para calzar con el formulario donde va. */
  className?: string;
  autoFocus?: boolean;
  required?: boolean;
  invalido?: boolean;
  describedBy?: string;
  readOnly?: boolean;
}) {
  const pais = PAIS_POR_DEFECTO;
  return (
    <div
      className={cx(
        "flex items-stretch overflow-hidden rounded-control border bg-surface",
        "focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/30",
        invalido ? "border-danger" : "border-line",
        className,
      )}
    >
      <span className="flex items-center gap-2 border-r border-line bg-ground px-3 text-base font-semibold text-ink select-none" aria-hidden>
        <BanderaChile />+{pais.prefijo}
      </span>
      <input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        autoFocus={autoFocus}
        required={required}
        aria-invalid={invalido || undefined}
        aria-describedby={describedBy}
        readOnly={readOnly}
        aria-label={id ? undefined : `Teléfono (${pais.nombre}, +${pais.prefijo})`}
        placeholder={placeholder}
        value={formatearLocal(digitosLocales(value, pais))}
        onChange={(e) => onChange(telefonoCompleto(e.target.value, pais))}
        className={cx("min-h-11 min-w-0 flex-1 bg-transparent px-3 text-base text-ink placeholder:text-ink-muted/70 focus:outline-none", readOnly && "text-ink-muted")}
      />
    </div>
  );
}
