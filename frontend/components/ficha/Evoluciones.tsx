import { useState } from "react";
import { Badge, Button, Dialogo, Field, Select } from "@/components/ui";
import { createClinicalNote, type ClinicalNote, type ClinicalRecord } from "@/lib/clinicalRecord";

const CATEGORIA: Record<string, string> = {
  urgencia: "Urgencia", dolor: "Dolor", control: "Control", estetica: "Estética", derivacion: "Derivación", otro: "Otro",
};

/* ─── Evoluciones: las notas clínicas, de la más nueva a la más antigua ── */
export function SesionesTab({ record, patientId, onCreated }: { record: ClinicalRecord; patientId: string; onCreated: () => void }) {
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-brand-strong">Evoluciones</h3>
          <p className="text-[13px] text-ink-muted">Cada nota queda con su autor y su fecha, y no se edita: para corregir, se agrega una nueva.</p>
        </div>
        <Button size="sm" className="max-sm:min-h-11" onClick={() => setShowAdd(true)}>+ Nueva evolución</Button>
      </div>

      {record.clinicalNotes.length === 0 ? (
        <p className="rounded-card border border-dashed border-line bg-surface px-5 py-6 text-sm text-ink-muted">
          Todavía no hay evoluciones en esta ficha.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {record.clinicalNotes.map((n) => <NoteCard key={n.id} note={n} />)}
        </ol>
      )}

      {showAdd && (
        <AddNoteModal
          patientId={patientId}
          onClose={() => setShowAdd(false)}
          onCreated={() => { setShowAdd(false); onCreated(); }}
        />
      )}
    </div>
  );
}

function NoteCard({ note }: { note: ClinicalNote }) {
  const campos: [string, string | null][] = [
    ["Motivo", note.reason],
    ["Hallazgos", note.findings],
    ["Procedimientos", note.procedures],
    ["Indicaciones", note.prescriptions],
    ["Próxima visita", note.nextVisitPlan],
  ];
  return (
    <li className="rounded-card border border-line bg-surface p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-ink">
            {new Date(note.occurredAt).toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
          <p className="text-[13px] text-ink-muted">
            {note.professional.name}{note.professional.occupation ? ` · ${note.professional.occupation}` : ""}
          </p>
        </div>
        {note.reasonCategory && <Badge tone="brand">{CATEGORIA[note.reasonCategory] ?? note.reasonCategory}</Badge>}
      </div>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {campos.filter(([, v]) => v).map(([label, value]) => (
          <div key={label}>
            <dt className="text-[13px] text-ink-muted">{label}</dt>
            <dd className="text-sm whitespace-pre-wrap text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </li>
  );
}

function AddNoteModal({ patientId, onClose, onCreated }: { patientId: string; onClose: () => void; onCreated: () => void }) {
  const [reason, setReason]                 = useState("");
  const [reasonCategory, setReasonCategory] = useState<string>("");
  const [findings, setFindings]             = useState("");
  const [procedures, setProcedures]         = useState("");
  const [prescriptions, setPrescriptions]   = useState("");
  const [nextVisitPlan, setNextVisitPlan]   = useState("");
  const [saving, setSaving]                 = useState(false);
  const [err,    setErr]                    = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setErr("");
    try {
      await createClinicalNote(patientId, {
        reason: reason.trim() || undefined,
        reasonCategory: (reasonCategory || undefined) as "urgencia" | "dolor" | "control" | "estetica" | "derivacion" | "otro" | undefined,
        findings: findings.trim() || undefined,
        procedures: procedures.trim() || undefined,
        prescriptions: prescriptions.trim() || undefined,
        nextVisitPlan: nextVisitPlan.trim() || undefined,
      });
      onCreated();
    } catch (e) { setErr(e instanceof Error ? e.message : "Error"); }
    finally    { setSaving(false); }
  }

  const vacia = !reason && !findings && !procedures;

  return (
    <Dialogo titulo="Nueva evolución" onClose={onClose} ancho="lg" capa={70}>
      <form onSubmit={submit} className="flex flex-col gap-4 px-5 py-5">
        <Field multiline label="Motivo de consulta" rows={2} value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="Ej: dolor en muela superior derecha" />
        <Select label="Categoría" value={reasonCategory} onChange={(e) => setReasonCategory(e.target.value)}>
          <option value="">Sin categoría</option>
          {Object.entries(CATEGORIA).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
        <Field multiline label="Hallazgos o diagnóstico" rows={2} value={findings} onChange={(e) => setFindings(e.target.value)} />
        <Field multiline label="Procedimientos realizados" rows={2} value={procedures} onChange={(e) => setProcedures(e.target.value)} />
        <Field multiline label="Indicaciones o recetas" rows={2} value={prescriptions} onChange={(e) => setPrescriptions(e.target.value)} />
        <Field multiline label="Plan para la próxima visita" rows={2} value={nextVisitPlan} onChange={(e) => setNextVisitPlan(e.target.value)} />
        {err && <p role="alert" className="text-sm font-semibold text-danger">{err}</p>}
        <p className="text-[13px] text-ink-muted">
          La nota no se puede editar después (Decreto 41 del MINSAL). Si hay que corregir algo, se agrega otra nota.
        </p>
        {vacia && <p className="text-[13px] text-ink-muted">Escribe al menos el motivo, los hallazgos o los procedimientos para guardarla.</p>}
        <div className="flex gap-2 pt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="flex-1" loading={saving} disabled={vacia}>{saving ? "Guardando…" : "Guardar evolución"}</Button>
        </div>
      </form>
    </Dialogo>
  );
}

/* ─── Imágenes ─────────────────────────────────────────────────────────── */
export function ImagenesTab({ record }: { record: ClinicalRecord }) {
  if (record.images.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-line bg-surface px-5 py-6 text-sm text-ink-muted">
        Todavía no hay imágenes. Las radiografías y fotos se suben desde el odontograma, en la pieza que corresponde.
      </p>
    );
  }
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {record.images.map((img) => (
        <li key={img.id}>
          <a href={img.url} target="_blank" rel="noopener noreferrer"
            className="block overflow-hidden rounded-card border border-line bg-surface transition-colors hover:border-brand focus-visible:outline-2 focus-visible:outline-brand">
            <img src={img.url} alt={img.toothFDI ? `${img.imageType} de la pieza ${img.toothFDI}` : img.imageType}
              width={320} height={128} loading="lazy" className="h-32 w-full object-cover" />
            <span className="block p-2.5">
              <span className="block text-[13px] font-semibold text-ink">{img.toothFDI ? `Pieza ${img.toothFDI}` : img.imageType}</span>
              <span className="block text-xs text-ink-muted tabular-nums">{new Date(img.takenAt).toLocaleDateString("es-CL")}</span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
