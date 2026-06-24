"use client";

import { useCallback, useEffect, useState } from "react";
import { AuditLogEntry, listAuditLog } from "@/lib/auditLog";

interface Props {
  clinicId: string;
}

const RESOURCE_LABELS: Record<string, string> = {
  ClinicalRecord: "Ficha clínica",
  ClinicalNote:   "Nota clínica",
  DentalEvent:    "Evento dental",
  ToothImage:     "Imagen",
  Identity:       "Datos paciente",
  Boleta:         "Boleta SII",
  Payment:        "Pago",
};

const ACTION_META: Record<string, { label: string; cls: string }> = {
  read:   { label: "👁 Lectura",  cls: "bg-blue-100 text-blue-700" },
  create: { label: "+ Creación",  cls: "bg-emerald-100 text-emerald-700" },
  update: { label: "✎ Edición",   cls: "bg-amber-100 text-amber-800" },
  delete: { label: "✕ Borrado",   cls: "bg-red-100 text-red-700" },
};

/**
 * Sección de audit log médico-legal (Issue #34 — Ley 20.584 / 21.719).
 * Se monta en la tab Configuración (solo ADMIN+). Listado paginado con filtros.
 */
export function AuditLogSection({ clinicId }: Props) {
  const [logs,   setLogs]   = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  // Filtros
  const [filterResource, setFilterResource] = useState("");
  const [filterAction,   setFilterAction]   = useState("");

  const fetchLogs = useCallback(async () => {
    setLoading(true); setError("");
    try {
      setLogs(await listAuditLog(clinicId, {
        resource: filterResource || undefined,
        limit:    200,
      }));
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally     { setLoading(false); }
  }, [clinicId, filterResource]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const filtered = filterAction
    ? logs.filter((l) => l.action === filterAction)
    : logs;

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <div>
          <h2 className="font-semibold text-gray-900">📋 Audit log médico-legal</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Registro de toda lectura/edición de datos sensibles · Ley 20.584 · Retención 15 años
          </p>
        </div>
        <button onClick={fetchLogs} disabled={loading}
          className="text-xs font-bold px-3 py-1.5 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50">
          {loading ? "…" : "↻ Refrescar"}
        </button>
      </div>

      {/* Filtros */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Tipo de recurso</label>
          <select value={filterResource} onChange={(e) => setFilterResource(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1A5C7A]/30 focus:border-[#1A5C7A]">
            <option value="">Todos los recursos</option>
            {Object.entries(RESOURCE_LABELS).map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Acción</label>
          <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1A5C7A]/30 focus:border-[#1A5C7A]">
            <option value="">Todas las acciones</option>
            <option value="read">Lectura</option>
            <option value="create">Creación</option>
            <option value="update">Edición</option>
            <option value="delete">Borrado</option>
          </select>
        </div>
      </div>

      {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

      {/* Tabla */}
      <div className="mt-4">
        {loading && filtered.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">Cargando…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">Sin registros para los filtros seleccionados.</p>
        ) : (
          <div className="bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-white border-b border-gray-100 sticky top-0">
                  <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2">Quién</th>
                    <th className="px-3 py-2">Acción</th>
                    <th className="px-3 py-2">Recurso</th>
                    <th className="px-3 py-2">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((log) => (
                    <RowAndDetail key={log.id} log={log} expanded={expanded === log.id} onToggle={() => setExpanded((e) => e === log.id ? null : log.id)} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {filtered.length > 0 && (
          <p className="text-[10px] text-gray-400 mt-2 text-right">
            Mostrando {filtered.length} registros más recientes
          </p>
        )}
      </div>
    </section>
  );
}

function RowAndDetail({ log, expanded, onToggle }: { log: AuditLogEntry; expanded: boolean; onToggle: () => void }) {
  const action = ACTION_META[log.action] ?? { label: log.action, cls: "bg-gray-100 text-gray-500" };
  const resource = RESOURCE_LABELS[log.resourceType] ?? log.resourceType;
  const hasSnapshot = log.snapshotBefore || log.snapshotAfter;

  return (
    <>
      <tr onClick={hasSnapshot ? onToggle : undefined}
        className={`border-b border-gray-100 last:border-0 ${hasSnapshot ? "cursor-pointer hover:bg-white" : ""}`}>
        <td className="px-3 py-2 text-gray-500 tabular-nums whitespace-nowrap">
          {new Date(log.createdAt).toLocaleDateString("es-CL", { day: "2-digit", month: "short" })}{" "}
          {new Date(log.createdAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </td>
        <td className="px-3 py-2">
          {log.actor ? (
            <>
              <p className="font-semibold text-gray-800 truncate">{log.actor.name}</p>
              <p className="text-[10px] text-gray-400 truncate">{log.actor.email}</p>
            </>
          ) : (
            <span className="text-[10px] italic text-gray-400">sistema</span>
          )}
        </td>
        <td className="px-3 py-2">
          <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${action.cls}`}>
            {action.label}
          </span>
        </td>
        <td className="px-3 py-2">
          <p className="font-semibold text-gray-700">{resource}</p>
          <p className="text-[10px] text-gray-400 font-mono truncate max-w-[180px]">{log.resourceId.slice(0, 12)}…</p>
        </td>
        <td className="px-3 py-2 text-[10px] text-gray-400 font-mono">{log.ip ?? "—"}</td>
      </tr>
      {expanded && hasSnapshot && (
        <tr className="bg-white border-b border-gray-100">
          <td colSpan={5} className="p-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {log.snapshotBefore != null && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Antes</p>
                  <pre className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-[10px] font-mono overflow-x-auto max-h-40">{JSON.stringify(log.snapshotBefore, null, 2)}</pre>
                </div>
              )}
              {log.snapshotAfter != null && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Después</p>
                  <pre className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-[10px] font-mono overflow-x-auto max-h-40">{JSON.stringify(log.snapshotAfter, null, 2)}</pre>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
