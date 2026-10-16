"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, Ellipsis, House, MessageSquare, Users, X } from "lucide-react";
import type { Tab } from "./types";
import { repartirParaCelular, type Seccion } from "@/lib/navegacion";
import { cx } from "@/lib/cx";

/**
 * Barra inferior del panel en el celular (MOL-46).
 *
 * Reemplaza, solo bajo 640px, la fila de once pestañas que había que deslizar
 * de lado. Cuatro secciones de todos los días + "Más", que abre una hoja con
 * el resto. Respeta la zona segura del iPhone (la barrita de inicio), que en
 * la PWA instalada queda justo debajo.
 */
const ICONOS: Partial<Record<Tab, typeof House>> = {
  inicio: House, agenda: CalendarDays, patients: Users, conversaciones: MessageSquare,
};

export function NavCelular({ secciones, activa, onChange }: {
  secciones: Seccion[];
  activa: Tab;
  onChange: (t: Tab) => void;
}) {
  const { barra, mas } = repartirParaCelular(secciones);
  const [abierta, setAbierta] = useState(false);
  const botonMas = useRef<HTMLButtonElement>(null);
  const primeraOpcion = useRef<HTMLButtonElement>(null);
  const activaEnMas = mas.some((s) => s.id === activa);

  useEffect(() => {
    if (!abierta) return;
    primeraOpcion.current?.focus();
    const alTeclado = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setAbierta(false);
      botonMas.current?.focus();
    };
    window.addEventListener("keydown", alTeclado);
    return () => window.removeEventListener("keydown", alTeclado);
  }, [abierta]);

  function cerrar() {
    setAbierta(false);
    botonMas.current?.focus();
  }

  function elegir(t: Tab) {
    onChange(t);
    setAbierta(false);
  }

  return (
    <>
      {abierta && (
        <div className="fixed inset-0 z-40 sm:hidden">
          <button type="button" aria-label="Cerrar" tabIndex={-1} onClick={cerrar}
            className="absolute inset-0 bg-ink/40" />
          <div role="dialog" aria-modal="true" aria-labelledby="nav-mas-titulo"
            className="absolute inset-x-0 bottom-0 rounded-t-card bg-surface px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-xl">
            <div className="mb-2 flex items-center justify-between">
              <h2 id="nav-mas-titulo" className="text-base font-bold text-brand-strong">Más secciones</h2>
              <button type="button" aria-label="Cerrar" onClick={cerrar}
                className="inline-flex h-11 w-11 items-center justify-center rounded-control text-ink-muted hover:bg-gray-100">
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <ul className="flex flex-col">
              {mas.map((s, i) => (
                <li key={s.id}>
                  <button type="button" ref={i === 0 ? primeraOpcion : undefined}
                    aria-current={s.id === activa ? "page" : undefined}
                    onClick={() => elegir(s.id)}
                    className={cx(
                      "flex min-h-12 w-full items-center rounded-control px-3 text-left text-[15px] font-semibold",
                      s.id === activa ? "bg-brand-soft text-brand-strong" : "text-ink hover:bg-gray-100",
                    )}>
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <nav aria-label="Secciones del panel"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface px-1 pt-1 pb-[env(safe-area-inset-bottom)] sm:hidden">
        {barra.map((s) => {
          const Icono = ICONOS[s.id] ?? House;
          const esActiva = s.id === activa;
          return (
            <button key={s.id} type="button" onClick={() => onChange(s.id)}
              aria-current={esActiva ? "page" : undefined}
              className={cx(
                "flex min-h-14 flex-col items-center justify-center gap-1 text-[11px]",
                esActiva ? "font-bold text-brand-strong" : "font-semibold text-ink-muted",
              )}>
              <Icono className="h-[22px] w-[22px]" aria-hidden strokeWidth={esActiva ? 2.4 : 2} />
              {s.corto ?? s.label}
            </button>
          );
        })}
        <button ref={botonMas} type="button" onClick={() => setAbierta(true)}
          aria-haspopup="dialog" aria-expanded={abierta}
          aria-current={activaEnMas ? "page" : undefined}
          className={cx(
            "flex min-h-14 flex-col items-center justify-center gap-1 text-[11px]",
            activaEnMas ? "font-bold text-brand-strong" : "font-semibold text-ink-muted",
          )}>
          <Ellipsis className="h-[22px] w-[22px]" aria-hidden />
          Más
        </button>
      </nav>
    </>
  );
}
