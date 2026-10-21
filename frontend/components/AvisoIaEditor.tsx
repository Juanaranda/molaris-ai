"use client";

/**
 * Editor del aviso que el paciente ve antes de conversar con el asistente
 * (MOL-11, borrador pendiente de revisión legal). Se guarda en
 * Clinic.config.avisoIa.
 *
 * La clínica solo agrega un texto propio ANTES del aviso: que responde una
 * IA, que los datos se procesan fuera de Chile y el link a la política no se
 * pueden quitar. Por eso la vista previa muestra el aviso completo y la parte
 * fija no es un campo.
 */

import { useState } from "react";
import { AvisoPrivacidadChat } from "@/components/AvisoPrivacidadChat";

/** Igual que MAX_AVISO_CLINICA en backend/src/lib/avisoPrivacidad.ts. */
export const MAX_AVISO_CLINICA = 280;

interface Props {
  nombreClinica: string;
  texto: string;
  canEdit: boolean;
  onSave: (texto: string) => Promise<void>;
}

export function AvisoIaEditor({ nombreClinica, texto, canEdit, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [borrador, setBorrador] = useState(texto);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const largo = borrador.trim().length;
  const muyLargo = largo > MAX_AVISO_CLINICA;

  function start() { setBorrador(texto); setMsg(""); setEditing(true); }
  function cancel() { setBorrador(texto); setMsg(""); setEditing(false); }

  async function save() {
    setSaving(true); setMsg("");
    try {
      await onSave(borrador.trim());
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
          <h3 className="text-sm font-bold text-gray-900">Aviso antes de conversar</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Lo primero que ve el paciente en el chat y en WhatsApp. Puedes agregarle un saludo propio.
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
              <button onClick={save} disabled={saving || muyLargo}
                className="text-xs font-bold px-3 py-1.5 rounded-xl bg-[#1A5C7A] text-white hover:bg-[#0e4560] transition disabled:opacity-50">
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </>
          )}
        </div>
      </div>

      {editing && (
        <div className="mt-4">
          <label htmlFor="aviso-ia" className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
            Tu texto (opcional)
          </label>
          <textarea
            id="aviso-ia"
            value={borrador}
            onChange={(e) => setBorrador(e.target.value)}
            rows={3}
            placeholder={`Ej: ¡Hola! Te damos la bienvenida a ${nombreClinica}. Te ayudamos a agendar tu hora.`}
            aria-describedby="aviso-ia-largo"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1A5C7A]/30"
          />
          <p id="aviso-ia-largo" className={`mt-1 text-[11px] ${muyLargo ? "text-red-600 font-semibold" : "text-gray-400"}`}>
            {largo}/{MAX_AVISO_CLINICA} caracteres
          </p>
        </div>
      )}

      <p className="mt-4 mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Así lo ve el paciente</p>
      <AvisoPrivacidadChat nombreClinica={nombreClinica} textoClinica={editing ? borrador : texto} />
      <p className="mt-2 text-[11px] text-gray-400">
        Lo que va después de tu texto es fijo y no se puede quitar: el paciente tiene que saber que le responde
        una IA y que sus datos se procesan fuera de Chile.
      </p>
    </section>
  );
}
