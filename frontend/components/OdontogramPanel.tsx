"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DentalSurface, DentalEventType, ToothProjection, ConditionMeta,
  getCatalog, getOdontogram, createDentalEvent,
} from "@/lib/odontogram";
import { StandardOdontogram } from "@/components/StandardOdontogram";
import { ToothFrontView } from "@/components/ToothFrontView";
import { toothTypeOf, isUpperFdi } from "@/lib/tooth";
import { ToothSurfaceWheel } from "@/components/ToothSurfaceWheel";

interface Props {
  patientId: string;
}

/**
 * Panel mínimo del odontograma event-sourced (Issue #13).
 * Pensado para embeber en cualquier vista de paciente. NO reemplaza la UI
 * visual del odontograma anatómico — provee el data layer + flujo de registro.
 *
 * Decisiones del discovery #11 aplicadas:
 *   - Dientes en notación FDI (cuadrantes 1-4, piezas 1-8)
 *   - Múltiples condiciones simultáneas por diente (M:N)
 *   - Eventos inmutables vía POST (no edit)
 *   - Superficies multi-select
 */

const SURFACE_LABELS: Record<DentalSurface, string> = {
  V: "Vestibular", P: "Palatino", L: "Lingual",
  M: "Mesial",     D: "Distal",   O: "Oclusal",   I: "Incisal",
};

function conditionChipColor(code: string): string {
  switch (code) {
    case "caries":            return "bg-red-100 text-red-800";
    case "obturacion":        return "bg-emerald-100 text-emerald-800";
    case "endodoncia":        return "bg-amber-100 text-amber-800";
    case "corona":            return "bg-blue-100 text-blue-800";
    case "implante":          return "bg-violet-100 text-violet-800";
    case "extraccion":        return "bg-gray-200 text-gray-700 line-through";
    case "ortodoncia":        return "bg-pink-100 text-pink-800";
    case "fractura":          return "bg-orange-100 text-orange-800";
    case "perno":             return "bg-cyan-100 text-cyan-800";
    case "sellante":          return "bg-teal-100 text-teal-800";
    case "movilidad":         return "bg-yellow-100 text-yellow-800";
    case "periodontal_bolsa": return "bg-rose-100 text-rose-800";
    case "sano":              return "bg-green-100 text-green-700";
    default:                  return "bg-gray-100 text-gray-700";
  }
}

export function OdontogramPanel({ patientId }: Props) {
  const [teeth,   setTeeth]   = useState<Record<string, ToothProjection>>({});
  const [catalog, setCatalog] = useState<{ conditions: ConditionMeta[]; surfaces: DentalSurface[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [showAddFor, setShowAddFor] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [cat, odo] = await Promise.all([getCatalog(), getOdontogram(patientId)]);
      setCatalog(cat);
      setTeeth(odo.teeth);
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally     { setLoading(false); }
  }, [patientId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const selectedProjection = useMemo(
    () => selected ? teeth[selected] : null,
    [selected, teeth]
  );

  if (loading) return <div className="py-8 text-sm text-gray-400 text-center">Cargando odontograma…</div>;
  if (error)   return <div className="py-8 text-sm text-red-500 text-center">{error}</div>;
  if (!catalog) return null;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Odontograma</h3>
          <p className="text-[11px] text-gray-400">Notación FDI · {Object.keys(teeth).length} pieza{Object.keys(teeth).length !== 1 ? "s" : ""} con eventos</p>
        </div>
      </div>

      {/* Odontograma estándar — grid simple y profesional */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 overflow-x-auto">
        <StandardOdontogram
          teeth={teeth}
          selectedFdis={selected}
          mode="single"
          onSelectTooth={(fdi) => setSelected(fdi)}
        />
      </div>

      {/* Detalle del diente seleccionado */}
      {selected && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Vista anatómica: la grilla usa el diagrama de superficies (denso,
                  para escanear); acá se ve la pieza real al analizarla. */}
              <ToothFrontView
                type={toothTypeOf(selected)}
                jaw={isUpperFdi(selected) ? "upper" : "lower"}
                size={34}
                tint={selectedProjection?.isExtracted ? "#9CA3AF" : undefined}
              />
              <div>
                <h4 className="text-sm font-bold text-gray-900">Pieza {selected}</h4>
                {selectedProjection?.isExtracted && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-red-600">Extraída</span>
                )}
              </div>
            </div>
            <button onClick={() => setShowAddFor(selected)}
              className="text-xs font-bold px-3 py-1.5 rounded-xl bg-[#1A5C7A] text-white hover:bg-[#0e4560] transition">
              + Registrar evento
            </button>
          </div>

          {/* Condiciones activas */}
          {(selectedProjection?.activeConditions?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedProjection!.activeConditions.map((c) => (
                <span key={c.eventId}
                  className={`text-[11px] font-semibold px-2 py-1 rounded-full ${conditionChipColor(c.conditionCode)}`}>
                  {catalog.conditions.find((x) => x.code === c.conditionCode)?.label ?? c.conditionCode}
                  {c.surfaces.length > 0 && <span className="opacity-60 ml-1">{c.surfaces.join("·")}</span>}
                  {c.severity != null && <span className="opacity-60 ml-1">sev {c.severity}</span>}
                </span>
              ))}
            </div>
          )}

          {/* Historial completo */}
          {(selectedProjection?.events?.length ?? 0) > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Historial</p>
              <div className="flex flex-col divide-y divide-gray-50">
                {selectedProjection!.events.map((e) => (
                  <div key={e.id} className="py-2 flex items-center gap-2 text-xs">
                    <span className="text-[10px] text-gray-400 tabular-nums w-20 shrink-0">
                      {new Date(e.occurredAt).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "2-digit" })}
                    </span>
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      e.eventType === "DIAGNOSIS"  ? "bg-amber-50 text-amber-700"
                      : e.eventType === "TREATMENT" ? "bg-emerald-50 text-emerald-700"
                                                    : "bg-gray-50 text-gray-500"
                    }`}>{e.eventType.slice(0, 4)}</span>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${conditionChipColor(e.conditionCode)}`}>
                      {catalog.conditions.find((x) => x.code === e.conditionCode)?.label ?? e.conditionCode}
                    </span>
                    {e.surfaces.length > 0 && (
                      <span className="text-[10px] text-gray-400">{e.surfaces.map((s) => s.surface).join("·")}</span>
                    )}
                    <span className="ml-auto text-[10px] text-gray-400 truncate">{e.professional.name.split(" ")[0]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(selectedProjection?.events?.length ?? 0) === 0 && (
            <p className="text-xs text-gray-400 py-4 text-center">Sin eventos registrados para esta pieza</p>
          )}
        </div>
      )}

      {/* Modal registrar evento */}
      {showAddFor && catalog && (
        <AddEventModal
          toothFDI={showAddFor}
          patientId={patientId}
          catalog={catalog}
          onClose={() => setShowAddFor(null)}
          onCreated={() => { setShowAddFor(null); fetchAll(); }}
        />
      )}
    </div>
  );
}

/* ─── Modal: registrar evento clínico ─────────────────────────────────── */
interface AddEventModalProps {
  toothFDI:   string;
  patientId:  string;
  catalog:    { conditions: ConditionMeta[]; surfaces: DentalSurface[] };
  onClose:    () => void;
  onCreated:  () => void;
}

function AddEventModal({ toothFDI, patientId, catalog, onClose, onCreated }: AddEventModalProps) {
  const [eventType, setEventType] = useState<DentalEventType>("DIAGNOSIS");
  const [conditionCode, setCondition] = useState<string>(catalog.conditions[0]?.code ?? "");
  const [surfaces, setSurfaces] = useState<DentalSurface[]>([]);
  const [severity, setSeverity] = useState<string>("");
  const [notes,    setNotes]    = useState<string>("");
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState("");

  const conditionMeta = catalog.conditions.find((c) => c.code === conditionCode);

  function toggleSurface(s: DentalSurface) {
    setSurfaces((cur) => cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      await createDentalEvent(patientId, {
        toothFDI, eventType, conditionCode,
        surfaces: surfaces.length > 0 ? surfaces : undefined,
        severity: severity ? Number(severity) : undefined,
        notes: notes.trim() || undefined,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-800">Registrar evento — Pieza {toothFDI}</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 text-lg leading-none">✕</button>
        </div>

        <form onSubmit={submit} className="p-5 flex flex-col gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Tipo de evento</label>
            <div className="grid grid-cols-3 gap-1">
              {(["DIAGNOSIS","TREATMENT","OBSERVATION"] as DentalEventType[]).map((t) => (
                <button key={t} type="button" onClick={() => setEventType(t)}
                  className={`px-2 py-1.5 text-xs font-bold rounded-lg border transition ${
                    eventType === t
                      ? "bg-[#1A5C7A] text-white border-[#1A5C7A]"
                      : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                  }`}>
                  {t === "DIAGNOSIS" ? "Diagnóstico" : t === "TREATMENT" ? "Tratamiento" : "Observación"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Condición / procedimiento</label>
            <select value={conditionCode} onChange={(e) => setCondition(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1A5C7A]/30 focus:border-[#1A5C7A]">
              {catalog.conditions.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Superficies afectadas</label>
            <div className="flex justify-center bg-gray-50 rounded-xl py-3">
              <ToothSurfaceWheel
                toothFDI={toothFDI}
                selected={surfaces}
                onToggle={toggleSurface}
                size={170}
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-2 text-center">
              Click en cada cara para seleccionar (multi). Una condición puede afectar varias (ej: caries MOD).
            </p>
          </div>

          {conditionMeta?.allowsSeverity && (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                Severidad {conditionMeta.severityScale ? <span className="opacity-60">({conditionMeta.severityScale})</span> : null}
              </label>
              {conditionMeta.severityMin != null && conditionMeta.severityMax != null ? (
                <div className="flex flex-col gap-2">
                  <div className="flex gap-1 flex-wrap">
                    {Array.from({ length: conditionMeta.severityMax - conditionMeta.severityMin + 1 }, (_, i) => {
                      const v = (conditionMeta.severityMin ?? 0) + i;
                      const label = conditionMeta.severityLabels?.[String(v)];
                      const selected = severity === String(v);
                      return (
                        <button key={v} type="button" onClick={() => setSeverity(String(v))}
                          title={label}
                          className={`w-9 h-9 text-xs font-bold rounded-lg border transition ${
                            selected
                              ? "bg-[#1A5C7A] text-white border-[#1A5C7A]"
                              : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                          }`}>
                          {v}
                        </button>
                      );
                    })}
                  </div>
                  {severity && conditionMeta.severityLabels?.[severity] && (
                    <p className="text-[11px] text-gray-500 italic">{conditionMeta.severityLabels[severity]}</p>
                  )}
                </div>
              ) : (
                <input type="number" min="0" max="20" value={severity} onChange={(e) => setSeverity(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1A5C7A]/30 focus:border-[#1A5C7A]" />
              )}
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Notas</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 2000))}
              rows={2}
              className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1A5C7A]/30 focus:border-[#1A5C7A] resize-none" />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-500 text-sm font-bold hover:border-gray-300 transition">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 rounded-xl bg-[#1A5C7A] text-white text-sm font-bold hover:bg-[#0e4560] transition disabled:opacity-50">
              {saving ? "Guardando…" : "Registrar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
