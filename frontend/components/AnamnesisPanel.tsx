"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getMe } from "@/lib/auth";
import {
  AnamnesisQuestion, AnamnesisSection, AnamnesisResponse, AnamnesisTemplate,
  getActiveTemplate, listAnamnesisResponses, submitAnamnesisResponse,
  SECTION_LABELS,
} from "@/lib/anamnesis";
import { TriangleAlert } from "lucide-react";
import { Button, CLASE_CAMPO } from "@/components/ui";
import { cx } from "@/lib/cx";

interface Props {
  patientId: string;
}

const SECTION_ORDER: AnamnesisSection[] = ["medical", "allergies", "medications", "lifestyle", "dental"];

/**
 * Panel de anamnesis estructurada (Issue #35).
 * Form dinámico generado desde el template activo de la clínica.
 * Las respuestas son inmutables — actualizar = crear nueva respuesta vinculada
 * a la versión del template usada.
 */
export function AnamnesisPanel({ patientId }: Props) {
  const [template,  setTemplate]  = useState<AnamnesisTemplate | null>(null);
  const [responses, setResponses] = useState<AnamnesisResponse[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");
  const [editing,   setEditing]   = useState(false);
  const [form,      setForm]      = useState<Record<string, unknown>>({});
  const [saving,    setSaving]    = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const me = await getMe();
      if (!me?.clinic?.id) throw new Error("Sin clínica activa");
      const [tpl, resps] = await Promise.all([
        getActiveTemplate(me.clinic.id),
        listAnamnesisResponses(patientId),
      ]);
      setTemplate(tpl);
      setResponses(resps);
      const last = resps[0];
      if (last) {
        setForm(last.answers as Record<string, unknown>);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally     { setLoading(false); }
  }, [patientId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const latest    = responses[0];
  const bySection = useMemo(() => {
    const map: Record<AnamnesisSection, AnamnesisQuestion[]> = {
      medical: [], allergies: [], medications: [], lifestyle: [], dental: [],
    };
    template?.questions.forEach((q) => map[q.section].push(q));
    return map;
  }, [template]);

  const activeRedFlags = useMemo(() => {
    if (!template) return [];
    const flags: { code: string; label: string; section: AnamnesisSection }[] = [];
    template.questions.forEach((q) => {
      if (!q.redFlag) return;
      const v = form[q.code];
      if (v === true || (typeof v === "string" && v.trim() !== "") || (typeof v === "number" && v > 0)) {
        flags.push({ code: q.code, label: q.label, section: q.section });
      }
    });
    return flags;
  }, [template, form]);

  async function save() {
    setSaving(true); setError("");
    try {
      await submitAnamnesisResponse(patientId, form);
      await fetchAll();
      setEditing(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally    { setSaving(false); }
  }

  if (loading) return (
    <div className="flex flex-col gap-3" aria-hidden>
      <div className="h-16 rounded-card bg-gray-100" /><div className="h-48 rounded-card bg-gray-100" />
    </div>
  );
  if (error) return (
    <div className="rounded-card border border-line bg-surface px-5 py-4 text-sm text-ink">
      <p className="font-semibold">No pudimos cargar la anamnesis: {error}.</p>
      <Button size="sm" variant="secondary" className="mt-3 max-sm:min-h-11" onClick={fetchAll}>Reintentar</Button>
    </div>
  );
  if (!template) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-brand-strong">Anamnesis</h3>
          <p className="text-[13px] text-ink-muted">
            {latest
              ? <>Última respuesta el {new Date(latest.completedAt).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })}, por {latest.recordedBy.name} · plantilla v{template.version}</>
              : <>Todavía no se ha respondido · plantilla v{template.version}</>}
          </p>
        </div>
        {!editing ? (
          <Button size="sm" className="max-sm:min-h-11" onClick={() => setEditing(true)}>
            {latest ? "Actualizar respuestas" : "Llenar anamnesis"}
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" className="max-sm:min-h-11" disabled={saving}
              onClick={() => { setEditing(false); if (latest) setForm(latest.answers as Record<string, unknown>); }}>Cancelar</Button>
            <Button size="sm" className="max-sm:min-h-11" onClick={save} loading={saving}>{saving ? "Guardando…" : "Guardar respuesta"}</Button>
          </div>
        )}
      </div>
      {editing && latest && (
        <p className="text-[13px] text-ink-muted">Al guardar se crea una respuesta nueva con tu nombre y la fecha; la anterior queda en el historial.</p>
      )}

      {/* Alertas: lo que cambia cómo se atiende al paciente */}
      {activeRedFlags.length > 0 && (
        <div role="note" aria-label="Alertas de la anamnesis" className="flex flex-wrap items-start gap-x-3 gap-y-2 rounded-control border border-danger/25 bg-danger-soft px-3.5 py-2.5">
          <span className="flex items-center gap-1.5 text-sm font-bold text-danger">
            <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden /> Alertas ({activeRedFlags.length})
          </span>
          <ul className="flex flex-wrap gap-x-3 gap-y-1">
            {activeRedFlags.map((f) => (
              <li key={f.code} className="text-sm font-semibold text-ink">{f.label.replace(/^¿/, "").replace(/\?$/, "")}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {SECTION_ORDER.map((section) => {
          const questions = bySection[section];
          if (questions.length === 0) return null;
          return (
            <section key={section} className="rounded-card border border-line bg-surface px-5 pt-4 pb-2">
              <h4 className="mb-1 text-base font-bold text-brand-strong">{SECTION_LABELS[section]}</h4>
              <div>
                {questions.map((q) => (
                  <QuestionField key={q.code} q={q}
                    value={form[q.code]}
                    editing={editing}
                    onChange={(v) => setForm({ ...form, [q.code]: v })} />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {responses.length > 1 && (
        <details className="rounded-card border border-line bg-surface px-5 py-3">
          <summary className="min-h-11 cursor-pointer content-center text-sm font-bold text-brand-strong">
            Respuestas anteriores ({responses.length})
          </summary>
          <ul className="mt-2">
            {responses.map((r) => (
              <li key={r.id} className="grid grid-cols-[110px_minmax(0,1fr)_auto] gap-3 border-t border-line-soft py-2 text-[13px] first:border-t-0">
                <span className="text-ink tabular-nums">{new Date(r.completedAt).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" })}</span>
                <span className="truncate text-ink">{r.recordedBy.name}</span>
                <span className="text-ink-muted tabular-nums">v{r.templateVersion} · {r.redFlags.length} {r.redFlags.length === 1 ? "alerta" : "alertas"}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function QuestionField({ q, value, editing, onChange }: {
  q: AnamnesisQuestion; value: unknown; editing: boolean; onChange: (v: unknown) => void;
}) {
  const isRedFlagActive = Boolean(q.redFlag && (value === true || (typeof value === "string" && value.trim()) || (typeof value === "number" && value > 0)));
  const opcion = (activa: boolean) => cx(
    "min-h-11 rounded-control border px-3.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-brand sm:min-h-9",
    activa ? "border-brand bg-brand-soft text-brand-ink" : "border-line bg-surface text-ink hover:border-brand",
  );

  return (
    <div className="grid gap-x-4 gap-y-1.5 border-t border-line-soft py-2.5 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <p className="flex items-start gap-1.5 text-sm text-ink">
        {q.redFlag && <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-muted" aria-label="Pregunta de alerta" />}
        <span>{q.label}</span>
      </p>
      {editing ? (
        q.type === "boolean" ? (
          <div role="group" aria-label={q.label} className="flex gap-1.5">
            {[[true, "Sí"], [false, "No"]].map(([v, label]) => (
              <button key={String(v)} type="button" aria-pressed={value === v} onClick={() => onChange(v)} className={opcion(value === v)}>
                {String(label)}
              </button>
            ))}
          </div>
        ) : q.type === "number" ? (
          <input type="number" inputMode="numeric" aria-label={q.label} value={(value as number) ?? ""}
            onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} className={cx(CLASE_CAMPO, "sm:w-32")} />
        ) : q.type === "multiselect" ? (
          <div role="group" aria-label={q.label} className="flex flex-wrap gap-1.5 sm:col-span-2">
            {(q.options ?? []).map((opt) => {
              const current = (value as string[] | undefined) ?? [];
              const sel = current.includes(opt);
              return (
                <button key={opt} type="button" aria-pressed={sel} className={opcion(sel)}
                  onClick={() => onChange(sel ? current.filter((x) => x !== opt) : [...current, opt])}>{opt}</button>
              );
            })}
          </div>
        ) : (
          <textarea rows={2} aria-label={q.label} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)}
            className={cx(CLASE_CAMPO, "min-h-20 py-2 sm:col-span-2")} />
        )
      ) : (
        <p className={cx("text-sm sm:text-right", isRedFlagActive ? "font-bold text-danger" : value === true || value === false ? "font-semibold text-ink" : "text-ink")}>
          {value === true ? "Sí"
           : value === false ? "No"
           : value === null || value === undefined || value === "" ? <span className="font-normal text-ink-muted">Sin respuesta</span>
           : Array.isArray(value) ? value.join(", ")
           : String(value)}
        </p>
      )}
    </div>
  );
}
