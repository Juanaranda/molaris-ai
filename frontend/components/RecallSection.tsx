"use client";

import { useCallback, useEffect, useState } from "react";
import {
  RecallRule, RecallEvent,
  listRecallRules, createRecallRule, updateRecallRule, deleteRecallRule,
  listRecallEvents, triggerRecallCheck,
} from "@/lib/recall";
import { Trash2 } from "lucide-react";
import { Badge, Button, Dialogo, Field } from "@/components/ui";
import { AYUDA_VARIABLES, Seccion } from "@/components/configuracion/Piezas";
import { cx } from "@/lib/cx";

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
  const [borrando, setBorrando] = useState<RecallRule | null>(null);
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

  // Los errores van al aviso de la sección (antes eran un alert() del navegador).
  async function toggleActive(rule: RecallRule) {
    try {
      const updated = await updateRecallRule(clinicId, rule.id, { active: !rule.active });
      setRules((arr) => arr.map((r) => r.id === rule.id ? updated : r));
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
  }

  async function remove(rule: RecallRule) {
    setBorrando(null);
    try {
      await deleteRecallRule(clinicId, rule.id);
      setRules((arr) => arr.filter((r) => r.id !== rule.id));
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
  }

  async function manualTrigger() {
    setTriggering(true); setTriggerMsg("");
    try {
      await triggerRecallCheck(clinicId);
      setTriggerMsg("Revisando… los envíos aparecen abajo en unos segundos.");
      setTimeout(() => { fetchAll(); setTriggerMsg(""); }, 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally { setTriggering(false); }
  }

  return (
    <Seccion id="controles" titulo="Controles por tratamiento"
      descripcion="Después de cierto tratamiento, un WhatsApp para que el paciente vuelva a control."
      mensaje={error ? `No pudimos completar la acción: ${error}` : triggerMsg} mensajeOk={!error}
      acciones={<>
        <Button size="sm" variant="secondary" className="max-sm:min-h-11" loading={triggering} onClick={manualTrigger}>
          {triggering ? "Revisando…" : "Revisar ahora"}
        </Button>
        <Button size="sm" className="max-sm:min-h-11" onClick={() => setCreating(true)}>+ Nueva regla</Button>
      </>}>

      {/* Reglas */}
      <h4 className="mb-2 text-sm font-semibold text-ink">Reglas</h4>
      {loading && rules.length === 0 ? (
        <div className="flex flex-col gap-2" aria-hidden>
          <div className="h-16 rounded-control bg-gray-100" /><div className="h-16 rounded-control bg-gray-100" />
        </div>
      ) : rules.length === 0 ? (
        <p className="rounded-control border border-dashed border-line px-4 py-3 text-sm text-ink-muted">
          Todavía no hay reglas. Crea una para que los pacientes reciban un aviso cuando les toque control.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line-soft rounded-control border border-line">
          {rules.map((r) => (
            <RuleRow key={r.id} rule={r}
              onEdit={() => setEditing(r)}
              onToggle={() => toggleActive(r)}
              onDelete={() => setBorrando(r)} />
          ))}
        </ul>
      )}

      {/* Eventos recientes */}
      <h4 className="mt-6 mb-2 text-sm font-semibold text-ink">
        Últimos envíos {events.length > 0 && <span className="font-normal text-ink-muted tabular-nums">({events.length})</span>}
      </h4>
      {events.length === 0 ? (
        <p className="text-sm text-ink-muted">Todavía no se ha mandado ningún aviso.</p>
      ) : (
        <ul className="max-h-72 divide-y divide-line-soft overflow-y-auto overscroll-contain rounded-control border border-line">
          {events.map((e) => (
            <li key={e.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-3 py-2.5 text-[13px]">
              <p className="min-w-0 truncate font-semibold text-ink">{e.patientName ?? e.patientPhone}</p>
              {e.success ? <Badge tone="ok">Enviado</Badge> : <Badge tone="danger">No se envió</Badge>}
              <p className="col-span-2 text-ink-muted tabular-nums">
                {new Date(e.sentAt).toLocaleDateString("es-CL", { day: "numeric", month: "short" })},{" "}
                {new Date(e.sentAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })} · {e.rule.triggerService}
                {e.patientName && <> · {e.patientPhone}</>}
              </p>
              {!e.success && e.errorMessage && <p className="col-span-2 text-danger">{e.errorMessage}</p>}
            </li>
          ))}
        </ul>
      )}

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

      {borrando && (
        <Dialogo titulo="¿Eliminar esta regla?" ancho="sm" onClose={() => setBorrando(null)}>
          <div className="flex flex-col gap-4 p-5">
            <p className="text-sm text-ink">
              Se deja de mandar el aviso de <span className="font-semibold">{borrando.triggerService}</span>. Los avisos que ya se mandaron siguen en la lista.
              Si solo quieres detenerla un tiempo, usa Pausar.
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setBorrando(null)}>Cancelar</Button>
              <Button variant="danger" onClick={() => remove(borrando)}>Eliminar regla</Button>
            </div>
          </div>
        </Dialogo>
      )}
    </Seccion>
  );
}

function RuleRow({ rule, onEdit, onToggle, onDelete }: {
  rule: RecallRule;
  onEdit: () => void; onToggle: () => void; onDelete: () => void;
}) {
  return (
    <li className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:gap-3">
      <div className={cx("min-w-0 flex-1", !rule.active && "opacity-60")}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-ink">{rule.triggerService}</span>
          <Badge tone="brand">cada {rule.intervalDays} días</Badge>
          {!rule.active && <Badge>Pausada</Badge>}
        </div>
        <p className="mt-0.5 line-clamp-2 text-[13px] text-ink-muted">{rule.messageTemplate}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button size="sm" variant="ghost" className="max-sm:min-h-11" onClick={onToggle}>{rule.active ? "Pausar" : "Activar"}</Button>
        <Button size="sm" variant="ghost" className="max-sm:min-h-11" onClick={onEdit}>Editar</Button>
        <button type="button" onClick={onDelete} aria-label={`Eliminar la regla ${rule.triggerService}`}
          className="grid h-11 w-11 place-items-center rounded-control text-ink-muted transition-colors hover:bg-danger-soft hover:text-danger focus-visible:outline-2 focus-visible:outline-brand sm:h-9 sm:w-9">
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </li>
  );
}

function RuleModal({ clinicId, initial, onClose, onSaved }: {
  clinicId: string; initial: RecallRule | null;
  onClose: () => void; onSaved: (rule: RecallRule) => void;
}) {
  const [service,  setService]  = useState(initial?.triggerService ?? "");
  const [days,     setDays]     = useState<string>(String(initial?.intervalDays ?? 180));
  const [template, setTemplate] = useState(initial?.messageTemplate ?? "Hola {nombre} Te toca tu control en {clinica}. Responde acá para reservar.");
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const intervalDays = Math.round(Number(days));
    if (!service.trim()) { setError("Escribe el tratamiento que activa el aviso."); return; }
    if (!Number.isFinite(intervalDays) || intervalDays < 1 || intervalDays > 730) {
      setError("Los días tienen que ir entre 1 y 730."); return;
    }
    if (!template.trim()) { setError("Escribe el mensaje."); return; }
    setSaving(true); setError("");
    try {
      const rule = initial
        ? await updateRecallRule(clinicId, initial.id, { triggerService: service.trim(), intervalDays, messageTemplate: template.trim() })
        : await createRecallRule(clinicId, { triggerService: service.trim(), intervalDays, messageTemplate: template.trim() });
      onSaved(rule);
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally    { setSaving(false); }
  }

  return (
    <Dialogo titulo={initial ? "Editar regla" : "Nueva regla de control"} capa={70} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4 p-5">
        <Field label="Tratamiento" autoFocus value={service} onChange={(e) => setService(e.target.value)}
          placeholder="Por ejemplo: Limpieza, Ortodoncia, Control endodoncia"
          hint="Se compara con el servicio de la cita, sin importar mayúsculas." />
        <Field label="Días después de la última cita" type="number" inputMode="numeric" min="1" max="730" className="w-32"
          value={days} onChange={(e) => setDays(e.target.value)} />
        <Field multiline label="Mensaje" rows={4} value={template} onChange={(e) => setTemplate(e.target.value.slice(0, 1000))}
          hint={`${AYUDA_VARIABLES} Hasta 1000 caracteres.`} />
        {error && <p role="alert" className="text-[13px] font-semibold text-danger">{error}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={saving}>{saving ? "Guardando…" : initial ? "Guardar" : "Crear regla"}</Button>
        </div>
      </form>
    </Dialogo>
  );
}
