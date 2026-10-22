"use client";

import { useEffect, useRef, useState } from "react";
import { AVISO_IA, GUIONES, type LineaChat } from "@/lib/landing";
import { cx } from "@/lib/cx";
import { Burbuja, CabeceraChat } from "./fragmentos";
import s from "./landing.module.css";

/**
 * El chat del hero: el visitante elige qué escribe el paciente y ve cómo
 * responde molari. Son conversaciones de ejemplo fijas, no la IA real (esa es
 * el chat de Juan, más abajo): así no gasta tokens ni depende del backend.
 *
 * Al cargar se ve la primera conversación completa, sin esperar a JavaScript.
 */
export function ChatEnVivo() {
  const [activo, setActivo] = useState(GUIONES[0].id);
  const [lineas, setLineas] = useState<LineaChat[]>(GUIONES[0].lineas);
  const [escribiendo, setEscribiendo] = useState(false);
  const relojes = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => relojes.current.forEach(clearTimeout), []);

  function reproducir(id: string) {
    const guion = GUIONES.find((g) => g.id === id);
    if (!guion) return;
    relojes.current.forEach(clearTimeout);
    relojes.current = [];
    setActivo(id);

    // Con movimiento reducido, la conversación aparece entera.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setLineas(guion.lineas);
      setEscribiendo(false);
      return;
    }

    setLineas([]);
    let t = 200;
    guion.lineas.forEach((linea, i) => {
      if (linea.quien === "molari") {
        relojes.current.push(setTimeout(() => setEscribiendo(true), t));
        t += 900;
      }
      relojes.current.push(setTimeout(() => {
        setEscribiendo(false);
        setLineas(guion.lineas.slice(0, i + 1));
      }, t));
      t += 500;
    });
  }

  return (
    <div className={s.marco} data-ui>
      <div className={s.wa} aria-live="polite">
        <CabeceraChat />
        <p className={cx(s.burbuja, s.aviso)}>{AVISO_IA}</p>
        {lineas.map((l, i) => <Burbuja key={`${activo}-${i}`} linea={l} />)}
        {escribiendo && <p className={s.escribiendo}>escribiendo…</p>}
      </div>
      <div className={s.ejemplos} role="group" aria-label="Escribe como paciente">
        {GUIONES.map((g) => (
          <button key={g.id} type="button" aria-pressed={activo === g.id} onClick={() => reproducir(g.id)}>
            {g.boton}
          </button>
        ))}
      </div>
    </div>
  );
}
