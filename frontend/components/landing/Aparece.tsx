"use client";

import { useEffect, useRef, type ReactNode } from "react";
import s from "./landing.module.css";

/**
 * Entrada suave de un bloque cuando llega a la pantalla.
 *
 * Al revés de la animación anterior: el contenido parte VISIBLE. Solo se esconde
 * después de montar, si está bajo la primera pantalla y el sistema no pide
 * menos movimiento. Así, sin JavaScript o con movimiento reducido, todo se lee.
 */
export function Aparece({ children, retraso = 0, className, ui = false }: {
  children: ReactNode;
  retraso?: number;
  className?: string;
  /** Envuelve un trozo del producto: marca `data-ui` (valen sus convenciones). */
  ui?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return;

    el.classList.add(s.espera);
    let reloj: ReturnType<typeof setTimeout>;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      reloj = setTimeout(() => { el.classList.add(s.visto); el.classList.remove(s.espera); }, retraso);
      io.disconnect();
    }, { rootMargin: "0px 0px -10% 0px" });
    io.observe(el);
    return () => { io.disconnect(); clearTimeout(reloj); };
  }, [retraso]);

  return <div ref={ref} className={className} data-ui={ui || undefined}>{children}</div>;
}
