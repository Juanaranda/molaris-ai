import type { ReactNode } from "react";
import { MOMENTOS } from "@/lib/landing";
import { Aparece } from "./Aparece";
import s from "./landing.module.css";

/**
 * Todo lo que trae molari, ordenado por momento de la atención: antes de la
 * cita, en el box y después. Para leer de una pasada, sin buscador ni clics.
 */
export function LoQueTrae({ foto }: { foto?: ReactNode }) {
  return (
    <section id="funciones" className={s.seccion} aria-labelledby="t-funciones">
      <div className={s.trae}>
        {foto && <div className={s.fotoLateral}>{foto}</div>}
        <div>
          <h2 id="t-funciones" className={s.h2}>Todo lo que trae</h2>
          <p className={s.intro}>Lo de antes, durante y después de cada cita, en un solo lugar.</p>
          {MOMENTOS.map((m, i) => (
            <Aparece key={m.momento} retraso={i * 80} className={s.momento}>
              <h3>{m.momento}</h3>
              <ul>
                {m.funciones.map((f) => (
                  <li key={f.nombre}><b>{f.nombre}</b>{f.detalle}</li>
                ))}
              </ul>
            </Aparece>
          ))}
        </div>
      </div>
    </section>
  );
}
