"use client";

import { useState } from "react";
import { CLINICA_EJEMPLO } from "@/lib/landing";
import s from "./landing.module.css";

/**
 * El primer paso del registro, ya abierto. Quien atiende solo escribe su
 * nombre, no el de una clínica; el valor viaja al registro (?clinica= o
 * ?nombre=) para no pedirlo dos veces. Sin JavaScript igual funciona: manda
 * el nombre de la clínica.
 */
export function CierreRegistro() {
  const [solo, setSolo] = useState(false);

  return (
    <form className={s.dialogo} action="/register" method="get" data-ui>
      <h3>Regístrate</h3>
      <fieldset className={s.segmento}>
        <legend className="sr-only">Cómo trabajas</legend>
        <label><input type="radio" name="tipo" value="clinica" checked={!solo} onChange={() => setSolo(false)} /><span>Clínica o equipo</span></label>
        <label><input type="radio" name="tipo" value="solo" checked={solo} onChange={() => setSolo(true)} /><span>Atiendo solo</span></label>
      </fieldset>
      <label htmlFor="cierre-nombre">{solo ? "Tu nombre" : "Nombre de tu clínica"}</label>
      <input
        key={solo ? "nombre" : "clinica"}
        id="cierre-nombre"
        name={solo ? "nombre" : "clinica"}
        type="text"
        autoComplete={solo ? "name" : "organization"}
        placeholder={solo ? "Camila Soto" : CLINICA_EJEMPLO}
        maxLength={80}
      />
      <button className={s.boton} type="submit">Seguir con el registro</button>
    </form>
  );
}
