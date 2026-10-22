"use client";

import { useState, type ReactNode } from "react";
import { PREGUNTAS } from "@/lib/landing";
import { cx } from "@/lib/cx";
import s from "./landing.module.css";

/**
 * Preguntas a la izquierda y una sola respuesta, grande, a la derecha. En el
 * celular la respuesta se abre bajo su pregunta.
 */
export function Preguntas({ foto }: { foto?: ReactNode }) {
  const [abierta, setAbierta] = useState(0);
  const actual = PREGUNTAS[abierta];

  return (
    <section id="preguntas" className={cx(s.seccion, s.blanco)} aria-labelledby="t-preguntas">
      <div className={s.preguntas}>
        <div>
          <h2 id="t-preguntas" className={s.h2}>Preguntas frecuentes</h2>
          <ul className={s.indice}>
            {PREGUNTAS.map((p, i) => (
              <li key={p.pregunta}>
                <button
                  type="button"
                  aria-expanded={abierta === i}
                  aria-controls="respuesta-actual"
                  onClick={() => setAbierta(i)}
                  onMouseEnter={() => setAbierta(i)}
                  onFocus={() => setAbierta(i)}
                >
                  {p.pregunta}
                </button>
                {abierta === i && <p className={s.respuestaEnLinea}>{p.respuesta}</p>}
              </li>
            ))}
          </ul>
        </div>
        <div className={s.ladoRespuesta}>
          <p id="respuesta-actual" className={s.respuesta} aria-live="polite">{actual.respuesta}</p>
          {foto}
        </div>
      </div>
    </section>
  );
}
