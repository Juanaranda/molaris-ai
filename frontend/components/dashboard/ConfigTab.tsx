"use client";

import { useEffect, useState } from "react";
import { getToken, updateClinic, type ClinicData } from "@/lib/auth";
import { RecallSection } from "@/components/RecallSection";
import { AuditLogSection } from "@/components/AuditLogSection";
import { Badge, Button, Dialogo, Field, Interruptor, Select } from "@/components/ui";
import { AYUDA_VARIABLES, Dato, Seccion, VistaPreviaWhatsApp } from "@/components/configuracion/Piezas";
import { cx } from "@/lib/cx";
import type { ClinicConfig, RecallConfig, ReminderConfig, SurveyConfig } from "./types";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const DEFAULT_RECALL_MSG =
  "Hola {nombre}, te echamos de menos en {clinica}. ¿Qué tal si agendamos tu próximo control?";
/** El valor se manda tal cual al asistente; la etiqueta es lo que lee la clínica. */
const TONOS = [
  { valor: "profesional pero cercano, lenguaje chileno natural", etiqueta: "Profesional y cercano (recomendado)" },
  { valor: "muy amigable y cálido, tutea al paciente, usa expresiones coloquiales chilenas", etiqueta: "Amigable y cálido" },
  { valor: "formal y técnico, trata de usted, lenguaje clínico preciso", etiqueta: "Formal y técnico" },
  { valor: "empático y tranquilizador, prioriza que el paciente se sienta escuchado y sin miedo", etiqueta: "Empático y tranquilizador" },
];

const SECCIONES = [
  { id: "asistente", titulo: "Asistente de IA" },
  { id: "recordatorios", titulo: "Recordatorios de cita" },
  { id: "encuesta", titulo: "Encuesta después de la cita" },
  { id: "inactivos", titulo: "Pacientes que no han vuelto" },
  { id: "controles", titulo: "Controles por tratamiento" },
  { id: "whatsapp", titulo: "Conexión con WhatsApp" },
  { id: "accesos", titulo: "Registro de accesos" },
];

function textoHoras(h: number): string {
  if (h === 1) return "1 hora";
  if (h < 24) return `${h} horas`;
  if (h === 24) return "1 día";
  return `${Math.round(h / 24 * 10) / 10} días`;
}

const DEFAULT_SURVEY_MSG =
  "Hola {nombre}, ¿cómo fue tu visita a {clinica}? Tu opinión nos ayuda a mejorar. ¿Nos dejarías una reseña? ⭐";

/**
 * Pestaña de configuración: asistente, recordatorios, campaña de recall y
 * encuesta post-atención. Eran ~320 líneas dentro de page.tsx, con veinte
 * variables de estado que no usaba nadie más.
 *
 * El estado de cada formulario vive acá; el padre solo entrega la clínica y
 * recibe la versión actualizada cuando algo se guarda.
 */
export function ConfigTab({ clinic, canEdit, onClinicUpdated }: {
  clinic: ClinicData;
  canEdit: boolean;
  onClinicUpdated: (c: ClinicData) => void;
}) {
  // Datos básicos + asistente. Se editan solo desde acá, así que el estado se
  // mudó con la pestaña en vez de quedarse colgando en page.tsx.
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", whatsapp: "", instagram: "", location: "", assistantName: "", tone: "" });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const [remForm, setRemForm] = useState<ReminderConfig>({ enabled: true, dayBefore: true, twoHours: true, customEnabled: false, customHours: 24 });
  const [remSaving, setRemSaving] = useState(false);
  const [remMsg, setRemMsg] = useState("");
  const [remEditing, setRemEditing] = useState(false);

  const [recallForm, setRecallForm] = useState<RecallConfig>({ enabled: false, daysInactive: 90, message: DEFAULT_RECALL_MSG });
  const [recallSaving, setRecallSaving] = useState(false);
  const [recallMsg, setRecallMsg] = useState("");
  const [recallTriggering, setRecallTriggering] = useState(false);
  const [recallEditing, setRecallEditing] = useState(false);
  const [confirmarRecall, setConfirmarRecall] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const [surveyForm, setSurveyForm] = useState<SurveyConfig>({ enabled: false, hoursAfter: 2, message: DEFAULT_SURVEY_MSG });
  const [surveySaving, setSurveySaving] = useState(false);
  const [surveyMsg, setSurveyMsg] = useState("");
  const [surveyEditing, setSurveyEditing] = useState(false);

  // Los formularios se rellenan desde la clínica y se resincronizan cuando el
  // padre la actualiza (por ejemplo al guardar desde otra pestaña).
  function syncForm(c: ClinicData) {
    const cfg = c.config as ClinicConfig;
    setForm({ name: c.name ?? "", phone: c.phone ?? "", whatsapp: c.whatsapp ?? "",
      instagram: c.instagram ?? "", location: c.location ?? "", assistantName: cfg.assistantName ?? "",
      tone: cfg.tone ?? "" });
  }

  async function saveBasicInfo() {
    setSaving(true); setSaveMsg("");
    try {
      const { assistantName, tone, ...basicFields } = form;
      const cfg = { ...(clinic.config as ClinicConfig), assistantName, tone };
      const updated = await updateClinic(clinic.id, { ...basicFields, config: cfg as Record<string, unknown> });
      onClinicUpdated(updated); syncForm(updated); setEditing(false);
      setSaveMsg("Guardado"); setTimeout(() => setSaveMsg(""), 3000);
    } catch (e) { setSaveMsg(e instanceof Error ? e.message : "Error al guardar"); }
    finally { setSaving(false); }
  }

  function syncRemForm(c: ClinicData) {
    const cfg = c.config as ClinicConfig;
    setRemForm({
      enabled: cfg.reminders?.enabled !== false,
      dayBefore: cfg.reminders?.dayBefore !== false,
      twoHours: cfg.reminders?.twoHours !== false,
      customEnabled: cfg.reminders?.customEnabled ?? false,
      customHours: cfg.reminders?.customHours ?? 24,
    });
  }
  function syncRecallForm(c: ClinicData) {
    const cfg = c.config as ClinicConfig;
    setRecallForm({
      enabled: cfg.recallCampaign?.enabled ?? false,
      daysInactive: cfg.recallCampaign?.daysInactive ?? 90,
      message: cfg.recallCampaign?.message ?? DEFAULT_RECALL_MSG,
    });
  }
  function syncSurveyForm(c: ClinicData) {
    const raw = (c.config as ClinicConfig).postApptSurvey;
    if (raw && typeof raw === "object") {
      setSurveyForm({ enabled: raw.enabled ?? false, hoursAfter: raw.hoursAfter ?? 2, message: raw.message ?? DEFAULT_SURVEY_MSG });
    } else {
      setSurveyForm((f) => ({ ...f, enabled: raw === true }));
    }
  }

  // Los formularios se rellenan desde la clínica y se resincronizan cuando el
  // padre la actualiza.
  useEffect(() => {
    syncForm(clinic); syncRemForm(clinic); syncRecallForm(clinic); syncSurveyForm(clinic);
  }, [clinic]);

  async function guardar(parcial: Partial<ClinicConfig>, setMsg: (m: string) => void, setSaving: (b: boolean) => void, setEditing: (b: boolean) => void) {
    setSaving(true); setMsg("");
    try {
      const cfg = { ...(clinic.config as ClinicConfig), ...parcial };
      const updated = await updateClinic(clinic.id, { config: cfg as Record<string, unknown> });
      onClinicUpdated(updated); setEditing(false);
      setMsg("Guardado"); setTimeout(() => setMsg(""), 3000);
    } catch (e) { setMsg(e instanceof Error ? e.message : "Error"); }
    finally { setSaving(false); }
  }

  const saveReminders = () => guardar({ reminders: remForm }, setRemMsg, setRemSaving, setRemEditing);
  const saveSurvey    = () => guardar({ postApptSurvey: surveyForm }, setSurveyMsg, setSurveySaving, setSurveyEditing);

  const saveRecall = () => guardar({ recallCampaign: recallForm }, setRecallMsg, setRecallSaving, setRecallEditing);

  /** Corrida manual de la campaña, desde el botón "Ejecutar ahora". */
  async function triggerRecall() {
    setConfirmarRecall(false);
    setRecallTriggering(true);
    try {
      const r = await fetch(`${API}/api/clinics/${clinic.id}/recall/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ daysInactive: recallForm.daysInactive, message: recallForm.message }),
      });
      const data = await r.json();
      // Sin esto, un error del servidor se leía "Enviado a undefined de undefined".
      if (!r.ok) throw new Error();
      setRecallMsg(`Enviado a ${data.sent} de ${data.total} pacientes que no han vuelto.`);
      setTimeout(() => setRecallMsg(""), 6000);
    } catch { setRecallMsg("No pudimos mandar los mensajes. Inténtalo de nuevo."); }
    finally { setRecallTriggering(false); }
  }

  const tono = TONOS.find((t) => t.valor === form.tone);
  const urlWebhook = `${typeof window !== "undefined" ? window.location.origin : "https://tu-dominio.com"}/api/webhooks/whatsapp/${clinic.slug}`;
  const editarRem = remEditing && canEdit;

  async function copiarWebhook() {
    try {
      await navigator.clipboard.writeText(urlWebhook);
      setCopiado(true); setTimeout(() => setCopiado(false), 2500);
    } catch { /* sin permiso de portapapeles: la dirección igual se puede seleccionar */ }
  }

  return (
  <div className="flex flex-col gap-5">
    <div>
      <h2 className="text-2xl font-bold text-brand-strong">Configuración</h2>
      <p className="text-sm text-ink-muted">El asistente, los mensajes por WhatsApp y el registro de accesos de tu clínica.</p>
    </div>

    <div className="grid gap-5 lg:grid-cols-[200px_minmax(0,1fr)] lg:items-start">
      {/* Índice: la página es larga y cada bloque es independiente */}
      <nav aria-label="Secciones de configuración" className="hidden lg:sticky lg:top-24 lg:block">
        <ul className="flex flex-col gap-0.5 border-l border-line">
          {SECCIONES.filter((s) => canEdit || (s.id !== "controles" && s.id !== "accesos")).map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="-ml-px block border-l-2 border-transparent py-1.5 pl-3 text-[13px] text-ink-muted hover:border-brand hover:text-brand">
                {s.titulo}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex min-w-0 flex-col gap-5">
        {/* ── Asistente ── */}
        <Seccion id="asistente" titulo="Asistente de IA"
          descripcion="Cómo se llama y cómo les habla a tus pacientes en el chat y en WhatsApp."
          mensaje={saveMsg}
          edicion={{ puede: canEdit, editando: editing, guardando: saving,
            onEditar: () => setEditing(true), onCancelar: () => { setEditing(false); syncForm(clinic); }, onGuardar: saveBasicInfo }}>
          {editing ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nombre del asistente" value={form.assistantName} placeholder="Por ejemplo: Gala, Aria o Luna"
                autoComplete="off" onChange={(e) => setForm((f) => ({ ...f, assistantName: e.target.value }))} />
              <Select label="Tono" value={form.tone} onChange={(e) => setForm((f) => ({ ...f, tone: e.target.value }))}>
                <option value="">Elige un tono</option>
                {TONOS.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
                {form.tone && !tono && <option value={form.tone}>{form.tone}</option>}
              </Select>
            </div>
          ) : (
            <dl className="grid gap-4 sm:grid-cols-3">
              <Dato etiqueta="Nombre del asistente">{form.assistantName || <span className="font-normal text-ink-muted">Sin nombre</span>}</Dato>
              <Dato etiqueta="Tono">{tono?.etiqueta ?? (form.tone || <span className="font-normal text-ink-muted">Sin elegir</span>)}</Dato>
              <Dato etiqueta="Plan"><Badge tone="brand" className="capitalize">{clinic.plan}</Badge></Dato>
            </dl>
          )}
          <div className="mt-4 border-t border-line-soft pt-4">
            <a href="/partners/preview" target="_blank" rel="noopener"
              className="inline-flex min-h-11 items-center rounded-control border border-line px-4 text-sm font-semibold text-brand-strong transition-colors hover:border-brand hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
              Probar el asistente <span className="sr-only">(se abre en otra pestaña)</span>
            </a>
          </div>
        </Seccion>

        <h3 className="mt-2 text-sm font-bold text-ink-muted">Mensajes por WhatsApp</h3>

        {/* ── Recordatorios ── */}
        <Seccion id="recordatorios" titulo="Recordatorios de cita"
          descripcion="Le llegan al paciente que tiene su celular registrado."
          estado={{ activo: remForm.enabled, si: "Activos", no: "Apagados" }}
          mensaje={remMsg}
          edicion={{ puede: canEdit, editando: remEditing, guardando: remSaving,
            onEditar: () => setRemEditing(true), onCancelar: () => { setRemEditing(false); syncRemForm(clinic); }, onGuardar: saveReminders }}>
          <div className="flex flex-col gap-1">
            <Interruptor label="Mandar recordatorios" description="Apágalo para no mandar ninguno."
              checked={remForm.enabled} disabled={!editarRem}
              onChange={(v) => setRemForm((f) => ({ ...f, enabled: v }))} />
            <div className={cx("ml-3 flex flex-col gap-1 border-l-2 border-line-soft pl-2", !remForm.enabled && "opacity-50")}>
              <Interruptor label="El día anterior" description="La noche antes de la cita."
                checked={remForm.dayBefore} disabled={!editarRem || !remForm.enabled}
                onChange={(v) => setRemForm((f) => ({ ...f, dayBefore: v }))} />
              <Interruptor label="2 horas antes" description="El mismo día de la cita."
                checked={remForm.twoHours} disabled={!editarRem || !remForm.enabled}
                onChange={(v) => setRemForm((f) => ({ ...f, twoHours: v }))} />
              <Interruptor label="Otro aviso" description="Con la anticipación que tú elijas."
                checked={remForm.customEnabled} disabled={!editarRem || !remForm.enabled}
                onChange={(v) => setRemForm((f) => ({ ...f, customEnabled: v }))} />
              {remForm.customEnabled && (
                <div className="flex items-end gap-3 px-3 pb-2">
                  <Field label="Horas antes de la cita" type="number" inputMode="numeric" min={1} max={168} className="w-28"
                    value={remForm.customHours} disabled={!editarRem || !remForm.enabled}
                    onChange={(e) => setRemForm((f) => ({ ...f, customHours: Math.max(1, Number(e.target.value)) }))} />
                  <p className="pb-3 text-[13px] text-ink-muted tabular-nums">{textoHoras(remForm.customHours)}</p>
                </div>
              )}
            </div>
          </div>
        </Seccion>

        {/* ── Encuesta ── */}
        <Seccion id="encuesta" titulo="Encuesta después de la cita"
          descripcion="Un WhatsApp después de la cita para pedir su opinión o una reseña en Google."
          estado={{ activo: surveyForm.enabled }}
          mensaje={surveyMsg}
          edicion={{ puede: canEdit, editando: surveyEditing, guardando: surveySaving,
            onEditar: () => setSurveyEditing(true), onCancelar: () => { setSurveyEditing(false); syncSurveyForm(clinic); }, onGuardar: saveSurvey }}>
          <div className="flex flex-col gap-4">
            <Interruptor label="Mandar la encuesta" checked={surveyForm.enabled} disabled={!surveyEditing}
              onChange={(v) => setSurveyForm((f) => ({ ...f, enabled: v }))} />
            <div className={cx("grid gap-4 lg:grid-cols-2", !surveyForm.enabled && "opacity-50")}>
              <div className="flex flex-col gap-4">
                <Field label="Horas después de la cita" type="number" inputMode="numeric" min={1} max={72} className="w-28"
                  value={surveyForm.hoursAfter} disabled={!surveyEditing || !surveyForm.enabled}
                  onChange={(e) => setSurveyForm((f) => ({ ...f, hoursAfter: Math.max(1, Number(e.target.value)) }))} />
                <Field multiline label="Mensaje" hint={AYUDA_VARIABLES} rows={3} value={surveyForm.message}
                  disabled={!surveyEditing || !surveyForm.enabled}
                  onChange={(e) => setSurveyForm((f) => ({ ...f, message: e.target.value }))} />
              </div>
              <VistaPreviaWhatsApp mensaje={surveyForm.message} clinica={clinic.name}
                pie={`${textoHoras(surveyForm.hoursAfter)} después de la cita`} />
            </div>
          </div>
        </Seccion>

        {/* ── Pacientes que no han vuelto ── */}
        <Seccion id="inactivos" titulo="Pacientes que no han vuelto"
          descripcion="Un WhatsApp para quienes llevan un tiempo sin atenderse."
          estado={{ activo: recallForm.enabled }}
          mensaje={recallMsg} mensajeOk={recallMsg === "Guardado" || recallMsg.startsWith("Enviado")}
          edicion={{ puede: canEdit, editando: recallEditing, guardando: recallSaving,
            onEditar: () => setRecallEditing(true), onCancelar: () => { setRecallEditing(false); syncRecallForm(clinic); }, onGuardar: saveRecall }}>
          <div className="flex flex-col gap-4">
            <Interruptor label="Campaña activa"
              checked={recallForm.enabled} disabled={!recallEditing || !canEdit}
              onChange={(v) => setRecallForm((f) => ({ ...f, enabled: v }))} />
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="flex flex-col gap-4">
                <Field label="Días sin atenderse" hint="Entre 30 y 365 días." type="number" inputMode="numeric" min={30} max={365} className="w-28"
                  value={recallForm.daysInactive} disabled={!recallEditing || !canEdit}
                  onChange={(e) => setRecallForm((f) => ({ ...f, daysInactive: Number(e.target.value) }))} />
                <Field multiline label="Mensaje" hint={AYUDA_VARIABLES} rows={3} value={recallForm.message}
                  disabled={!recallEditing || !canEdit}
                  onChange={(e) => setRecallForm((f) => ({ ...f, message: e.target.value }))} />
              </div>
              <VistaPreviaWhatsApp mensaje={recallForm.message} clinica={clinic.name} />
            </div>
            {canEdit && !recallEditing && (
              <div className="border-t border-line-soft pt-4">
                <Button variant="secondary" loading={recallTriggering} onClick={() => setConfirmarRecall(true)}>
                  {recallTriggering ? "Enviando…" : "Mandar ahora"}
                </Button>
              </div>
            )}
          </div>
        </Seccion>

        {/* ── Controles por tratamiento (#27) ── */}
        {canEdit && <RecallSection clinicId={clinic.id} />}

        <h3 className="mt-2 text-sm font-bold text-ink-muted">Técnico y registro</h3>

        {/* ── Webhook ── */}
        <Seccion id="whatsapp" titulo="Conexión con WhatsApp"
          descripcion="Dato técnico: pega esta dirección en Twilio para que los mensajes de WhatsApp lleguen al asistente.">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 rounded-control border border-line bg-ground px-3 py-2.5 font-mono text-[13px] break-all text-ink select-all">
              {urlWebhook}
            </code>
            <Button variant="secondary" className="shrink-0" onClick={copiarWebhook}>{copiado ? "Copiada" : "Copiar"}</Button>
          </div>
          <p className="mt-3 text-[13px] text-ink-muted">
            En Twilio: <span className="font-semibold text-ink">Sandbox Settings → When a message comes in</span>, pega la dirección y elige el método POST.
          </p>
        </Seccion>

        {/* ── Registro de accesos (#34) ── */}
        {canEdit && <AuditLogSection clinicId={clinic.id} />}
      </div>
    </div>

    {confirmarRecall && (
      <Dialogo titulo="¿Mandar el mensaje ahora?" ancho="sm" onClose={() => setConfirmarRecall(false)}>
        <div className="flex flex-col gap-4 p-5">
          <p className="text-sm text-ink">
            Le llega por WhatsApp a cada paciente que lleva {recallForm.daysInactive} días o más sin atenderse. Una vez enviado no se puede deshacer.
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setConfirmarRecall(false)}>Cancelar</Button>
            <Button onClick={triggerRecall}>Mandar ahora</Button>
          </div>
        </div>
      </Dialogo>
    )}
  </div>
  );
}
