"use client";

import { useCallback, useEffect, useState } from "react";
import {
  RecallRule, RecallEvent,
  listRecallRules, createRecallRule, updateRecallRule, deleteRecallRule,
  listRecallEvents, triggerRecallCheck,
} from "@/lib/recall";

interface Props {
  clinicId: string;
}

/**
 * Sección de configuración del sistema de recall (Issue #27 — UI del #25).
 * Se monta en la tab Configuración. Maneja reglas + audit log de eventos.
 */
export function RecallSection({ clinicId }: Props) {
  const [rules,   setRules]    = useState<RecallRule[]>([]);
  const [events,  setEvents]   = useState<RecallEvent[]>([]);
  const [loading, setLoading]  = useState(true);
  const [error,   setError]    = useState("");
  const [editing, setEditing]  = useState<RecallRule | null>(null);
  const [creating, setCreating] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [r, e] = await Promise.all([
        listRecallRules(clinicId),
        listRecallEvents(clinicId, 50).catch(() => [] as RecallEvent[]),
      ]);
      setRules(r); setEvents(e);
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
    finally      { setLoading(false); }
  }, [clinicId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function toggleActive(rule: RecallRule) {
    try {
      const updated = await updateRecallRule(clinicId, rule.id, { active: !rule.active });
      setRules((arr) => arr.map((r) => r.id === rule.id ? updated : r));
    } catch (e) { alert(e instanceof Error ? e.message : "Error"); }
  }

  async function remove(rule: RecallRule) {
    if (!confirm(`Eliminar la regla "${rule.triggerService}"?`)) return;
    try {
      await deleteRecallRule(clinicId, rule.id);
      setRules((arr) => arr.filter((r) => r.id !== rule.id));
    } catch (e) { alert(e instanceof Error ? e.message : "Error"); }
  }

  async function manualTrigger() {
    setTriggering(true); setTriggerMsg("");
    try {
      await triggerRecallCheck(clinicId);
      setTriggerMsg("✓ Check disparado — revisa los eventos en unos segundos");
      setTimeout(() => { fetchAll(); setTriggerMsg(""); }, 4000);
    } catch (e) {
      setTriggerMsg(e instanceof Error ? e.message : "Error");
    } finally { setTriggering(false); }
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <div>
          <h2 className="font-semibold text-gray-900">🔔 Recall automático</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Recordatorios automáticos por WhatsApp para que los pacientes vuelvan a control
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={manualTrigger} disabled={triggering}
            className="text-xs font-bold px-3 py-1.5 rounded-xl border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition disabled:opacity-50">
            {triggering ? "Disparando…" : "Disparar ahora"}
          </button>
          <button onClick={() => setCreating(true)}
            className="text-xs font-bold px-3 py-1.5 rounded-xl bg-[#1A5C7A] text-white hover:bg-[#0e4560] transition">
            + Nueva regla
          </button>
        </div>
      </div>

      {triggerMsg && <p className="text-xs text-emerald-600 mt-2">{triggerMsg}</p>}
      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}

      {/* Reglas */}
      <div className="mt-5">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">Reglas</h3>
        {loading && rules.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">Cargando…</p>
        ) : rules.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">Sin reglas. Crea una para activar el recall.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {rules.map((r) => (
              <RuleRow key={r.id} rule={r}
                onEdit={() => setEditing(r)}
                onToggle={() => toggleActive(r)}
                onDelete={() => remove(r)} />
            ))}
          </div>
        )}
      </div>

      {/* Eventos recientes */}
      <div className="mt-6">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">
          Eventos recientes {events.length > 0 && <span className="ml-1 text-gray-400">({events.length})</span>}
        </h3>
        {events.length === 0 ? (
          <p className="text-sm text-gray-400 py-3">Aún no se han enviado recordatorios.</p>
        ) : (
          <div className="bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-white border-b border-gray-100 sticky top-0">
                  <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2">Paciente</th>
                    <th className="px-3 py-2">Regla</th>
                    <th className="px-3 py-2 text-right">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={e.id} className="border-b border-gray-100 last:border-0 hover:bg-white">
                      <td className="px-3 py-2 text-gray-500 tabular-nums whitespace-nowrap">
                        {new Date(e.sentAt).toLocaleDateString("es-CL", { day: "2-digit", month: "short" })} {new Date(e.sentAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-semibold text-gray-800 truncate">{e.patientName ?? e.patientPhone}</p>
                        {e.patientName && <p className="text-[10px] text-gray-400">{e.patientPhone}</p>}
                      </td>
                      <td className="px-3 py-2 text-gray-500 truncate">{e.rule.triggerService}</td>
                      <td className="px-3 py-2 text-right">
                        {e.success
                          ? <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">✓ Enviado</span>
                          : <span className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded" title={e.errorMessage ?? ""}>✕ Falló</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {(creating || editing) && (
        <RuleModal
          clinicId={clinicId}
          initial={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={(rule) => {
            setRules((arr) => {
              const exists = arr.find((r) => r.id === rule.id);
              return exists ? arr.map((r) => r.id === rule.id ? rule : r) : [...arr, rule];
            });
            setCreating(false); setEditing(null);
          }}
        />
      )}
    </section>
  );
}

function RuleRow({ rule, onEdit, onToggle, onDelete }: {
  rule: RecallRule;
  onEdit: () => void; onToggle: () => void; onDelete: () => void;
}) {
  return (
    <div className={`bg-white rounded-xl border p-3 flex items-center gap-3 ${rule.active ? "border-gray-100" : "border-gray-100 opacity-60"}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold text-gray-900">{rule.triggerService}</span>
          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
            cada {rule.intervalDays}d
          </span>
          {!rule.active && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-200 text-gray-500">Pausada</span>
          )}
        </div>
        <p className="text-[11px] text-gray-500 mt-1 truncate">{rule.messageTemplate}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={onToggle}
          className="text-[11px] font-bold px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
          {rule.active ? "Pausar" : "Activar"}
        </button>
        <button onClick={onEdit}
          className="text-[11px] font-bold px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
          Editar
        </button>
        <button onClick={onDelete}
          className="text-[11px] font-bold px-2 py-1 rounded-lg text-red-500 hover:bg-red-50">
          ✕
        </button>
      </div>
    </div>
  );
}

function RuleModal({ clinicId, initial, onClose, onSaved }: {
  clinicId: string; initial: RecallRule | null;
  onClose: () => void; onSaved: (rule: RecallRule) => void;
}) {
  const [service,  setService]  = useState(initial?.triggerService ?? "");
  const [days,     setDays]     = useState<string>(String(initial?.intervalDays ?? 180));
  const [template, setTemplate] = useState(initial?.messageTemplate ?? "Hola {nombre} 👋 Te toca tu control en {clinica}. Responde acá para reservar.");
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const intervalDays = Math.round(Number(days));
    if (!service.trim()) { setError("Servicio obligatorio"); return; }
    if (!Number.isFinite(intervalDays) || intervalDays < 1 || intervalDays > 730) {
      setError("Intervalo entre 1 y 730 días"); return;
    }
    if (!template.trim()) { setError("Mensaje obligatorio"); return; }
    setSaving(true); setError("");
    try {
      const rule = initial
        ? await updateRecallRule(clinicId, initial.id, { triggerService: service.trim(), intervalDays, messageTemplate: template.trim() })
        : await createRecallRule(clinicId, { triggerService: service.trim(), intervalDays, messageTemplate: template.trim() });
      onSaved(rule);
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally    { setSaving(false); }
  }

  const inputCls = "w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1A5C7A]/30 focus:border-[#1A5C7A]";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
          <h3 className="text-sm font-bold text-gray-800">{initial ? "Editar regla" : "Nueva regla de recall"}</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 text-lg">✕</button>
        </div>
        <form onSubmit={submit} className="p-5 flex flex-col gap-3 overflow-y-auto">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Servicio que dispara *</label>
            <input autoFocus value={service} onChange={(e) => setService(e.target.value)} placeholder="Ej: Limpieza, Ortodoncia, Control endodoncia" className={inputCls} />
            <p className="text-[10px] text-gray-400 mt-1">Coincidencia case-insensitive con el servicio del booking.</p>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Intervalo (días) *</label>
            <input type="number" min="1" max="730" value={days} onChange={(e) => setDays(e.target.value)} className={inputCls} />
            <p className="text-[10px] text-gray-400 mt-1">Recordar después de cuántos días desde la última cita.</p>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Mensaje template *</label>
            <textarea value={template} onChange={(e) => setTemplate(e.target.value.slice(0, 1000))} rows={4} className={`${inputCls} resize-none`} />
            <p className="text-[10px] text-gray-400 mt-1">Usa <code className="bg-gray-100 px-1 rounded">{"{nombre}"}</code> y <code className="bg-gray-100 px-1 rounded">{"{clinica}"}</code> · máx 1000 chars</p>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-500 text-sm font-bold hover:border-gray-300">Cancelar</button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 rounded-xl bg-[#1A5C7A] text-white text-sm font-bold hover:bg-[#0e4560] disabled:opacity-50">
              {saving ? "Guardando…" : initial ? "Guardar" : "Crear regla"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
