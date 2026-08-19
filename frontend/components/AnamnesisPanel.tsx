"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getMe } from "@/lib/auth";
import {
  AnamnesisQuestion, AnamnesisSection, AnamnesisResponse, AnamnesisTemplate,
  getActiveTemplate, listAnamnesisResponses, submitAnamnesisResponse,
  SECTION_LABELS,
} from "@/lib/anamnesis";
import { TriangleAlert } from "lucide-react";

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

  if (loading) return <div className="py-8 text-sm text-gray-400 text-center">Cargando anamnesis…</div>;
  if (error)   return <div className="py-8 text-sm text-red-500 text-center">{error}</div>;
  if (!template) return null;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Anamnesis estructurada</h3>
          <p className="text-[11px] text-gray-400">
            Template v{template.version}
            {latest && <span> · Última: {new Date(latest.completedAt).toLocaleDateString("es-CL")} por {latest.recordedBy.name}</span>}
            {!latest && <span> · Sin respuestas previas</span>}
          </p>
        </div>
        {!editing ? (
          <button onClick={() => setEditing(true)}
            className="text-xs font-bold px-3 py-1.5 rounded-xl bg-[#1A5C7A] text-white hover:bg-[#0e4560] transition">
            {latest ? "Actualizar respuestas" : "Llenar anamnesis"}
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => { setEditing(false); if (latest) setForm(latest.answers as Record<string, unknown>); }} disabled={saving}
              className="text-xs font-bold px-3 py-1.5 rounded-xl border border-gray-200 text-gray-500 hover:border-gray-300">Cancelar</button>
            <button onClick={save} disabled={saving}
              className="text-xs font-bold px-3 py-1.5 rounded-xl bg-[#1A5C7A] text-white hover:bg-[#0e4560] disabled:opacity-50">
              {saving ? "Guardando…" : "Guardar respuesta"}
            </button>
          </div>
        )}
      </div>

      {/* Banner red flags */}
      {activeRedFlags.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-2">
            <TriangleAlert className="w-4 h-4 inline-block align-[-3px]" aria-hidden /> Alertas críticas ({activeRedFlags.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {activeRedFlags.map((f) => (
              <span key={f.code} className="text-[11px] font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-900">
                {f.label.replace(/^¿/, "").replace(/\?$/, "")}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Form por sección */}
      <div className="flex flex-col gap-4">
        {SECTION_ORDER.map((section) => {
          const questions = bySection[section];
          if (questions.length === 0) return null;
          return (
            <div key={section} className="bg-white rounded-2xl border border-gray-100 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">{SECTION_LABELS[section]}</h4>
              <div className="flex flex-col gap-3">
                {questions.map((q) => (
                  <QuestionField key={q.code} q={q}
                    value={form[q.code]}
                    editing={editing}
                    onChange={(v) => setForm({ ...form, [q.code]: v })} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Historial */}
      {responses.length > 1 && (
        <details className="bg-white rounded-2xl border border-gray-100 p-4">
          <summary className="text-xs font-bold uppercase tracking-wider text-gray-500 cursor-pointer">
            Historial de respuestas ({responses.length})
          </summary>
          <div className="mt-3 flex flex-col gap-2">
            {responses.map((r) => (
              <div key={r.id} className="text-[11px] text-gray-500 flex items-center justify-between gap-2 py-1 border-b border-gray-50 last:border-0">
                <span>{new Date(r.completedAt).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" })}</span>
                <span>{r.recordedBy.name}</span>
                <span className="text-[10px]">v{r.templateVersion} · {r.redFlags.length} flags</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function QuestionField({ q, value, editing, onChange }: {
  q: AnamnesisQuestion; value: unknown; editing: boolean; onChange: (v: unknown) => void;
}) {
  const isRedFlagActive = Boolean(q.redFlag && (value === true || (typeof value === "string" && value.trim()) || (typeof value === "number" && value > 0)));

  return (
    <div className={`flex items-start gap-3 p-2 rounded-lg ${isRedFlagActive ? "bg-amber-50 border border-amber-100" : ""}`}>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 flex items-center gap-1.5">
          {q.label}
          {q.redFlag && <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded"><TriangleAlert className="w-4 h-4" aria-hidden /></span>}
        </p>
        {editing ? (
          q.type === "boolean" ? (
            <div className="flex gap-1.5 mt-1.5">
              {[[true, "Sí"], [false, "No"]].map(([v, label]) => (
                <button key={String(v)} type="button" onClick={() => onChange(v)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg border transition ${
                    value === v
                      ? "bg-[#1A5C7A] text-white border-[#1A5C7A]"
                      : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                  }`}>{String(label)}</button>
              ))}
            </div>
          ) : q.type === "number" ? (
            <input type="number" value={(value as number) ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
              className="mt-1.5 w-full px-3 py-1.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1A5C7A]/30 focus:border-[#1A5C7A]" />
          ) : q.type === "multiselect" ? (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {(q.options ?? []).map((opt) => {
                const current = (value as string[] | undefined) ?? [];
                const sel = current.includes(opt);
                return (
                  <button key={opt} type="button"
                    onClick={() => onChange(sel ? current.filter((x) => x !== opt) : [...current, opt])}
                    className={`px-2 py-1 text-xs font-bold rounded-lg border ${
                      sel ? "bg-[#1A5C7A] text-white border-[#1A5C7A]" : "bg-white text-gray-500 border-gray-200"
                    }`}>{opt}</button>
                );
              })}
            </div>
          ) : (
            <textarea rows={2} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)}
              className="mt-1.5 w-full px-3 py-1.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1A5C7A]/30 focus:border-[#1A5C7A] resize-none" />
          )
        ) : (
          <p className="text-xs text-gray-500 mt-0.5">
            {value === true ? "Sí"
             : value === false ? "No"
             : value === null || value === undefined || value === "" ? <span className="text-gray-300">—</span>
             : Array.isArray(value) ? value.join(", ")
             : String(value)}
          </p>
        )}
      </div>
    </div>
  );
}
