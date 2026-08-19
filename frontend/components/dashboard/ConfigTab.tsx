"use client";

import { useEffect, useState } from "react";
import { getToken, updateClinic, type ClinicData } from "@/lib/auth";
import { RecallSection } from "@/components/RecallSection";
import { AuditLogSection } from "@/components/AuditLogSection";
import { InfoField } from "./widgets";
import type { ClinicConfig, RecallConfig, ReminderConfig, SurveyConfig } from "./types";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const DEFAULT_RECALL_MSG =
  "Hola {nombre}, te echamos de menos en {clinica}. ¿Qué tal si agendamos tu próximo control?";
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setRecallTriggering(true);
    try {
      const r = await fetch(`${API}/api/clinics/${clinic.id}/recall/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ daysInactive: recallForm.daysInactive, message: recallForm.message }),
      });
      const data = await r.json();
      setRecallMsg(`Enviado a ${data.sent} de ${data.total} pacientes inactivos.`);
      setTimeout(() => setRecallMsg(""), 6000);
    } catch { setRecallMsg("Error al ejecutar campaña"); }
    finally { setRecallTriggering(false); }
  }

  return (
  <div className="flex flex-col gap-6">
    {/* Asistente IA */}
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-semibold text-gray-900">Asistente IA</h2>
          <p className="text-xs text-gray-400 mt-0.5">Personalidad y tono del chatbot de tu clínica</p>
        </div>
        {canEdit && !editing && <button onClick={() => setEditing(true)} className="text-sm text-blue-600 hover:text-blue-700 font-medium">Editar</button>}
        {canEdit && editing && (
          <div className="flex gap-3">
            <button onClick={() => { setEditing(false); syncForm(clinic); }} className="text-sm text-gray-500">Cancelar</button>
            <button onClick={saveBasicInfo} disabled={saving}
              className="text-sm bg-blue-600 text-white font-medium px-4 py-1.5 rounded-full hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        )}
      </div>
      {saveMsg && <p className={`text-xs mb-4 ${saveMsg === "Guardado" ? "text-green-600" : "text-red-600"}`}>{saveMsg}</p>}
      <div className="flex flex-col gap-5">
        <InfoField label="Nombre del asistente" value={form.assistantName} editable={editing} placeholder="Ej: Gala, Aria, Luna..." onChange={(v) => setForm((f) => ({ ...f, assistantName: v }))} />
        <div>
          <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Tono del asistente</label>
          {editing ? (
            <select value={form.tone} onChange={(e) => setForm((f) => ({ ...f, tone: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition">
              <option value="">Seleccionar tono...</option>
              <option value="profesional pero cercano, lenguaje chileno natural">Profesional y cercano (recomendado)</option>
              <option value="muy amigable y cálido, tutea al paciente, usa expresiones coloquiales chilenas">Amigable y cálido</option>
              <option value="formal y técnico, trata de usted, lenguaje clínico preciso">Formal y técnico</option>
              <option value="empático y tranquilizador, prioriza que el paciente se sienta escuchado y sin miedo">Empático y tranquilizador</option>
            </select>
          ) : (
            <p className="text-sm text-gray-800">{form.tone || "—"}</p>
          )}
        </div>
        <div className="pt-2 border-t border-gray-50 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500">Plan actual</p>
            <span className="inline-block mt-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 capitalize">{clinic.plan}</span>
          </div>
          <a href="/partners/preview" target="_blank"
            className="text-xs font-semibold px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
            Probar asistente
          </a>
        </div>
      </div>
    </section>

    {/* Recordatorios automáticos */}
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900">Recordatorios automáticos</h2>
        <div className="flex items-center gap-3">
          {remMsg && <span className={`text-xs ${remMsg === "Guardado" ? "text-green-600" : "text-red-600"}`}>{remMsg}</span>}
          {canEdit && !remEditing && <button onClick={() => setRemEditing(true)} className="text-sm text-blue-600 hover:text-blue-700 font-medium">Editar</button>}
          {canEdit && remEditing && (
            <div className="flex gap-3">
              <button onClick={() => { setRemEditing(false); if (clinic) syncRemForm(clinic); }} className="text-sm text-gray-500">Cancelar</button>
              <button onClick={saveReminders} disabled={remSaving}
                className="text-sm bg-blue-600 text-white font-medium px-4 py-1.5 rounded-full hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {remSaving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          )}
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-4">Se envían por WhatsApp al paciente si tiene número registrado.</p>
      <div className="flex flex-col gap-3">
        {/* Parent toggle */}
        {(() => {
          const canToggle = remEditing && canEdit;
          return (
            <label className={`flex items-center justify-between gap-4 p-3 rounded-xl border transition-colors ${canToggle ? "cursor-pointer hover:bg-gray-50" : "opacity-70 cursor-default"}`}
              style={{ borderColor: "#f1f5f9" }}>
              <div>
                <p className="text-sm font-medium text-gray-800">Recordatorios activos</p>
                <p className="text-xs text-gray-400">Habilita o deshabilita todos los recordatorios</p>
              </div>
              <div onClick={() => canToggle && setRemForm((f) => ({ ...f, enabled: !f.enabled }))}
                className={`w-10 h-6 rounded-full relative transition-colors ${remForm.enabled ? "bg-blue-600" : "bg-gray-200"}`}>
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${remForm.enabled ? "translate-x-5" : "translate-x-1"}`} />
              </div>
            </label>
          );
        })()}
        {/* Child toggles — indented and disabled when parent is off */}
        <div className={`flex flex-col gap-2 pl-4 border-l-2 transition-opacity ${remForm.enabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}
          style={{ borderColor: "#e2e8f0" }}>
          {[
            { key: "dayBefore", label: "Recordatorio día anterior",   desc: "Avisa al paciente la noche antes de su cita" },
            { key: "twoHours",  label: "Recordatorio 2 horas antes",  desc: "Avisa al paciente 2 horas antes de su cita" },
          ].map(({ key, label, desc }) => {
            const canToggle = remEditing && canEdit && remForm.enabled;
            return (
              <label key={key} className={`flex items-center justify-between gap-4 p-3 rounded-xl border transition-colors ${canToggle ? "cursor-pointer hover:bg-gray-50" : "cursor-default"}`}
                style={{ borderColor: "#f1f5f9" }}>
                <div>
                  <p className="text-sm font-medium text-gray-800">{label}</p>
                  <p className="text-xs text-gray-400">{desc}</p>
                </div>
                <div onClick={() => canToggle && setRemForm((f) => ({ ...f, [key]: !f[key as keyof ReminderConfig] }))}
                  className={`w-10 h-6 rounded-full relative transition-colors ${remForm[key as keyof ReminderConfig] ? "bg-blue-600" : "bg-gray-200"}`}>
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${remForm[key as keyof ReminderConfig] ? "translate-x-5" : "translate-x-1"}`} />
                </div>
              </label>
            );
          })}
          {/* Configurable reminder */}
          {(() => {
            const canToggle = remEditing && canEdit && remForm.enabled;
            return (
              <div className={`p-3 rounded-xl border transition-colors ${canToggle ? "hover:bg-gray-50" : "cursor-default"}`}
                style={{ borderColor: "#f1f5f9" }}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-800">Recordatorio configurable</p>
                    <p className="text-xs text-gray-400">Envía un aviso un número específico de horas antes</p>
                  </div>
                  <div onClick={() => canToggle && setRemForm((f) => ({ ...f, customEnabled: !f.customEnabled }))}
                    className={`w-10 h-6 rounded-full relative transition-colors shrink-0 ${remForm.customEnabled ? "bg-blue-600" : "bg-gray-200"} ${canToggle ? "cursor-pointer" : ""}`}>
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${remForm.customEnabled ? "translate-x-5" : "translate-x-1"}`} />
                  </div>
                </div>
                {remForm.customEnabled && (
                  <div className="mt-3 flex items-center gap-3">
                    <label className="text-xs text-gray-500 shrink-0">Horas antes de la cita</label>
                    <input
                      type="number" min={1} max={168} value={remForm.customHours}
                      disabled={!canToggle}
                      onChange={(e) => setRemForm((f) => ({ ...f, customHours: Math.max(1, Number(e.target.value)) }))}
                      className="w-24 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                    />
                    <span className="text-xs text-gray-400">
                      {remForm.customHours === 1 ? "1 hora" : remForm.customHours < 24 ? `${remForm.customHours} horas` : remForm.customHours === 24 ? "1 día" : `${Math.round(remForm.customHours / 24 * 10) / 10} días`}
                    </span>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </section>

    {/* Encuesta post-cita */}
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-semibold text-gray-900">Encuesta post-cita</h2>
          <p className="text-xs text-gray-400 mt-0.5">Mensaje automático por WhatsApp tras cada cita completada.</p>
        </div>
        <div className="flex items-center gap-3">
          {surveyMsg && <span className={`text-xs ${surveyMsg === "Guardado" ? "text-green-600" : "text-red-600"}`}>{surveyMsg}</span>}
          {canEdit && !surveyEditing && <button onClick={() => setSurveyEditing(true)} className="text-sm text-blue-600 hover:text-blue-700 font-medium">Editar</button>}
          {canEdit && surveyEditing && (
            <div className="flex gap-3">
              <button onClick={() => { setSurveyEditing(false); if (clinic) syncSurveyForm(clinic); }} className="text-sm text-gray-500">Cancelar</button>
              <button onClick={saveSurvey} disabled={surveySaving}
                className="text-sm bg-blue-600 text-white font-medium px-4 py-1.5 rounded-full hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {surveySaving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Widget */}
      <div className={`flex flex-col gap-4 transition-opacity ${!surveyEditing ? "opacity-70 pointer-events-none" : ""}`}>
        {/* Activar / desactivar */}
        <div className="flex items-center justify-between p-3 rounded-xl border" style={{ borderColor: "#f1f5f9" }}>
          <div>
            <p className="text-sm font-medium text-gray-800">Encuesta activa</p>
            <p className="text-xs text-gray-400">Ideal para conseguir reseñas en Google.</p>
          </div>
          <div onClick={() => setSurveyForm((f) => ({ ...f, enabled: !f.enabled }))}
            className={`w-10 h-6 rounded-full relative transition-colors shrink-0 cursor-pointer ${surveyForm.enabled ? "bg-blue-600" : "bg-gray-200"}`}>
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${surveyForm.enabled ? "translate-x-5" : "translate-x-1"}`} />
          </div>
        </div>

        <div className={`flex flex-col gap-4 transition-opacity ${surveyForm.enabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
          {/* Horas después */}
          <div className="flex items-center gap-4 p-3 rounded-xl border" style={{ borderColor: "#f1f5f9" }}>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">Enviar</p>
              <p className="text-xs text-gray-400">Horas después de terminada la cita</p>
            </div>
            <div className="flex items-center gap-2">
              <input type="number" min={1} max={72} value={surveyForm.hoursAfter}
                onChange={(e) => setSurveyForm((f) => ({ ...f, hoursAfter: Math.max(1, Number(e.target.value)) }))}
                className="w-16 px-2 py-1.5 rounded-lg border border-gray-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <span className="text-xs text-gray-500">hrs</span>
            </div>
          </div>

          {/* Mensaje */}
          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
              Mensaje — usa {"{nombre}"} y {"{clinica}"}
            </label>
            <textarea rows={3} value={surveyForm.message}
              onChange={(e) => setSurveyForm((f) => ({ ...f, message: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>

          {/* Preview burbuja WhatsApp */}
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Vista previa</p>
            <div className="bg-[#ECE5DD] rounded-2xl p-4">
              <div className="flex justify-end">
                <div className="bg-[#DCF8C6] rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[85%] shadow-sm">
                  <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                    {surveyForm.message
                      .replace("{nombre}", "María")
                      .replace("{clinica}", clinic?.name ?? "Clínica")}
                  </p>
                  <p className="text-[10px] text-gray-400 text-right mt-1">
                    {surveyForm.hoursAfter === 1 ? "1 hr después" : `${surveyForm.hoursAfter} hrs después`}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* Campañas de recall */}
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-gray-900">Campañas de recall</h2>
          <p className="text-xs text-gray-400 mt-0.5">Mensajes automáticos para pacientes que no han vuelto en X días.</p>
        </div>
        <div className="flex items-center gap-3">
          {recallMsg && <span className={`text-xs ${recallMsg.startsWith("Enviado") || recallMsg === "Guardado" ? "text-green-600" : "text-red-600"}`}>{recallMsg}</span>}
          {canEdit && !recallEditing && <button onClick={() => setRecallEditing(true)} className="text-sm text-blue-600 hover:text-blue-700 font-medium">Editar</button>}
          {canEdit && recallEditing && (
            <div className="flex gap-3">
              <button onClick={() => { setRecallEditing(false); if (clinic) syncRecallForm(clinic); }} className="text-sm text-gray-500">Cancelar</button>
              <button onClick={saveRecall} disabled={recallSaving}
                className="text-sm bg-blue-600 text-white font-medium px-4 py-1.5 rounded-full hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {recallSaving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <label className={`flex items-center justify-between gap-4 p-3 rounded-xl border transition-colors ${recallEditing && canEdit ? "cursor-pointer hover:bg-gray-50" : "opacity-70 cursor-default"}`}
          style={{ borderColor: "#f1f5f9" }}>
          <div>
            <p className="text-sm font-medium text-gray-800">Recall activado</p>
            <p className="text-xs text-gray-400">Habilita las campañas de re-contacto por WhatsApp.</p>
          </div>
          <div onClick={() => recallEditing && canEdit && setRecallForm((f) => ({ ...f, enabled: !f.enabled }))}
            className={`w-10 h-6 rounded-full relative transition-colors shrink-0 ${recallForm.enabled ? "bg-blue-600" : "bg-gray-200"}`}>
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${recallForm.enabled ? "translate-x-5" : "translate-x-1"}`} />
          </div>
        </label>
        <div>
          <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
            Días de inactividad para enviar
          </label>
          <input type="number" min={30} max={365} value={recallForm.daysInactive}
            disabled={!recallEditing || !canEdit}
            onChange={(e) => setRecallForm((f) => ({ ...f, daysInactive: Number(e.target.value) }))}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-70" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
            Mensaje — usa {"{nombre}"} y {"{clinica}"}
          </label>
          <textarea rows={3} value={recallForm.message}
            disabled={!recallEditing || !canEdit}
            onChange={(e) => setRecallForm((f) => ({ ...f, message: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:opacity-70" />
        </div>
        {canEdit && !recallEditing && (
          <button onClick={triggerRecall} disabled={recallTriggering}
            className="flex items-center gap-2 self-start text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50"
            style={{ backgroundColor: "#F7F5F1", border: "1.5px solid #E5E0D9", color: "#0C1B26" }}>
            {recallTriggering ? "Enviando..." : "▶ Ejecutar campaña ahora"}
          </button>
        )}
      </div>
    </section>

    {/* Webhook WhatsApp */}
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <h2 className="font-semibold text-gray-900 mb-1">Webhook WhatsApp (inbound)</h2>
      <p className="text-xs text-gray-400 mb-4">
        Configura esta URL en tu consola de Twilio para que los mensajes entrantes de WhatsApp lleguen al asistente.
      </p>
      <div className="bg-gray-50 rounded-xl border border-gray-200 px-4 py-3 font-mono text-xs text-gray-700 break-all select-all">
        {typeof window !== "undefined" ? window.location.origin : "https://tu-dominio.com"}/api/webhooks/whatsapp/{clinic.slug}
      </div>
      <p className="text-xs text-gray-400 mt-3">
        En Twilio: <strong>Sandbox Settings → When a message comes in</strong> → pega la URL → método POST.
      </p>
    </section>

    {/* Recall automático (Issue #27) */}
    {canEdit && <RecallSection clinicId={clinic.id} />}

    {/* Audit log médico-legal (Issue #34) */}
    {canEdit && <AuditLogSection clinicId={clinic.id} />}
  </div>
  );
}
