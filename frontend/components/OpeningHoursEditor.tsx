"use client";

import { useState } from "react";

/**
 * Horario de atención de la clínica, día por día.
 *
 * Antes esto era texto libre ("Lunes a Viernes: 10:00 - 18:00"): servía para
 * que el asistente se lo leyera al paciente, pero el sistema no podía calcular
 * con ello, así que la agenda usaba un horario fijo en el código. Acá el dato
 * es estructurado —la agenda y la disponibilidad lo usan de verdad— y el texto
 * que dice el asistente se genera solo a partir de él.
 */

export interface HoraRango { from: string; to: string }
/** Clave = día de la semana (0 = domingo). null = cerrado ese día. */
export type OpeningHours = Record<string, HoraRango | null>;

const DIAS: { key: string; label: string; corto: string }[] = [
  { key: "1", label: "Lunes",     corto: "Lun" },
  { key: "2", label: "Martes",    corto: "Mar" },
  { key: "3", label: "Miércoles", corto: "Mié" },
  { key: "4", label: "Jueves",    corto: "Jue" },
  { key: "5", label: "Viernes",   corto: "Vie" },
  { key: "6", label: "Sábado",    corto: "Sáb" },
  { key: "0", label: "Domingo",   corto: "Dom" },
];

/** Horas en bloques de 30 min entre las 06:00 y las 23:00. */
const HORAS: string[] = Array.from({ length: 35 }, (_, i) => {
  const m = 6 * 60 + i * 30;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
});

export const HORARIO_SUGERIDO: OpeningHours = {
  "1": { from: "10:00", to: "18:00" }, "2": { from: "10:00", to: "18:00" },
  "3": { from: "10:00", to: "18:00" }, "4": { from: "10:00", to: "18:00" },
  "5": { from: "10:00", to: "18:00" },
  "6": { from: "10:00", to: "14:00" },
  "0": null,
};

/**
 * Texto legible del horario, agrupando días seguidos con el mismo rango.
 * Es lo que el asistente le dice al paciente, así que se arma con la misma
 * fuente de datos que usa la agenda: no pueden desincronizarse.
 */
export function describirHorario(h: OpeningHours | undefined): string {
  if (!h) return "";
  const tramos: { desde: string; hasta: string; rango: HoraRango }[] = [];
  for (const d of DIAS) {
    const r = h[d.key];
    if (!r) continue;
    const ultimo = tramos[tramos.length - 1];
    // Se agrupa solo si el día anterior en la lista es consecutivo y comparte
    // horario; así "Lun a Vie 10:00-18:00" no se parte en cinco líneas.
    const consecutivo = ultimo && DIAS.findIndex((x) => x.corto === ultimo.hasta) === DIAS.indexOf(d) - 1;
    if (ultimo && consecutivo && ultimo.rango.from === r.from && ultimo.rango.to === r.to) {
      ultimo.hasta = d.corto;
    } else {
      tramos.push({ desde: d.corto, hasta: d.corto, rango: r });
    }
  }
  if (tramos.length === 0) return "Cerrado";
  return tramos
    .map((t) => `${t.desde === t.hasta ? t.desde : `${t.desde} a ${t.hasta}`}: ${t.rango.from} - ${t.rango.to}`)
    .join(" · ");
}

/**
 * Traduce el horario estructurado al formato de texto que ya consume el
 * prompt del asistente (weekdays / saturday / sunday).
 *
 * Se mantiene esa forma a propósito: el agente sigue leyendo lo mismo que
 * antes, pero ahora ese texto se DERIVA del dato con que trabaja la agenda,
 * en vez de escribirse por separado. Así no pueden contradecirse.
 */
export function aScheduleTexto(h: OpeningHours): { weekdays: string; saturday: string; sunday: string } {
  const laborales = ["1", "2", "3", "4", "5"];
  const abiertos = laborales.filter((k) => h[k]);
  const iguales = abiertos.length > 0 && abiertos.every((k) => {
    const r = h[k]!, p = h[abiertos[0]]!;
    return r.from === p.from && r.to === p.to;
  });

  let weekdays: string;
  if (abiertos.length === 0) {
    weekdays = "Lunes a Viernes: cerrado";
  } else if (iguales && abiertos.length === 5) {
    weekdays = `Lunes a Viernes: ${h["1"]!.from} - ${h["1"]!.to}`;
  } else {
    // Horarios distintos por día: se detallan uno a uno para no mentirle al
    // paciente con un rango que no aplica a todos.
    weekdays = laborales
      .map((k) => {
        const d = DIAS.find((x) => x.key === k)!;
        const r = h[k];
        return `${d.label}: ${r ? `${r.from} - ${r.to}` : "cerrado"}`;
      })
      .join(" · ");
  }

  const sab = h["6"], dom = h["0"];
  return {
    weekdays,
    saturday: sab ? `Sábado: ${sab.from} - ${sab.to}` : "Sábado: cerrado",
    sunday:   dom ? `Domingo: ${dom.from} - ${dom.to}` : "Domingo: cerrado",
  };
}

interface Props {
  value: OpeningHours | undefined;
  canEdit: boolean;
  onSave: (h: OpeningHours) => Promise<void>;
}

export function OpeningHoursEditor({ value, canEdit, onSave }: Props) {
  const inicial = value ?? HORARIO_SUGERIDO;
  const [horas, setHoras] = useState<OpeningHours>(inicial);
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState("");

  function setDia(key: string, r: HoraRango | null) {
    setHoras((h) => ({ ...h, [key]: r }));
  }

  /** Copia el horario del lunes al resto de días laborales: el atajo que
      evita repetir cinco veces lo mismo, que es el caso normal. */
  function copiarDeLunes() {
    const lunes = horas["1"];
    if (!lunes) return;
    setHoras((h) => ({ ...h, "2": { ...lunes }, "3": { ...lunes }, "4": { ...lunes }, "5": { ...lunes } }));
  }

  const hayInvertido = DIAS.some((d) => {
    const r = horas[d.key];
    return r != null && r.to <= r.from;
  });

  async function guardar() {
    if (hayInvertido) return;
    setGuardando(true); setMsg("");
    try {
      await onSave(horas);
      setMsg("Guardado");
      setEditando(false);
      setTimeout(() => setMsg(""), 3000);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error al guardar");
    } finally { setGuardando(false); }
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold text-gray-900">Horarios de atención</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            El asistente los informa a los pacientes y la agenda solo ofrece horas dentro de ellos
          </p>
        </div>
        <div className="flex items-center gap-3">
          {msg && (
            <span className={`text-xs font-medium ${msg === "Guardado" ? "text-emerald-600" : "text-red-500"}`}>{msg}</span>
          )}
          {canEdit && !editando && (
            <button onClick={() => setEditando(true)}
              className="text-sm font-semibold px-4 py-1.5 rounded-full border transition-colors hover:bg-gray-50"
              style={{ borderColor: "#D9D4CD", color: "#1A5C7A" }}>
              Editar
            </button>
          )}
          {canEdit && editando && (
            <div className="flex gap-2">
              <button onClick={() => { setHoras(inicial); setEditando(false); setMsg(""); }}
                className="text-sm text-gray-400 hover:text-gray-600 px-3 py-1.5 transition">Cancelar</button>
              <button onClick={guardar} disabled={guardando || hayInvertido}
                className="text-sm font-semibold px-4 py-1.5 rounded-full text-white disabled:opacity-50 transition-colors"
                style={{ backgroundColor: "#1A5C7A" }}>
                {guardando ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          )}
        </div>
      </div>

      {editando ? (
        <div className="flex flex-col gap-2">
          {DIAS.map((d) => {
            const r = horas[d.key];
            const abierto = r != null;
            const invertido = r != null && r.to <= r.from;
            return (
              <div key={d.key}
                className={`flex items-center gap-3 flex-wrap py-2.5 px-3 rounded-xl border ${
                  invertido ? "border-red-200 bg-red-50" : abierto ? "border-gray-100" : "border-gray-100 bg-gray-50"
                }`}>
                <label className="flex items-center gap-2 w-32 shrink-0 cursor-pointer">
                  <input type="checkbox" checked={abierto}
                    onChange={(e) => setDia(d.key, e.target.checked ? { from: "10:00", to: "18:00" } : null)}
                    className="w-4 h-4 accent-[#1A5C7A]" />
                  <span className={`text-sm font-medium ${abierto ? "text-gray-800" : "text-gray-400"}`}>{d.label}</span>
                </label>

                {abierto ? (
                  <div className="flex items-center gap-2">
                    <select value={r.from} onChange={(e) => setDia(d.key, { ...r, from: e.target.value })}
                      className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1A5C7A]/30">
                      {HORAS.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                    <span className="text-xs text-gray-400">a</span>
                    <select value={r.to} onChange={(e) => setDia(d.key, { ...r, to: e.target.value })}
                      className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1A5C7A]/30">
                      {HORAS.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                    {invertido && (
                      <span className="text-[11px] text-red-600 font-medium">El cierre debe ser posterior a la apertura</span>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-gray-400">Cerrado</span>
                )}

                {d.key === "1" && abierto && (
                  <button onClick={copiarDeLunes}
                    className="ml-auto text-[11px] font-semibold text-[#1A5C7A] hover:underline">
                    Copiar a martes–viernes
                  </button>
                )}
              </div>
            );
          })}
          <p className="text-[11px] text-gray-400 mt-1">
            Así lo dirá el asistente: <span className="text-gray-600 font-medium">{describirHorario(horas)}</span>
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {DIAS.map((d) => {
            const r = horas[d.key];
            return (
              <div key={d.key} className="flex items-center justify-between py-2.5 px-4 rounded-xl border border-gray-100 bg-gray-50">
                <span className="text-sm text-gray-500">{d.label}</span>
                <span className={`text-sm font-medium ${r ? "text-gray-800" : "text-gray-300"}`}>
                  {r ? `${r.from} - ${r.to}` : "Cerrado"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
