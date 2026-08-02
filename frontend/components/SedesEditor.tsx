"use client";

/**
 * Editor de sedes (#69 Fase 4) — para el doctor independiente que atiende en
 * varias clínicas. Se guarda en Clinic.config.sedes como lista de etiquetas;
 * cada cita referencia una por nombre (Booking.sede).
 *
 * Deliberadamente texto libre y no una entidad propia: el doctor solo necesita
 * distinguir "dónde atiendo hoy", no gestionar sucursales con inventario y
 * equipo. Eso es multi-sucursal por clínica (#47) y es otro problema.
 */

import { useState } from "react";

interface Props {
  sedes: string[];
  canEdit: boolean;
  onSave: (sedes: string[]) => Promise<void>;
}

export function SedesEditor({ sedes, canEdit, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<string[]>(sedes);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  function start() { setRows(sedes.length > 0 ? sedes : [""]); setMsg(""); setEditing(true); }
  function cancel() { setRows(sedes); setMsg(""); setEditing(false); }

  async function save() {
    // Se limpian vacíos y duplicados: una sede repetida rompe el selector de
    // la agenda, que las identifica por nombre.
    const clean = Array.from(new Set(rows.map((r) => r.trim()).filter(Boolean)));
    setSaving(true); setMsg("");
    try {
      await onSave(clean);
      setRows(clean);
      setEditing(false);
      setMsg("Guardado");
      setTimeout(() => setMsg(""), 3000);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-1 gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Sedes donde atiendo</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Si atiendes en más de un lugar, agrégalos acá para poder elegirlos al agendar.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {msg && (
            <span className={`text-xs font-semibold ${msg === "Guardado" ? "text-emerald-600" : "text-red-600"}`}>
              {msg}
            </span>
          )}
          {canEdit && !editing && (
            <button onClick={start}
              className="text-xs font-bold text-[#1A5C7A] hover:text-[#0e4560] transition">
              Editar
            </button>
          )}
          {editing && (
            <>
              <button onClick={cancel} disabled={saving}
                className="text-xs font-bold text-gray-400 hover:text-gray-600 transition disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={save} disabled={saving}
                className="text-xs font-bold px-3 py-1.5 rounded-xl bg-[#1A5C7A] text-white hover:bg-[#0e4560] transition disabled:opacity-50">
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </>
          )}
        </div>
      </div>

      {!editing ? (
        sedes.length === 0 ? (
          <p className="text-sm text-gray-400 mt-3">
            Sin sedes configuradas. {canEdit && "Agrega una para separar tu agenda por lugar."}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2 mt-3">
            {sedes.map((s) => (
              <span key={s}
                className="text-xs font-semibold px-3 py-1.5 rounded-full bg-[#E8F2F6] text-[#1A5C7A]">
                {s}
              </span>
            ))}
          </div>
        )
      ) : (
        <div className="flex flex-col gap-2 mt-4">
          {rows.map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={row}
                onChange={(e) => setRows(rows.map((r, j) => (j === i ? e.target.value : r)))}
                placeholder="Ej: Clínica Galana · Providencia"
                className="flex-1 px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1A5C7A]/30 focus:border-[#1A5C7A] transition"
              />
              <button onClick={() => setRows(rows.filter((_, j) => j !== i))}
                aria-label={`Quitar sede ${i + 1}`}
                className="text-xs font-bold text-red-500 hover:text-red-600 px-2 py-1 transition">
                Quitar
              </button>
            </div>
          ))}
          <button onClick={() => setRows([...rows, ""])}
            className="self-start text-xs font-bold text-[#1A5C7A] hover:text-[#0e4560] transition mt-1">
            + Agregar sede
          </button>
        </div>
      )}
    </section>
  );
}
