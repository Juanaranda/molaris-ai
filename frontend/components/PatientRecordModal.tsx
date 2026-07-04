"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ClinicalRecord, ClinicalNote,
  getClinicalRecord, createClinicalNote, updateIdentity, updateInsurance,
  getPatientAccount, registerPatientPayment, PatientAccount,
} from "@/lib/clinicalRecord";
import { OdontogramPanel } from "@/components/OdontogramPanel";
import { AnamnesisPanel } from "@/components/AnamnesisPanel";
import { ConsentsPanel } from "@/components/ConsentsPanel";

interface Props {
  patientId: string;
  onClose: () => void;
}

type Tab = "resumen" | "anamnesis" | "odontograma" | "sesiones" | "imagenes" | "consentimientos";

export function PatientRecordModal({ patientId, onClose }: Props) {
  const [record, setRecord] = useState<ClinicalRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [tab,     setTab]     = useState<Tab>("resumen");

  const fetchRecord = useCallback(async () => {
    setLoading(true); setError("");
    try { setRecord(await getClinicalRecord(patientId)); }
    catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally   { setLoading(false); }
  }, [patientId]);

  useEffect(() => { fetchRecord(); }, [fetchRecord]);

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-stretch sm:items-center justify-center sm:p-2">
      <div className="bg-white rounded-none sm:rounded-2xl shadow-2xl w-full sm:w-[98vw] sm:max-w-[1600px] flex flex-col h-screen sm:h-[98vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-gray-900 truncate">
              {record?.identity ? `${record.identity.firstName} ${record.identity.lastName}` : (record?.patient.name ?? "Ficha clínica")}
            </h2>
            {record?.identity?.rut && (
              <p className="text-[11px] text-gray-400">RUT {record.identity.rut}</p>
            )}
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-700 text-lg leading-none">✕</button>
        </div>

        {/* Alerts banner */}
        {record && record.alerts.length > 0 && (
          <div className="px-5 py-2 bg-amber-50 border-b border-amber-100 flex flex-wrap gap-2">
            {record.alerts.map((a, i) => (
              <span key={i} className="text-[11px] font-semibold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full">{a}</span>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-100 shrink-0 overflow-x-auto">
          <div className="flex gap-1 px-5">
            {(["resumen","anamnesis","odontograma","sesiones","imagenes","consentimientos"] as Tab[]).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-2.5 text-xs sm:text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap capitalize ${
                  tab === t
                    ? "border-[#1A5C7A] text-[#1A5C7A]"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}>
                {t === "odontograma" ? "Odontograma" : t === "imagenes" ? "Imágenes" : t === "consentimientos" ? "Consentimientos" : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading && <div className="text-center text-sm text-gray-400 py-10">Cargando ficha…</div>}
          {error   && <div className="text-center text-sm text-red-500 py-10">{error}</div>}
          {record && !loading && (
            <>
              {tab === "resumen"     && <ResumenTab record={record} patientId={patientId} onRefresh={fetchRecord} />}
              {tab === "anamnesis"   && <AnamnesisPanel patientId={patientId} />}
              {tab === "odontograma" && <OdontogramPanel patientId={patientId} />}
              {tab === "sesiones"    && <SesionesTab record={record} patientId={patientId} onCreated={fetchRecord} />}
              {tab === "imagenes"    && <ImagenesTab record={record} />}
              {tab === "consentimientos" && <ConsentsPanel patientId={patientId} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Tab: Resumen ─────────────────────────────────────────────────────── */
function ResumenTab({ record, patientId, onRefresh }: { record: ClinicalRecord; patientId: string; onRefresh: () => void }) {
  const id = record.identity;
  const pu = record.patientUser;
  const [editing, setEditing] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState("");
  const [form, setForm] = useState({
    email:   id?.email ?? "",
    phone:   id?.phone ?? "",
    birthDate: id?.birthDate ? id.birthDate.slice(0, 10) : "",
    gender:  id?.gender ?? "",
    address: id?.address ?? "",
    emergencyContactName:     id?.emergencyContactName ?? "",
    emergencyContactPhone:    id?.emergencyContactPhone ?? "",
    emergencyContactRelation: id?.emergencyContactRelation ?? "",
  });
  const [ins, setIns] = useState({
    insuranceProvider: pu?.insuranceProvider ?? "",
    insuranceTier:     pu?.insuranceTier ?? "",
    insuranceCompany:  pu?.insuranceCompany ?? "",
    marketingImagesConsent: pu?.marketingImagesConsent ?? false,
  });

  async function save() {
    if (!id) return;
    setSaving(true); setErr("");
    try {
      await updateIdentity(patientId, {
        email: form.email || null,
        phone: form.phone || null,
        birthDate: form.birthDate || null,
        gender: form.gender || null,
        address: form.address || null,
        emergencyContactName: form.emergencyContactName || null,
        emergencyContactPhone: form.emergencyContactPhone || null,
        emergencyContactRelation: form.emergencyContactRelation || null,
      });
      if (pu) {
        await updateInsurance(patientId, {
          insuranceProvider: (ins.insuranceProvider || null) as "fonasa" | "isapre" | "particular" | "otro" | null,
          insuranceTier:     ins.insuranceTier || null,
          insuranceCompany:  ins.insuranceCompany || null,
          marketingImagesConsent: ins.marketingImagesConsent,
        });
      }
      setEditing(false);
      onRefresh();
    } catch (e) { setErr(e instanceof Error ? e.message : "Error"); }
    finally    { setSaving(false); }
  }

  const age = id?.birthDate ? calculateAge(id.birthDate) : null;
  const isMinor = age !== null && age < 18;

  return (
    <div className="flex flex-col gap-5">
      {/* Header con edit */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900">Datos personales</h3>
        {!editing ? (
          <button onClick={() => setEditing(true)} className="text-xs font-bold px-3 py-1.5 rounded-xl bg-[#1A5C7A] text-white hover:bg-[#0e4560] transition">
            Editar
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} disabled={saving}
              className="text-xs font-bold px-3 py-1.5 rounded-xl border border-gray-200 text-gray-500 hover:border-gray-300">Cancelar</button>
            <button onClick={save} disabled={saving}
              className="text-xs font-bold px-3 py-1.5 rounded-xl bg-[#1A5C7A] text-white hover:bg-[#0e4560] disabled:opacity-50">
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        )}
      </div>
      {err && <p className="text-xs text-red-500">{err}</p>}

      {/* Datos personales */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <KV label="Edad" value={age != null ? `${age} años${isMinor ? " (menor)" : ""}` : "—"} />
        <Field label="Nac." editing={editing} type="date" value={form.birthDate} onChange={(v) => setForm({ ...form, birthDate: v })} displayValue={id?.birthDate ? new Date(id.birthDate).toLocaleDateString("es-CL") : "—"} />
        <FieldSelect label="Género" editing={editing} value={form.gender} onChange={(v) => setForm({ ...form, gender: v })} options={[["", "—"], ["M","Masculino"], ["F","Femenino"], ["X","Otro/X"], ["no_responde","No responde"]]} displayValue={GENDER_LABEL[form.gender] ?? "—"} />
        <Field label="Email" editing={editing} value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
        <Field label="Teléfono" editing={editing} value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
        <Field label="Domicilio" editing={editing} value={form.address} onChange={(v) => setForm({ ...form, address: v })} fullWidth />
      </div>

      {/* Tutor para menores */}
      {isMinor && id?.guardian && (
        <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-violet-700 mb-2">Tutor / Responsable legal</h3>
          <p className="text-sm font-semibold text-gray-800">{id.guardian.firstName} {id.guardian.lastName}</p>
          <p className="text-xs text-gray-500">RUT {id.guardian.rut} · {id.guardian.phone ?? "sin teléfono"}</p>
        </div>
      )}

      {/* Contacto de emergencia */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Contacto de emergencia</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Nombre" editing={editing} value={form.emergencyContactName} onChange={(v) => setForm({ ...form, emergencyContactName: v })} />
          <Field label="Teléfono" editing={editing} value={form.emergencyContactPhone} onChange={(v) => setForm({ ...form, emergencyContactPhone: v })} />
          <Field label="Parentesco" editing={editing} value={form.emergencyContactRelation} onChange={(v) => setForm({ ...form, emergencyContactRelation: v })} />
        </div>
      </div>

      {/* Previsión */}
      {pu && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Previsión</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FieldSelect label="Tipo" editing={editing} value={ins.insuranceProvider} onChange={(v) => setIns({ ...ins, insuranceProvider: v })}
              options={[["","—"],["fonasa","Fonasa"],["isapre","Isapre"],["particular","Particular"],["otro","Otro"]]}
              displayValue={INS_LABEL[ins.insuranceProvider] ?? "—"} />
            {ins.insuranceProvider === "fonasa" && (
              <FieldSelect label="Tramo" editing={editing} value={ins.insuranceTier} onChange={(v) => setIns({ ...ins, insuranceTier: v })}
                options={[["","—"],["A","A"],["B","B"],["C","C"],["D","D"]]} displayValue={ins.insuranceTier || "—"} />
            )}
            {ins.insuranceProvider === "isapre" && (
              <Field label="Isapre" editing={editing} value={ins.insuranceCompany} onChange={(v) => setIns({ ...ins, insuranceCompany: v })} />
            )}
          </div>
          {editing && (
            <label className="mt-3 flex items-center gap-2 text-xs text-gray-600">
              <input type="checkbox" checked={ins.marketingImagesConsent} onChange={(e) => setIns({ ...ins, marketingImagesConsent: e.target.checked })} />
              Autoriza uso de imágenes con fines de marketing (Ley 21.719)
            </label>
          )}
          {!editing && pu.marketingImagesConsent && (
            <p className="mt-3 text-[11px] text-emerald-600">✓ Autoriza uso de imágenes con fines de marketing</p>
          )}
        </div>
      )}

      {/* Actividad */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        <Mini label="Notas clínicas" value={record.clinicalNotes.length} />
        <Mini label="Piezas con eventos" value={Object.keys(record.odontogram).length} />
        <Mini label="Imágenes" value={record.images.length} />
        <Mini label="Enrolado" value={pu ? new Date(pu.enrolledAt).toLocaleDateString("es-CL") : "—"} small />
      </div>

      {/* Cuenta corriente (Issue #43) */}
      {id && id.rut && <AccountCard rut={id.rut} />}
    </div>
  );
}

/* ─── Cuenta corriente ─────────────────────────────────────────────────── */
const fmtCLP = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");
const PAY_METHODS: [string, string][] = [["cash", "Efectivo"], ["transfer", "Transferencia"], ["card", "Tarjeta"], ["other", "Otro"]];

function AccountCard({ rut }: { rut: string }) {
  const [account, setAccount] = useState<PatientAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding]   = useState(false);
  const [amount, setAmount]   = useState("");
  const [method, setMethod]   = useState("cash");
  const [saving, setSaving]   = useState(false);
  const [error,  setError]    = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setAccount(await getPatientAccount(rut)); }
    catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally   { setLoading(false); }
  }, [rut]);

  useEffect(() => { load(); }, [load]);

  async function submitPayment() {
    const value = Number(amount);
    if (!(value > 0)) { setError("Monto inválido"); return; }
    setSaving(true); setError("");
    try {
      await registerPatientPayment(rut, { amount: value, method });
      setAmount(""); setAdding(false);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally     { setSaving(false); }
  }

  const saldo = account?.saldo ?? 0;
  const debt = saldo > 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-900">Cuenta corriente</h3>
        {!loading && account && (
          <span className={`text-sm font-bold px-3 py-1 rounded-full ${
            debt ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
          }`}>
            {debt ? `Debe ${fmtCLP(saldo)}` : "Al día"}
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-gray-400">Cargando…</p>
      ) : account ? (
        <>
          <div className="grid grid-cols-2 gap-3 mb-3 text-center">
            <div><p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Cargos</p><p className="text-sm font-semibold text-gray-700">{fmtCLP(account.totalCharged)}</p></div>
            <div><p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Pagado</p><p className="text-sm font-semibold text-emerald-600">{fmtCLP(account.totalPaid)}</p></div>
          </div>

          {account.entries.length > 0 && (
            <div className="max-h-40 overflow-y-auto flex flex-col gap-1 mb-3">
              {account.entries.slice().reverse().map((e) => (
                <div key={e.id} className="flex items-center justify-between text-xs py-1 border-b border-gray-50 last:border-0">
                  <span className="text-gray-500">
                    {new Date(e.date).toLocaleDateString("es-CL")} · {e.description}
                  </span>
                  <span className={e.kind === "payment" ? "text-emerald-600 font-semibold" : "text-gray-700 font-semibold"}>
                    {e.kind === "payment" ? "−" : "+"}{fmtCLP(e.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {adding ? (
            <div className="flex flex-col gap-2 bg-gray-50 rounded-xl p-3">
              <div className="flex gap-2">
                <input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Monto del abono"
                  className="flex-1 px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1A5C7A]/30 focus:border-[#1A5C7A]" />
                <select value={method} onChange={(e) => setMethod(e.target.value)}
                  className="px-2 py-2 text-sm rounded-xl border border-gray-200">
                  {PAY_METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={submitPayment} disabled={saving}
                  className="text-xs font-bold px-3 py-1.5 rounded-xl bg-[#1A5C7A] text-white hover:bg-[#0e4560] transition disabled:opacity-50">
                  {saving ? "Guardando…" : "Registrar abono"}
                </button>
                <button onClick={() => { setAdding(false); setError(""); }} disabled={saving}
                  className="text-xs font-bold px-3 py-1.5 rounded-xl border border-gray-200 text-gray-500 hover:border-gray-300">
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAdding(true)}
              className="text-xs font-bold px-3 py-1.5 rounded-xl border border-[#1A5C7A]/30 text-[#1A5C7A] bg-[#1A5C7A]/5 hover:bg-[#1A5C7A]/10 transition">
              + Registrar abono
            </button>
          )}
        </>
      ) : null}

      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
    </div>
  );
}

const GENDER_LABEL: Record<string, string> = { "M": "Masculino", "F": "Femenino", "X": "Otro/X", "no_responde": "No responde", "": "—" };
const INS_LABEL: Record<string, string> = { "fonasa": "Fonasa", "isapre": "Isapre", "particular": "Particular", "otro": "Otro", "": "—" };

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
      <p className="text-sm text-gray-800">{value}</p>
    </div>
  );
}

function Mini({ label, value, small }: { label: string; value: string | number; small?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
      <p className={`font-black text-gray-900 ${small ? "text-sm" : "text-xl"}`}>{value}</p>
    </div>
  );
}

function Field({ label, value, editing, onChange, type = "text", displayValue, fullWidth }: {
  label: string; value: string; editing: boolean;
  onChange: (v: string) => void; type?: string; displayValue?: string; fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? "sm:col-span-2" : ""}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">{label}</p>
      {editing ? (
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1A5C7A]/30 focus:border-[#1A5C7A]" />
      ) : (
        <p className="text-sm text-gray-800">{displayValue ?? value ?? "—"}</p>
      )}
    </div>
  );
}

function FieldSelect({ label, value, editing, onChange, options, displayValue }: {
  label: string; value: string; editing: boolean;
  onChange: (v: string) => void; options: [string, string][]; displayValue?: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">{label}</p>
      {editing ? (
        <select value={value} onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1A5C7A]/30 focus:border-[#1A5C7A]">
          {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      ) : (
        <p className="text-sm text-gray-800">{displayValue ?? value ?? "—"}</p>
      )}
    </div>
  );
}

function calculateAge(birthIso: string): number {
  const b = new Date(birthIso);
  const t = new Date();
  let age = t.getFullYear() - b.getFullYear();
  const m = t.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < b.getDate())) age--;
  return age;
}

/* ─── Tab: Sesiones (notas clínicas + modal) ─────────────────────────── */
function SesionesTab({ record, patientId, onCreated }: { record: ClinicalRecord; patientId: string; onCreated: () => void }) {
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900">Sesiones / notas clínicas</h3>
        <button onClick={() => setShowAdd(true)}
          className="text-xs font-bold px-3 py-1.5 rounded-xl bg-[#1A5C7A] text-white hover:bg-[#0e4560] transition">
          + Nueva nota
        </button>
      </div>

      {record.clinicalNotes.length === 0 ? (
        <div className="text-center text-sm text-gray-400 py-8">Sin notas clínicas registradas</div>
      ) : (
        <div className="flex flex-col gap-3">
          {record.clinicalNotes.map((n) => <NoteCard key={n.id} note={n} />)}
        </div>
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
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-xs font-bold text-gray-900">
            {new Date(note.occurredAt).toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "long", year: "numeric" })}
          </p>
          <p className="text-[11px] text-gray-500">{note.professional.name}{note.professional.occupation ? ` · ${note.professional.occupation}` : ""}</p>
        </div>
        {note.reasonCategory && (
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
            {note.reasonCategory}
          </span>
        )}
      </div>
      <NoteField label="Motivo"        value={note.reason} />
      <NoteField label="Hallazgos"     value={note.findings} />
      <NoteField label="Procedimientos" value={note.procedures} />
      <NoteField label="Indicaciones"  value={note.prescriptions} />
      <NoteField label="Próxima visita" value={note.nextVisitPlan} />
    </div>
  );
}

function NoteField({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="mt-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
      <p className="text-xs text-gray-700 whitespace-pre-wrap">{value}</p>
    </div>
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

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
          <h3 className="text-sm font-bold text-gray-800">Nueva nota clínica</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 text-lg">✕</button>
        </div>
        <form onSubmit={submit} className="p-5 flex flex-col gap-3 overflow-y-auto">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Motivo de consulta</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
              placeholder='"Dolor en muela superior derecha"'
              className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1A5C7A]/30 focus:border-[#1A5C7A] resize-none" />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Categoría</label>
            <select value={reasonCategory} onChange={(e) => setReasonCategory(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1A5C7A]/30 focus:border-[#1A5C7A]">
              <option value="">—</option>
              <option value="urgencia">Urgencia</option>
              <option value="dolor">Dolor</option>
              <option value="control">Control</option>
              <option value="estetica">Estética</option>
              <option value="derivacion">Derivación</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          {([
            ["Hallazgos / diagnóstico", findings, setFindings],
            ["Procedimientos realizados", procedures, setProcedures],
            ["Indicaciones / prescripciones", prescriptions, setPrescriptions],
            ["Plan próxima visita", nextVisitPlan, setNextVisitPlan],
          ] as [string, string, (v: string) => void][]).map(([label, val, set]) => (
            <div key={label}>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">{label}</label>
              <textarea value={val} onChange={(e) => set(e.target.value)} rows={2}
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1A5C7A]/30 focus:border-[#1A5C7A] resize-none" />
            </div>
          ))}
          {err && <p className="text-xs text-red-500">{err}</p>}
          <div className="text-[10px] text-gray-400 italic">
            Las notas son inmutables (Decreto 41 MINSAL). Para corregir, crea una nueva nota.
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-500 text-sm font-bold hover:border-gray-300">Cancelar</button>
            <button type="submit" disabled={saving || (!reason && !findings && !procedures)}
              className="flex-1 py-2 rounded-xl bg-[#1A5C7A] text-white text-sm font-bold hover:bg-[#0e4560] disabled:opacity-50">
              {saving ? "Guardando…" : "Guardar nota"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Tab: Imágenes ───────────────────────────────────────────────────── */
function ImagenesTab({ record }: { record: ClinicalRecord }) {
  if (record.images.length === 0) {
    return <div className="text-center text-sm text-gray-400 py-10">Sin imágenes — usá el tab Odontograma para subir radiografías/fotos por pieza</div>;
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {record.images.map((img) => (
        <a key={img.id} href={img.url} target="_blank" rel="noopener noreferrer"
          className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:border-[#1A5C7A] transition">
          <img src={img.url} alt={img.imageType} className="w-full h-32 object-cover" />
          <div className="p-2">
            <p className="text-[11px] font-semibold text-gray-700">
              {img.toothFDI ? `Pieza ${img.toothFDI}` : img.imageType}
            </p>
            <p className="text-[10px] text-gray-400">{new Date(img.takenAt).toLocaleDateString("es-CL")}</p>
          </div>
        </a>
      ))}
    </div>
  );
}
