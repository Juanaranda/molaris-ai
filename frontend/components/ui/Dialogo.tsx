"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cx } from "@/lib/cx";

// Diálogos abiertos, el último arriba. Escape cierra solo el de más arriba:
// con el plan abierto sobre el paciente, cerraba los dos.
const abiertos: symbol[] = [];

/**
 * Lo mínimo de un diálogo: Escape lo cierra y el foco entra al abrirlo
 * (si no, el teclado y el lector de pantalla quedan en la pantalla de atrás).
 */
export function useDialogo(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const cerrar = useRef(onClose);
  useEffect(() => { cerrar.current = onClose; });
  useEffect(() => {
    const yo = Symbol("dialogo");
    abiertos.push(yo);
    // Si un campo de adentro ya tomó el foco (autoFocus), se respeta.
    if (!ref.current?.contains(document.activeElement)) ref.current?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (abiertos[abiertos.length - 1] !== yo) return;
      // Si el Escape es para cerrar una lista desplegada (el buscador de
      // pacientes), se queda en eso y no cierra el diálogo entero.
      if (e.key !== "Escape" || (e.target as HTMLElement | null)?.getAttribute?.("aria-expanded") === "true") return;
      cerrar.current();
    };
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("keydown", tecla);
      abiertos.splice(abiertos.indexOf(yo), 1);
    };
  }, []);
  return ref;
}

export function BotonCerrar({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label="Cerrar"
      className={cx("grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:bg-gray-100 hover:text-ink focus-visible:outline-2 focus-visible:outline-brand", className)}>
      <X className="h-5 w-5" aria-hidden />
    </button>
  );
}

const ANCHOS = { sm: "sm:max-w-sm", md: "sm:max-w-md", lg: "sm:max-w-lg", xl: "sm:max-w-2xl" };

/**
 * Diálogo del panel. En el celular sube desde abajo a todo el ancho (el pulgar
 * llega al borde inferior); en escritorio va centrado. Sin vidrio ni desenfoque:
 * un velo de tinta sobre la pantalla de atrás.
 *
 * `capa` es el z-index: un diálogo abierto desde otro va una capa más arriba.
 */
export function Dialogo({ titulo, subtitulo, onClose, ancho = "md", capa = 60, children }: {
  titulo: ReactNode;
  subtitulo?: ReactNode;
  onClose: () => void;
  ancho?: keyof typeof ANCHOS;
  capa?: number;
  children: ReactNode;
}) {
  const ref = useDialogo(onClose);
  const id = useId();
  return (
    <div className="fixed inset-0 flex items-end justify-center bg-ink/40 sm:items-center sm:p-4" style={{ zIndex: capa }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={`${id}-t`}
        className={cx("flex max-h-[92vh] w-full flex-col rounded-t-card bg-surface shadow-2xl outline-none sm:max-h-[90vh] sm:rounded-card", ANCHOS[ancho])}>
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line py-2 pr-2 pl-5">
          <div className="min-w-0 py-1.5">
            <h2 id={`${id}-t`} className="text-lg font-bold text-brand-strong">{titulo}</h2>
            {subtitulo && <p className="text-[13px] text-ink-muted">{subtitulo}</p>}
          </div>
          <BotonCerrar onClick={onClose} />
        </div>
        <div className="overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  );
}
