import type { ButtonHTMLAttributes } from "react";
import { cx } from "@/lib/cx";

/**
 * El botón del panel (MOL-46). Antes cada pantalla armaba el suyo con colores
 * y alturas distintas; este es el único que debería usarse de acá en adelante.
 *
 * - primary: la acción principal de la pantalla (una sola por vista).
 * - secondary: acciones al lado de la principal.
 * - ghost: acciones de bajo peso dentro de una lista o tarjeta.
 * - danger: borrar, desactivar, rechazar.
 *
 * Alto mínimo 44px: área de toque cómoda en el celular. `sm` (36px) es solo
 * para escritorio, en barras densas.
 */
type Variante = "primary" | "secondary" | "ghost" | "danger";
type Tamano = "md" | "sm";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variante;
  size?: Tamano;
  /** Deshabilita el botón y avisa a lectores de pantalla que está ocupado. */
  loading?: boolean;
  /** Ocupa todo el ancho disponible (útil en el celular). */
  block?: boolean;
}

const VARIANTES: Record<Variante, string> = {
  primary:   "bg-brand text-white hover:bg-brand-strong",
  secondary: "bg-surface text-brand-strong border border-line hover:border-brand hover:text-brand",
  ghost:     "bg-transparent text-brand hover:bg-brand-soft",
  danger:    "bg-danger text-white hover:brightness-90",
};

const TAMANOS: Record<Tamano, string> = {
  md: "min-h-11 px-4 text-sm",
  sm: "min-h-9 px-3 text-[13px]",
};

export function Button({
  variant = "primary", size = "md", loading = false, block = false,
  disabled, type = "button", className, children, ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-control font-semibold transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        "disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTES[variant], TAMANOS[size], block && "w-full", className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
