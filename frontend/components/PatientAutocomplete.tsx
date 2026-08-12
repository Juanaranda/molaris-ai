"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  fetchPatients,
  buscarPacientes,
  haceCuanto,
  normalizar,
  type PatientSuggestion,
} from "@/lib/patients";

/**
 * Campo de nombre con sugerencias de pacientes ya registrados (pedido de Juan:
 * no tener que tipear de cero a alguien que ya viene hace años).
 *
 * Elegir a un paciente rellena RUT, teléfono y correo de una. Queda marcado
 * como "ya registrado" para que se note que esos datos vienen de la ficha y no
 * los escribió alguien a mano — si no, no hay forma de saber si el RUT que
 * aparece es el de verdad.
 */

interface Props {
  value: string;
  onChange: (nombre: string) => void;
  /** Al elegir de la lista: rellena el resto del formulario. */
  onSelect: (p: PatientSuggestion) => void;
  /** Al soltar el paciente elegido: los datos autocompletados dejan de ser confiables. */
  onClear: () => void;
  seleccionado: boolean;
  /** La agenda del dashboard usa Tailwind; la página /partners/agenda usa estilos inline (MUI). */
  inputClassName?: string;
  inputStyle?: React.CSSProperties;
  autoFocus?: boolean;
}

export function PatientAutocomplete({
  value, onChange, onSelect, onClear, seleccionado, inputClassName, inputStyle, autoFocus,
}: Props) {
  const [pacientes, setPacientes] = useState<PatientSuggestion[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const [cargando, setCargando] = useState(true);
  const contenedor = useRef<HTMLDivElement>(null);
  const listaRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Posición del desplegable en coordenadas de viewport. Va en un portal con
  // position:fixed porque cualquier ancestro con scroll u overflow lo recorta —
  // dentro del modal de "Nueva cita" la lista quedaba cortada por el borde.
  const [caja, setCaja] = useState<{ left: number; top: number; width: number; arriba: boolean } | null>(null);

  useEffect(() => {
    let cancelado = false;
    fetchPatients()
      .then((p) => { if (!cancelado) setPacientes(p); })
      .catch(() => { /* sin sugerencias se escribe a mano, que es lo de antes */ })
      .finally(() => { if (!cancelado) setCargando(false); });
    return () => { cancelado = true; };
  }, []);

  // Cerrar al tocar fuera. En móvil es la forma natural de descartar la lista.
  useEffect(() => {
    if (!abierto) return;
    function fuera(e: MouseEvent | TouchEvent) {
      if (contenedor.current && !contenedor.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", fuera);
    document.addEventListener("touchstart", fuera);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("touchstart", fuera);
    };
  }, [abierto]);

  const sugerencias = seleccionado ? [] : buscarPacientes(pacientes, value);
  const mostrar = abierto && sugerencias.length > 0;
  const listaId = useId();

  const ubicar = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const alto = Math.min(256, sugerencias.length * 52 + 8);
    // Si abajo no cabe pero arriba sí, se abre hacia arriba: en móvil el
    // teclado se come la mitad inferior de la pantalla.
    const arriba = r.bottom + alto > window.innerHeight && r.top > alto;
    setCaja({
      left: r.left,
      top: arriba ? r.top - alto - 6 : r.bottom + 6,
      width: r.width,
      arriba,
    });
  }, [sugerencias.length]);

  useLayoutEffect(() => {
    // Al cerrarse no hace falta limpiar la posición: solo se usa cuando la
    // lista está visible, y al reabrir se recalcula antes de pintar.
    if (!mostrar) return;
    // Medir el input ya maquetado y recién ahí guardar dónde va el portal es
    // justamente para lo que existe useLayoutEffect.
    ubicar();
    // El scroll puede pasar en cualquier ancestro, por eso va en captura.
    window.addEventListener("scroll", ubicar, true);
    window.addEventListener("resize", ubicar);
    return () => {
      window.removeEventListener("scroll", ubicar, true);
      window.removeEventListener("resize", ubicar);
    };
  }, [mostrar, ubicar]);

  // Al navegar con el teclado, mantener a la vista la opción marcada.
  useEffect(() => {
    if (!mostrar) return;
    listaRef.current?.children[activo]?.scrollIntoView({ block: "nearest" });
  }, [activo, mostrar]);

  function elegir(p: PatientSuggestion) {
    onSelect(p);
    setAbierto(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!mostrar) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActivo((i) => (i + 1) % sugerencias.length); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setActivo((i) => (i - 1 + sugerencias.length) % sugerencias.length); }
    if (e.key === "Enter")     { e.preventDefault(); elegir(sugerencias[activo]); }
    if (e.key === "Escape")    { setAbierto(false); }
  }

  // Paciente ya elegido: el campo pasa a ser una ficha, no un input.
  if (seleccionado) {
    return (
      <div className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/60">
        <span className="w-7 h-7 shrink-0 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center">
          {value.trim().charAt(0).toUpperCase() || "?"}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold text-gray-800 truncate">{value}</span>
          <span className="block text-[11px] text-emerald-700">Paciente ya registrado</span>
        </span>
        <button
          type="button"
          onClick={onClear}
          aria-label="Quitar paciente y escribir otro"
          className="shrink-0 w-9 h-9 rounded-full text-gray-400 hover:text-gray-700 hover:bg-white/80 transition flex items-center justify-center text-base"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div ref={contenedor} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setAbierto(true);
          // El índice vuelve al primero acá y no en un efecto: al cambiar el
          // texto cambian los resultados, y dejarlo apuntando al viejo elegiría
          // a otro paciente si apretan Enter de inmediato.
          setActivo(0);
        }}
        onFocus={() => setAbierto(true)}
        onKeyDown={onKeyDown}
        placeholder={cargando ? "Cargando pacientes…" : "Escribe el nombre o RUT"}
        required
        autoComplete="off"
        role="combobox"
        aria-expanded={mostrar}
        aria-controls={listaId}
        aria-autocomplete="list"
        autoFocus={autoFocus}
        className={inputClassName}
        style={inputStyle}
      />

      {mostrar && caja && createPortal(
        <ul
          ref={listaRef}
          id={listaId}
          role="listbox"
          style={{ position: "fixed", left: caja.left, top: caja.top, width: caja.width }}
          className="z-[100] max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl overscroll-contain"
        >
          {sugerencias.map((p, i) => (
            <li key={p.key} role="option" aria-selected={i === activo}>
              <button
                type="button"
                // onMouseDown y no onClick: el blur del input cierra la lista
                // antes de que llegue el click y el toque se pierde.
                onMouseDown={(e) => { e.preventDefault(); elegir(p); }}
                onMouseEnter={() => setActivo(i)}
                className={`w-full text-left px-3 py-2.5 min-h-[52px] flex items-center gap-3 transition ${
                  i === activo ? "bg-blue-50" : "bg-white"
                }`}
              >
                <span className="w-8 h-8 shrink-0 rounded-full bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center">
                  {p.name.trim().charAt(0).toUpperCase()}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-gray-800 truncate">
                    {resaltar(p.name, value)}
                  </span>
                  <span className="block text-[11px] text-gray-400 truncate">
                    {[p.rut, `${p.visits} ${p.visits === 1 ? "visita" : "visitas"}`, haceCuanto(p.lastVisit)]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>,
        document.body
      )}
    </div>
  );
}

/** Marca en negrita el trozo que coincide, para que se vea por qué salió ese nombre. */
function resaltar(nombre: string, consulta: string) {
  const q = normalizar(consulta);
  if (!q) return nombre;
  const i = normalizar(nombre).indexOf(q);
  if (i === -1) return nombre;
  return (
    <>
      {nombre.slice(0, i)}
      <mark className="bg-transparent text-blue-700 font-bold">{nombre.slice(i, i + q.length)}</mark>
      {nombre.slice(i + q.length)}
    </>
  );
}
