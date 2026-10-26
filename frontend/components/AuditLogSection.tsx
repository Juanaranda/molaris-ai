"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { AuditLogEntry, listAuditLog } from "@/lib/auditLog";
import { Badge, Button, Select, type TonoBadge } from "@/components/ui";
import { Seccion } from "@/components/configuracion/Piezas";
import { cx } from "@/lib/cx";

interface Props {
  clinicId: string;
}

const RESOURCE_LABELS: Record<string, string> = {
  ClinicalRecord: "Ficha clínica",
  ClinicalNote:   "Nota clínica",
  DentalEvent:    "Odontograma",
  ToothImage:     "Imagen",
  Identity:       "Datos del paciente",
  Boleta:         "Boleta SII",
  Payment:        "Pago",
};

const ACTION_META: Record<string, { label: string; tone: TonoBadge }> = {
  read:   { label: "Vio",    tone: "brand" },
  create: { label: "Creó",   tone: "ok" },
  update: { label: "Cambió", tone: "warn" },
  delete: { label: "Borró",  tone: "danger" },
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
    <Seccion id="accesos" titulo="Registro de accesos"
      descripcion="Quién vio o cambió datos de pacientes, y cuándo (Ley 20.584)."
      mensaje={error ? `No pudimos cargar el registro: ${error}` : undefined}
      acciones={
        <Button size="sm" variant="secondary" className="max-sm:min-h-11" loading={loading} onClick={fetchLogs}>
          {loading ? "Actualizando…" : "Actualizar"}
        </Button>
      }>
      <div className="grid gap-3 sm:grid-cols-2">
        <Select label="Qué dato" value={filterResource} onChange={(e) => setFilterResource(e.target.value)}>
          <option value="">Todos</option>
          {Object.entries(RESOURCE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </Select>
        <Select label="Qué hizo" value={filterAction} onChange={(e) => setFilterAction(e.target.value)}>
          <option value="">Todo</option>
          {Object.entries(ACTION_META).map(([k, a]) => <option key={k} value={k}>{a.label}</option>)}
        </Select>
      </div>

      <div className="mt-4">
        {loading && filtered.length === 0 ? (
          <div className="flex flex-col gap-2" aria-hidden>
            <div className="h-12 rounded-control bg-gray-100" /><div className="h-12 rounded-control bg-gray-100" /><div className="h-12 rounded-control bg-gray-100" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="rounded-control border border-dashed border-line px-4 py-3 text-sm text-ink-muted">
            No hay registros con estos filtros.
          </p>
        ) : (
          <>
            <ul className="max-h-[28rem] divide-y divide-line-soft overflow-y-auto overscroll-contain rounded-control border border-line">
              {filtered.map((log) => (
                <Fila key={log.id} log={log} expanded={expanded === log.id}
                  onToggle={() => setExpanded((e) => e === log.id ? null : log.id)} />
              ))}
            </ul>
            <p className="mt-2 text-right text-[13px] text-ink-muted tabular-nums">
              {filtered.length === 1 ? "El registro más reciente" : `Los ${filtered.length} registros más recientes`}
            </p>
          </>
        )}
      </div>
    </Seccion>
  );
}

function Fila({ log, expanded, onToggle }: { log: AuditLogEntry; expanded: boolean; onToggle: () => void }) {
  const action = ACTION_META[log.action] ?? { label: log.action, tone: "neutral" as TonoBadge };
  const resource = RESOURCE_LABELS[log.resourceType] ?? log.resourceType;
  const hasSnapshot = log.snapshotBefore != null || log.snapshotAfter != null;
  const fecha = new Date(log.createdAt);

  const contenido = (
    <>
      <span className="text-ink-muted tabular-nums sm:w-36 sm:shrink-0">
        {fecha.toLocaleDateString("es-CL", { day: "numeric", month: "short" })},{" "}
        {fecha.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold text-ink">{log.actor?.name ?? "El sistema"}</span>
          <Badge tone={action.tone}>{action.label}</Badge>
          <span className="text-ink">{resource}</span>
        </span>
        <span className="block truncate text-ink-muted">
          {log.actor?.email ?? "Automático"} · <span className="font-mono">{log.resourceId.slice(0, 12)}…</span>
          {log.ip && <> · IP <span className="font-mono">{log.ip}</span></>}
        </span>
      </span>
    </>
  );

  return (
    <li className="text-[13px]">
      {hasSnapshot ? (
        <button type="button" onClick={onToggle} aria-expanded={expanded}
          className="flex w-full flex-col gap-1 px-3 py-2.5 text-left transition-colors hover:bg-ground focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand sm:flex-row sm:items-center sm:gap-3">
          {contenido}
          <span className="flex items-center gap-1 font-semibold text-brand sm:shrink-0">
            {expanded ? "Ocultar cambio" : "Ver cambio"}
            <ChevronDown className={cx("h-4 w-4 transition-transform", expanded && "rotate-180")} aria-hidden />
          </span>
        </button>
      ) : (
        <div className="flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3">{contenido}</div>
      )}
      {expanded && hasSnapshot && (
        <div className="grid gap-3 border-t border-line-soft bg-ground px-3 py-3 md:grid-cols-2">
          {log.snapshotBefore != null && (
            <div className="min-w-0">
              <p className="mb-1 font-semibold text-ink">Antes</p>
              <pre className="max-h-40 overflow-auto rounded-control border border-line bg-surface p-2 font-mono text-xs text-ink">{JSON.stringify(log.snapshotBefore, null, 2)}</pre>
            </div>
          )}
          {log.snapshotAfter != null && (
            <div className="min-w-0">
              <p className="mb-1 font-semibold text-ink">Después</p>
              <pre className="max-h-40 overflow-auto rounded-control border border-line bg-surface p-2 font-mono text-xs text-ink">{JSON.stringify(log.snapshotAfter, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
