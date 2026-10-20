"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { RECORRIDO, type Paso } from "@/lib/landing";
import { cx } from "@/lib/cx";
import { CuentaPaciente, DiaAgenda, FichaOdontograma, Solicitud } from "./fragmentos";
import s from "./landing.module.css";

const PANEL: Record<Paso["id"], ReactNode> = {
  conversa: <Solicitud />,
  agenda: <DiaAgenda />,
  ficha: <FichaOdontograma />,
  pago: <CuentaPaciente />,
};

/**
 * Un paciente de principio a fin. En escritorio el panel queda fijo y cambia
 * a medida que pasan las frases; en el celular cada frase lleva su panel
 * debajo, sin nada fijo encima del texto.
 */
export function Recorrido() {
  const [activo, setActivo] = useState<Paso["id"]>(RECORRIDO[0].id);
  const frases = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    // La frase que cruza el centro de la pantalla es la activa.
    const io = new IntersectionObserver((entradas) => {
      for (const e of entradas) {
        if (e.isIntersecting) setActivo((e.target as HTMLElement).dataset.paso as Paso["id"]);
      }
    }, { rootMargin: "-45% 0px -45% 0px" });
    frases.current.forEach((f) => f && io.observe(f));
    return () => io.disconnect();
  }, []);

  return (
    <section id="recorrido" className={cx(s.seccion, s.blanco)} aria-labelledby="t-recorrido">
      <div className={s.recorrido}>
        <div>
          <h2 id="t-recorrido" className={s.h2}>Un paciente, de principio a fin</h2>
          {RECORRIDO.map((p, i) => (
            <div
              key={p.id}
              ref={(el) => { frases.current[i] = el; }}
              data-paso={p.id}
              className={cx(s.frase, i === 0 && s.frasePrimera, activo === p.id && s.fraseActiva)}
            >
              <h3>{p.titulo}</h3>
              <p>{p.texto}</p>
              <div className={s.copia} aria-hidden>{PANEL[p.id]}</div>
            </div>
          ))}
        </div>
        <div className={s.escena} aria-hidden>
          {RECORRIDO.map((p) => (
            <div key={p.id} className={cx(s.estadoPanel, activo === p.id && s.estadoVisible)}>{PANEL[p.id]}</div>
          ))}
        </div>
      </div>
    </section>
  );
}
