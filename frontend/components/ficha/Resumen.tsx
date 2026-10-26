import { useCallback, useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Badge, Button, CLASE_CAMPO, Field, Select } from "@/components/ui";
import { cx } from "@/lib/cx";
import {
  getPatientAccount, registerPatientPayment, updateIdentity, updateInsurance,
  type ClinicalRecord, type PatientAccount,
} from "@/lib/clinicalRecord";

export const GENDER_LABEL: Record<string, string> = { M: "Masculino", F: "Femenino", X: "Otro/X", no_responde: "No responde", "": "—" };
const INS_LABEL: Record<string, string> = { fonasa: "Fonasa", isapre: "Isapre", particular: "Particular", otro: "Otro", "": "—" };
const fmtCLP = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");
const PAY_METHODS: [string, string][] = [["cash", "Efectivo"], ["transfer", "Transferencia"], ["card", "Tarjeta"], ["other", "Otro"]];

/** Tarjeta de una sección de la ficha: título y, a la derecha, su acción. */
export function Bloque({ titulo, accion, className, children }: {
  titulo: string; accion?: React.ReactNode; className?: string; children: React.ReactNode;
}) {
  return (
    <section className={cx("rounded-card border border-line bg-surface p-5", className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-base font-bold text-brand-strong">{titulo}</h3>
        {accion}
      </div>
      {children}
    </section>
  );
}

/** Un dato de la ficha: en lectura, etiqueta y valor; editando, el campo. */
function Dato({ label, value, editing, onChange, type = "text", displayValue, className }: {
  label: string; value: string; editing: boolean;
  onChange: (v: string) => void; type?: string; displayValue?: string; className?: string;
}) {
  if (editing) return <div className={className}><Field label={label} type={type} value={value} onChange={(e) => onChange(e.target.value)} /></div>;
  const v = displayValue ?? value;
  return (
    <div className={className}>
      <dt className="text-[13px] text-ink-muted">{label}</dt>
      <dd className={cx("text-sm", v && v !== "—" ? "font-semibold text-ink" : "text-ink-muted")}>{v || "—"}</dd>
    </div>
  );
}

function DatoSelect({ label, value, editing, onChange, options, displayValue }: {
  label: string; value: string; editing: boolean;
  onChange: (v: string) => void; options: [string, string][]; displayValue?: string;
}) {
  if (editing) return (
    <Select label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </Select>
  );
  const v = displayValue ?? value;
  return (
    <div>
      <dt className="text-[13px] text-ink-muted">{label}</dt>
      <dd className={cx("text-sm", v && v !== "—" ? "font-semibold text-ink" : "text-ink-muted")}>{v || "—"}</dd>
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

/* ─── Resumen: datos del paciente, previsión, cuenta y actividad ──────── */
export function ResumenTab({ record, patientId, onRefresh }: { record: ClinicalRecord; patientId: string; onRefresh: () => void }) {
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

  const acciones = !editing ? (
    <Button size="sm" variant="secondary" className="max-sm:min-h-11" onClick={() => setEditing(true)}>Editar datos</Button>
  ) : (
    <div className="flex gap-2">
      <Button size="sm" variant="secondary" className="max-sm:min-h-11" onClick={() => setEditing(false)} disabled={saving}>Cancelar</Button>
      <Button size="sm" className="max-sm:min-h-11" onClick={save} loading={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
    </div>
  );

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex flex-col gap-5">
        <Bloque titulo="Datos personales" accion={acciones}>
          {err && <p role="alert" className="mb-3 text-sm font-semibold text-danger">{err}</p>}
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Dato label="Edad" value={age != null ? `${age} años${isMinor ? " (menor de edad)" : ""}` : ""} editing={false} onChange={() => {}} />
            <Dato label="Fecha de nacimiento" editing={editing} type="date" value={form.birthDate}
              onChange={(v) => setForm({ ...form, birthDate: v })}
              displayValue={id?.birthDate ? new Date(id.birthDate).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" }) : "—"} />
            <DatoSelect label="Género" editing={editing} value={form.gender} onChange={(v) => setForm({ ...form, gender: v })}
              options={[["", "—"], ["M", "Masculino"], ["F", "Femenino"], ["X", "Otro/X"], ["no_responde", "No responde"]]}
              displayValue={GENDER_LABEL[form.gender] ?? "—"} />
            <Dato label="Teléfono" editing={editing} type="tel" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
            <Dato label="Email" editing={editing} type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
            <Dato label="Domicilio" editing={editing} value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
          </dl>
        </Bloque>

        {/* Tutor para menores */}
        {isMinor && id?.guardian && (
          <Bloque titulo="Tutor o responsable legal">
            <p className="text-sm font-semibold text-ink">{id.guardian.firstName} {id.guardian.lastName}</p>
            <p className="text-[13px] text-ink-muted">RUT {id.guardian.rut} · {id.guardian.phone ?? "sin teléfono"}</p>
          </Bloque>
        )}

        <Bloque titulo="Contacto de emergencia">
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
            <Dato label="Nombre" editing={editing} value={form.emergencyContactName} onChange={(v) => setForm({ ...form, emergencyContactName: v })} />
            <Dato label="Teléfono" editing={editing} type="tel" value={form.emergencyContactPhone} onChange={(v) => setForm({ ...form, emergencyContactPhone: v })} />
            <Dato label="Parentesco" editing={editing} value={form.emergencyContactRelation} onChange={(v) => setForm({ ...form, emergencyContactRelation: v })} />
          </dl>
        </Bloque>

        {pu && (
          <Bloque titulo="Previsión">
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
              <DatoSelect label="Tipo" editing={editing} value={ins.insuranceProvider} onChange={(v) => setIns({ ...ins, insuranceProvider: v })}
                options={[["", "—"], ["fonasa", "Fonasa"], ["isapre", "Isapre"], ["particular", "Particular"], ["otro", "Otro"]]}
                displayValue={INS_LABEL[ins.insuranceProvider] ?? "—"} />
              {ins.insuranceProvider === "fonasa" && (
                <DatoSelect label="Tramo" editing={editing} value={ins.insuranceTier} onChange={(v) => setIns({ ...ins, insuranceTier: v })}
                  options={[["", "—"], ["A", "A"], ["B", "B"], ["C", "C"], ["D", "D"]]} displayValue={ins.insuranceTier || "—"} />
              )}
              {ins.insuranceProvider === "isapre" && (
                <Dato label="Isapre" editing={editing} value={ins.insuranceCompany} onChange={(v) => setIns({ ...ins, insuranceCompany: v })} />
              )}
            </dl>
            {editing && (
              <label className="mt-3 flex min-h-11 items-center gap-3 text-sm text-ink">
                <input type="checkbox" className="h-5 w-5 accent-brand" checked={ins.marketingImagesConsent}
                  onChange={(e) => setIns({ ...ins, marketingImagesConsent: e.target.checked })} />
                Autoriza el uso de sus imágenes con fines de marketing (Ley 21.719)
              </label>
            )}
            {!editing && pu.marketingImagesConsent && (
              <p className="mt-3 text-[13px] font-semibold text-ok">
                <Check className="mr-1 inline-block h-4 w-4 align-[-3px]" aria-hidden />Autoriza el uso de sus imágenes con fines de marketing
              </p>
            )}
          </Bloque>
        )}
      </div>

      <div className="flex flex-col gap-5">
        {id && id.rut && <AccountCard rut={id.rut} />}
        <Bloque titulo="En la ficha">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
            {[
              ["Evoluciones", record.clinicalNotes.length],
              ["Piezas con registros", Object.keys(record.odontogram).length],
              ["Imágenes", record.images.length],
              ["En molari desde", pu ? new Date(pu.enrolledAt).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" }) : "—"],
            ].map(([l, v]) => (
              <div key={String(l)}>
                <dt className="text-[13px] text-ink-muted">{l}</dt>
                <dd className="text-lg font-semibold text-ink tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </Bloque>
      </div>
    </div>
  );
}

/* ─── Cuenta corriente (Issue #43) ─────────────────────────────────────── */
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
    if (!(value > 0)) { setError("Escribe un monto mayor que cero"); return; }
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
    <Bloque titulo="Cuenta corriente"
      accion={!loading && account ? <Badge tone={debt ? "danger" : "ok"}>{debt ? `Debe ${fmtCLP(saldo)}` : "Al día"}</Badge> : undefined}>
      {loading ? (
        <div className="flex flex-col gap-2" aria-hidden>
          <div className="h-10 rounded-control bg-gray-100" /><div className="h-6 rounded-control bg-gray-100" />
        </div>
      ) : account ? (
        <>
          <dl className="mb-3 grid grid-cols-2 gap-x-6">
            <div><dt className="text-[13px] text-ink-muted">Cargos</dt><dd className="text-lg font-semibold text-ink tabular-nums">{fmtCLP(account.totalCharged)}</dd></div>
            <div><dt className="text-[13px] text-ink-muted">Pagado</dt><dd className="text-lg font-semibold text-ink tabular-nums">{fmtCLP(account.totalPaid)}</dd></div>
          </dl>

          {account.entries.length > 0 ? (
            <ul className="mb-3 max-h-48 overflow-y-auto overscroll-contain">
              {account.entries.slice().reverse().map((e) => (
                <li key={e.id} className="flex items-baseline justify-between gap-3 border-t border-line-soft py-2 text-[13px] first:border-t-0">
                  <span className="min-w-0 text-ink-muted">
                    <span className="tabular-nums">{new Date(e.date).toLocaleDateString("es-CL")}</span> · <span className="text-ink">{e.description}</span>
                  </span>
                  <span className={cx("shrink-0 font-semibold tabular-nums", e.kind === "payment" ? "text-ok" : "text-ink")}>
                    {e.kind === "payment" ? "−" : "+"}{fmtCLP(e.amount)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-3 text-sm text-ink-muted">Sin movimientos todavía.</p>
          )}

          {adding ? (
            <div className="flex flex-col gap-2 rounded-control bg-ground p-3">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <input type="number" min={0} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)}
                  placeholder="Monto del abono" aria-label="Monto del abono en pesos" className={CLASE_CAMPO} />
                <select value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Medio de pago" className={cx(CLASE_CAMPO, "w-auto")}>
                  {PAY_METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="max-sm:min-h-11" onClick={submitPayment} loading={saving}>{saving ? "Guardando…" : "Registrar abono"}</Button>
                <Button size="sm" variant="secondary" className="max-sm:min-h-11" onClick={() => { setAdding(false); setError(""); }} disabled={saving}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="secondary" className="max-sm:min-h-11" onClick={() => setAdding(true)}>+ Registrar abono</Button>
          )}
        </>
      ) : null}

      {error && <p role="alert" className="mt-2 text-sm font-semibold text-danger">{error}</p>}
    </Bloque>
  );
}
