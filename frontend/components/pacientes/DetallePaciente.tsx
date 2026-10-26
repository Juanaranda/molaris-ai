import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Stethoscope } from "lucide-react";
import { Badge, BotonCerrar, Button, Field, Tabs, useDialogo, type TonoBadge } from "@/components/ui";
import { CampoTelefono } from "@/components/ui/CampoTelefono";
import { getMe, getToken } from "@/lib/auth";
import { nombreCorto } from "@/lib/agendaVista";
import { ensurePatientId } from "@/lib/clinicalRecord";
import { cx } from "@/lib/cx";
import { rutaPaciente } from "@/lib/rutasApp";
import { DentalQuoteTab } from "../DentalQuoteTab";
import { NewBookingFromPatientModal, NewPlanModal } from "./Formularios";
import { METODO_PAGO, fmtCLP, fmtDate, iniciales, type HistoryEntry, type Patient, type TreatmentPlan } from "./formato";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const ESTADO_CITA: Record<string, { label: string; tono: TonoBadge }> = {
  pending:   { label: "Pendiente", tono: "neutral" },
  cancelled: { label: "Cancelada", tono: "neutral" },
};
const ESTADO_PAGO: Record<string, { label: string; tono: TonoBadge }> = {
  paid:    { label: "Pagada",     tono: "ok" },
  partial: { label: "Pago parcial", tono: "warn" },
  pending: { label: "Por pagar",  tono: "neutral" },
  waived:  { label: "Bonificada", tono: "brand" },
};
const ESTADO_PLAN: Record<string, { label: string; tono: TonoBadge }> = {
  active:    { label: "En curso",   tono: "brand" },
  completed: { label: "Terminado",  tono: "ok" },
  paused:    { label: "Pausado",    tono: "warn" },
  cancelled: { label: "Cancelado",  tono: "neutral" },
};

function Avance({ etiqueta, valor, max, texto }: { etiqueta: string; valor: number; max: number; texto: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((valor / max) * 100)) : 0;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
        <span className="text-ink-muted">{etiqueta}</span>
        <span className="font-semibold text-ink tabular-nums">{texto}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-line-soft" role="progressbar" aria-label={etiqueta}
        aria-valuemin={0} aria-valuemax={max} aria-valuenow={valor}>
        <div className={cx("h-full rounded-full", pct === 100 ? "bg-ok" : "bg-brand")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Una línea de la tira de datos (teléfono, cobros…): etiqueta arriba, valor abajo. */
function Dato({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cx("min-w-0 px-4 py-3", className)}>
      <dt className="text-[13px] text-ink-muted">{label}</dt>
      <dd className="truncate text-sm font-semibold text-ink tabular-nums">{children}</dd>
    </div>
  );
}

/**
 * Detalle de un paciente: contacto, cuenta, historial de citas, planes y
 * presupuesto. Lo clínico (anamnesis, odontograma, evolución) vive en la ficha
 * clínica, que tiene su propia página.
 */
export function PatientDetail({ patient: initialPatient, onClose }: { patient: Patient; onClose: () => void }) {
  const router = useRouter();
  const dialogo = useDialogo(onClose);
  const [patient, setPatient] = useState(initialPatient);
  const [tab, setTab] = useState<"history" | "plans" | "quotes">("history");
  const [openingRecord, setOpeningRecord] = useState(false);
  const [recordError, setRecordError]     = useState("");

  // La ficha es una página con URL propia (abrible en otra pestaña,
  // compartible con el equipo), no un modal sobre un modal.
  async function openClinicalRecord() {
    setOpeningRecord(true); setRecordError("");
    try {
      const me = await getMe();
      if (!me?.clinic?.id) throw new Error("Sin clínica activa");
      const patientId = await ensurePatientId(me.clinic.id, {
        rut: patient.rut ?? undefined,
        phone: patient.phone ?? undefined,
      });
      router.push(rutaPaciente(patientId));
    } catch (e) {
      setRecordError(e instanceof Error ? e.message : "Error");
      setOpeningRecord(false);
    }
  }
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const [plans, setPlans] = useState<TreatmentPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [plansError, setPlansError] = useState(false);
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [showNewBooking, setShowNewBooking] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ name: patient.name, phone: patient.phone ?? "", email: patient.email ?? "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");

  async function savePatientEdit() {
    setSavingEdit(true); setEditError("");
    try {
      const token = getToken();
      const res = await fetch(`${API}/api/patients/${encodeURIComponent(patient.key)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name:  editForm.name  || undefined,
          phone: editForm.phone || undefined,
          email: editForm.email || undefined,
        }),
      });
      if (!res.ok) throw new Error("Error al guardar");
      setPatient((p) => ({ ...p, name: editForm.name || p.name, phone: editForm.phone || null, email: editForm.email || null }));
      setEditMode(false);
    } catch {
      // Antes fallaba en silencio y el formulario quedaba abierto sin decir nada.
      setEditError("No pudimos guardar los cambios. Vuelve a intentar.");
    } finally { setSavingEdit(false); }
  }

  function cargarHistorial() {
    if (!patient.rut) return;
    const token = getToken(); if (!token) return;
    fetch(`${API}/api/patients/${encodeURIComponent(patient.rut)}/history`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error("non-200");
        return r.json();
      })
      .then((h) => { setHistory(h); setHistoryError(false); })
      .catch(() => setHistoryError(true))
      .finally(() => setLoadingHistory(false));
  }

  useEffect(() => {
    if (!patient.rut) return;
    setLoadingHistory(true);
    cargarHistorial();
    // cargarHistorial solo depende del RUT.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient.rut]);

  useEffect(() => {
    if (tab !== "plans") return;
    const token = getToken(); if (!token) return;
    setLoadingPlans(true);
    const url = patient.rut
      ? `${API}/api/treatment-plans?patientRut=${encodeURIComponent(patient.rut)}`
      : `${API}/api/treatment-plans`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (!r.ok) throw new Error("non-200");
        return r.json();
      })
      .then((data: TreatmentPlan[]) => {
        setPlans(patient.rut ? data : data.filter((p) => p.patientName === patient.name));
        setPlansError(false);
      })
      .catch(() => setPlansError(true))
      .finally(() => setLoadingPlans(false));
  }, [tab, patient.rut, patient.name]);

  const balance = patient.totalCharged - patient.totalPaid;
  const sub = [patient.rut, `${patient.visits} ${patient.visits === 1 ? "visita" : "visitas"}`, `última el ${fmtDate(patient.lastVisit)}`]
    .filter(Boolean).join(" · ");

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-ink/40 sm:items-center sm:p-2"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={dialogo} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="paciente-nombre"
        className="flex h-dvh w-full flex-col overflow-hidden bg-surface shadow-2xl outline-none sm:h-[98vh] sm:w-[98vw] sm:max-w-[1600px] sm:rounded-card">

        {/* Encabezado: quién es y qué se hace con él */}
        <div className="shrink-0 border-b border-line px-4 pt-3 pb-4 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="mt-1 grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gray-100 text-sm font-bold text-ink" aria-hidden>
              {iniciales(patient.name)}
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <h2 id="paciente-nombre" className="text-xl font-bold leading-tight text-brand-strong">{patient.name}</h2>
              <p className="text-[13px] text-ink-muted tabular-nums">{sub}</p>
            </div>
            <BotonCerrar onClick={onClose} />
          </div>

          {editMode ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Field label="Nombre" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
              <div className="flex flex-col gap-1.5">
                <label htmlFor="paciente-tel" className="text-sm font-semibold text-ink">Teléfono</label>
                <CampoTelefono id="paciente-tel" value={editForm.phone} onChange={(v) => setEditForm((f) => ({ ...f, phone: v }))} className="min-h-11" />
              </div>
              <Field label="Email" type="email" autoComplete="off" spellCheck={false} value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} placeholder="correo@ejemplo.com" />
              {editError && <p role="alert" className="text-sm font-semibold text-danger sm:col-span-3">{editError}</p>}
              <div className="flex gap-2 sm:col-span-3">
                <Button size="sm" className="max-sm:min-h-11" onClick={savePatientEdit} loading={savingEdit}>{savingEdit ? "Guardando…" : "Guardar"}</Button>
                <Button size="sm" variant="secondary" className="max-sm:min-h-11"
                  onClick={() => { setEditMode(false); setEditError(""); setEditForm({ name: patient.name, phone: patient.phone ?? "", email: patient.email ?? "" }); }}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Agendar es lo que más se hace con un paciente: va primero y sólido. */}
              <div className="mt-3 flex flex-wrap gap-2 sm:pl-14">
                <Button size="sm" className="max-sm:min-h-11" onClick={() => setShowNewBooking(true)}>+ Agendar</Button>
                <Button size="sm" variant="secondary" className="max-sm:min-h-11" onClick={openClinicalRecord} loading={openingRecord}>
                  <Stethoscope className="h-4 w-4" aria-hidden /> {openingRecord ? "Abriendo…" : "Ficha clínica"}
                </Button>
                <Button size="sm" variant="ghost" className="max-sm:min-h-11" onClick={() => setEditMode(true)}>
                  <Pencil className="h-4 w-4" aria-hidden /> Editar datos
                </Button>
              </div>
              {recordError && <p role="alert" className="mt-2 text-sm font-semibold text-danger sm:pl-14">No pudimos abrir la ficha: {recordError}</p>}

              {/* Contacto y cuenta en una sola tira */}
              <dl className="mt-4 grid grid-cols-2 overflow-hidden rounded-control border border-line sm:grid-cols-5 [&>div+div]:border-line max-sm:[&>div:nth-child(even)]:border-l sm:[&>div+div]:border-l max-sm:[&>div:nth-child(n+3)]:border-t">
                <Dato label="Teléfono">{patient.phone || "—"}</Dato>
                <Dato label="Email">{patient.email || "—"}</Dato>
                {patient.totalCharged > 0 ? (
                  <>
                    <Dato label="Cobrado">{fmtCLP(patient.totalCharged)}</Dato>
                    <Dato label="Pagado">{fmtCLP(patient.totalPaid)}</Dato>
                    <Dato label="Saldo" className="max-sm:col-span-2 max-sm:border-l-0">
                      {balance > 0 ? <span className="text-danger">Debe {fmtCLP(balance)}</span> : <span className="text-ok">Al día</span>}
                    </Dato>
                  </>
                ) : (
                  <Dato label="Cuenta" className="col-span-2 sm:col-span-3 max-sm:border-l-0">
                    <span className="font-medium text-ink-muted">Sin cobros registrados</span>
                  </Dato>
                )}
              </dl>

              {patient.services.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Servicios que se ha hecho">
                  {patient.services.map((s) => <Badge key={s}>{s}</Badge>)}
                </div>
              )}
            </>
          )}
        </div>

        <Tabs label="Secciones del paciente" value={tab} onChange={(t) => setTab(t as typeof tab)} className="shrink-0 px-2 sm:px-4"
          items={[
            { id: "history", label: "Historial" },
            { id: "plans", label: "Planes", badge: plans.length || undefined },
            { id: "quotes", label: "Presupuesto" },
          ]} />

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {tab === "history" && (
            <div className="px-4 py-3 sm:px-6">
              {patient.pendingCount > 0 && (
                <p className="mb-2 text-right text-[13px] text-ink-muted tabular-nums">
                  {patient.pendingCount === 1 ? "1 cita sin pago registrado" : `${patient.pendingCount} citas sin pago registrado`}
                </p>
              )}
              {!patient.rut ? (
                <p className="rounded-control border border-dashed border-line px-4 py-3 text-sm text-ink-muted">
                  El historial se busca por RUT y este paciente no tiene uno registrado.
                </p>
              ) : loadingHistory ? (
                <div className="flex flex-col gap-2" aria-hidden>
                  {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-control bg-gray-100" />)}
                </div>
              ) : historyError ? (
                <p className="rounded-control border border-line px-4 py-3 text-sm text-ink">
                  No pudimos cargar el historial.{" "}
                  <button type="button" className="min-h-11 font-semibold text-brand underline underline-offset-2"
                    onClick={() => { setLoadingHistory(true); cargarHistorial(); }}>Reintentar</button>
                </p>
              ) : history.length === 0 ? (
                <p className="rounded-control border border-dashed border-line px-4 py-3 text-sm text-ink-muted">No hay citas para mostrar en su historial.</p>
              ) : (
                <ul>
                  {history.map((h) => {
                    const isEditing = editingNoteId === h.id;
                    const marca = ESTADO_CITA[h.status] ?? (h.paymentStatus ? ESTADO_PAGO[h.paymentStatus] : null);
                    const metodo = h.paymentMethod ? METODO_PAGO[h.paymentMethod] ?? h.paymentMethod : null;
                    const plata = h.amountTotal
                      ? (h.amountPaid && h.amountPaid < h.amountTotal
                          ? `Pagó ${fmtCLP(h.amountPaid)} de ${fmtCLP(h.amountTotal)}`
                          : h.amountPaid ? fmtCLP(h.amountTotal) : `${fmtCLP(h.amountTotal)} por pagar`)
                      : null;
                    return (
                      <li key={h.id} className="grid grid-cols-[88px_minmax(0,1fr)_auto] gap-x-3 gap-y-2 border-t border-line-soft py-3 first:border-t-0">
                        <div className="tabular-nums">
                          <p className="text-sm font-semibold text-ink">{fmtDate(h.date)}</p>
                          <p className="text-[13px] text-ink-muted">{h.time}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink">{h.service ?? "Cita"}</p>
                          <p className="text-[13px] text-ink-muted sm:truncate">
                            {[nombreCorto(h.doctor), plata, metodo].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        <div>{marca && <Badge tone={marca.tono}>{marca.label}</Badge>}</div>

                        {/* Nota de la cita. Es una nota interna (la ve todo el equipo,
                            sin autor ni fecha): lo clínico va en la ficha. */}
                        <div className="col-start-2 col-end-4">
                          {isEditing ? (
                            <div className="flex flex-col gap-2">
                              <Field multiline autoFocus label="Nota interna de la cita" rows={3} value={noteText}
                                onChange={(e) => setNoteText(e.target.value)} placeholder="Prefiere la tarde, viene acompañado…"
                                hint="Lo clínico (evolución, indicaciones) va en la ficha clínica, que guarda autor y fecha." />
                              <div className="flex gap-2">
                                <Button size="sm" className="max-sm:min-h-11" loading={savingNote}
                                  onClick={async () => {
                                    setSavingNote(true);
                                    const token = getToken();
                                    await fetch(`${API}/api/agenda/bookings/${h.id}`, {
                                      method: "PATCH",
                                      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                                      body: JSON.stringify({ notes: noteText }),
                                    });
                                    setHistory((prev) => prev.map((e) => e.id === h.id ? { ...e, notes: noteText } : e));
                                    setEditingNoteId(null);
                                    setSavingNote(false);
                                  }}>
                                  {savingNote ? "Guardando…" : "Guardar nota"}
                                </Button>
                                <Button size="sm" variant="secondary" className="max-sm:min-h-11" onClick={() => setEditingNoteId(null)}>Cancelar</Button>
                              </div>
                            </div>
                          ) : h.notes ? (
                            <button type="button" onClick={() => { setEditingNoteId(h.id); setNoteText(h.notes ?? ""); }}
                              className="w-full rounded-control bg-ground px-3 py-2 text-left text-[13px] leading-relaxed whitespace-pre-wrap text-ink transition-colors hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-brand">
                              <span className="sr-only">Editar nota interna: </span>{h.notes}
                            </button>
                          ) : (
                            <button type="button" onClick={() => { setEditingNoteId(h.id); setNoteText(""); }}
                              className="min-h-11 text-[13px] font-semibold text-brand hover:underline focus-visible:outline-2 focus-visible:outline-brand">
                              + Agregar nota interna
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {tab === "plans" && (
            <div className="px-4 py-3 sm:px-6">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="text-base font-bold text-brand-strong">Planes de tratamiento</h3>
                <Button size="sm" variant="secondary" className="max-sm:min-h-11" onClick={() => setShowNewPlan(true)}>+ Nuevo plan</Button>
              </div>
              {loadingPlans ? (
                <div className="flex flex-col gap-2" aria-hidden>
                  {[1, 2].map((i) => <div key={i} className="h-24 rounded-control bg-gray-100" />)}
                </div>
              ) : plansError ? (
                <p className="rounded-control border border-line px-4 py-3 text-sm text-ink">No pudimos cargar los planes. Cierra y vuelve a abrir el paciente.</p>
              ) : plans.length === 0 ? (
                <p className="rounded-control border border-dashed border-line px-4 py-3 text-sm text-ink-muted">
                  Todavía no tiene planes de tratamiento.
                </p>
              ) : (
                <ul>
                  {plans.map((plan) => {
                    const est = ESTADO_PLAN[plan.status] ?? ESTADO_PLAN.active;
                    const falta = plan.totalAmount ? plan.totalAmount - plan.amountPaid : 0;
                    return (
                      <li key={plan.id} className="flex flex-col gap-3 border-t border-line-soft py-4 first:border-t-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-ink">{plan.title}</p>
                            <p className="text-[13px] text-ink-muted tabular-nums">
                              {[plan.doctor ? nombreCorto(plan.doctor) : null, `desde el ${fmtDate(plan.startDate)}`].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                          <Badge tone={est.tono}>{est.label}</Badge>
                        </div>
                        {plan.description && <p className="text-[13px] text-ink">{plan.description}</p>}
                        <div className="grid gap-3 sm:grid-cols-2">
                          {plan.totalAmount && plan.totalAmount > 0 ? (
                            <Avance etiqueta="Pago" valor={plan.amountPaid} max={plan.totalAmount}
                              texto={`${fmtCLP(plan.amountPaid)} de ${fmtCLP(plan.totalAmount)}${falta > 0 ? ` · faltan ${fmtCLP(falta)}` : ""}`} />
                          ) : null}
                          <Avance etiqueta="Sesiones" valor={plan.sessionsCompleted} max={plan.sessions}
                            texto={`${plan.sessionsCompleted} de ${plan.sessions}`} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {tab === "quotes" && (
            <div className="px-4 py-4 sm:px-6">
              <DentalQuoteTab patient={{ name: patient.name, rut: patient.rut }} />
            </div>
          )}
        </div>
      </div>
      {showNewPlan && (
        <NewPlanModal patient={patient} onClose={() => setShowNewPlan(false)}
          onCreated={(plan) => { setPlans((ps) => [plan, ...ps]); setShowNewPlan(false); }} />
      )}
      {showNewBooking && (
        <NewBookingFromPatientModal
          patient={patient}
          onClose={() => setShowNewBooking(false)}
          onCreated={() => { setShowNewBooking(false); cargarHistorial(); }}
        />
      )}
    </div>
  );
}
