"use client";

import { useRef, useState } from "react";
import { updateClinic, ClinicData } from "@/lib/auth";
import { DoctorsEditor, DoctorRow } from "@/components/DoctorsEditor";
import { ServicesEditor, ServiceRow } from "@/components/ServicesEditor";
import { OpeningHoursEditor, OpeningHours, aScheduleTexto } from "@/components/OpeningHoursEditor";
import { SedesEditor } from "@/components/SedesEditor";
import { IntegrationsSection } from "@/components/IntegrationsSection";
import { AgentControl } from "@/components/AgentControl";

interface ClinicConfig {
  assistantName?: string;
  tone?: string;
  logoUrl?: string;
  doctors?: DoctorRow[];
  services?: ServiceRow[];
  boxes?: number;
  sedes?: string[];
  /** Texto que lee el asistente. Se DERIVA de openingHours, no se edita a mano. */
  schedule?: { weekdays?: string; saturday?: string; sunday?: string };
  /** Horario estructurado: lo usan la agenda y la disponibilidad. */
  openingHours?: OpeningHours;
}

interface Props {
  clinic: ClinicData;
  canEdit: boolean;
  onUpdate: (updated: ClinicData) => void;
}

interface ContactFieldProps {
  label: string;
  value: string;
  editable: boolean;
  onChange: (v: string) => void;
  icon: string;
  placeholder?: string;
  prefix?: string;
}

function ContactField({ label, value, editable, onChange, icon, placeholder, prefix }: ContactFieldProps) {
  if (!editable) {
    return (
      <div className="flex items-start gap-3">
        <span className="text-lg mt-0.5 shrink-0 select-none">{icon}</span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
          <p className="text-sm text-gray-800 mt-0.5 break-words">{value || <span className="text-gray-300">—</span>}</p>
        </div>
      </div>
    );
  }
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">{label}</label>
      <div className="flex items-center rounded-xl border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-[#1A5C7A]/30 focus-within:border-[#1A5C7A] transition-all">
        {prefix && <span className="px-3 text-sm text-gray-400 bg-gray-50 border-r border-gray-200 py-2 shrink-0">{prefix}</span>}
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-3 py-2 text-sm bg-white focus:outline-none min-w-0"
        />
      </div>
    </div>
  );
}

function Toggle({ label, desc, enabled, onChange }: { label: string; desc?: string; enabled: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {desc && <p className="text-xs text-gray-400">{desc}</p>}
      </div>
      <button
        type="button"
        onClick={onChange}
        className={`w-10 h-6 rounded-full relative transition-colors shrink-0 ${enabled ? "bg-[#1A5C7A]" : "bg-gray-200"}`}
      >
        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${enabled ? "translate-x-5" : "translate-x-1"}`} />
      </button>
    </div>
  );
}

export function ClinicProfileTab({ clinic, canEdit, onUpdate }: Props) {
  const cfg = clinic.config as ClinicConfig;

  const [editing, setEditing]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [saveMsg, setSaveMsg]   = useState("");
  const [form, setForm] = useState({
    name:      clinic.name      ?? "",
    phone:     clinic.phone     ?? "",
    whatsapp:  clinic.whatsapp  ?? "",
    instagram: clinic.instagram ?? "",
    location:  clinic.location  ?? "",
  });

  const [logoUploading, setLogoUploading] = useState(false);
  const [logoErr, setLogoErr]             = useState("");
  const logoInputRef = useRef<HTMLInputElement>(null);

  const logoUrl = (clinic.config as ClinicConfig).logoUrl;
  const initials = clinic.name
    ?.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") ?? "?";

  function syncForm(c: ClinicData) {
    setForm({ name: c.name ?? "", phone: c.phone ?? "", whatsapp: c.whatsapp ?? "", instagram: c.instagram ?? "", location: c.location ?? "" });
  }
  async function saveBasicInfo() {
    setSaving(true); setSaveMsg("");
    try {
      const updated = await updateClinic(clinic.id, form);
      onUpdate(updated); syncForm(updated); setEditing(false);
      setSaveMsg("Guardado"); setTimeout(() => setSaveMsg(""), 3000);
    } catch (e) { setSaveMsg(e instanceof Error ? e.message : "Error al guardar"); }
    finally { setSaving(false); }
  }

  /** Guarda el horario estructurado y, derivado de él, el texto que lee el
      asistente. Una sola edición mantiene ambos en sincronía: antes el texto
      se escribía a mano y podía contradecir lo que ofrecía la agenda. */
  async function saveOpeningHours(h: OpeningHours) {
    const config = { ...(clinic.config as ClinicConfig), openingHours: h, schedule: aScheduleTexto(h) };
    const updated = await updateClinic(clinic.id, { config: config as Record<string, unknown> });
    onUpdate(updated);
  }

  async function saveDoctors(doctors: DoctorRow[], boxes: number) {
    const config = { ...(clinic.config as ClinicConfig), doctors, boxes };
    const updated = await updateClinic(clinic.id, { config: config as Record<string, unknown> });
    onUpdate(updated);
  }

  async function saveSedes(sedes: string[]) {
    const config = { ...(clinic.config as ClinicConfig), sedes };
    const updated = await updateClinic(clinic.id, { config: config as Record<string, unknown> });
    onUpdate(updated);
  }

  async function saveServices(services: ServiceRow[]) {
    const config = { ...(clinic.config as ClinicConfig), services };
    const updated = await updateClinic(clinic.id, { config: config as Record<string, unknown> });
    onUpdate(updated);
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoErr("");

    if (file.size > 600_000) {
      setLogoErr("La imagen es demasiado grande (máx 600 KB). Usa una imagen más pequeña.");
      e.target.value = "";
      return;
    }

    setLogoUploading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const base64 = ev.target?.result as string;
        const config = { ...(clinic.config as ClinicConfig), logoUrl: base64 };
        const updated = await updateClinic(clinic.id, { config: config as Record<string, unknown> });
        onUpdate(updated);
      } catch { setLogoErr("No se pudo guardar la imagen."); }
      finally { setLogoUploading(false); }
    };
    reader.onerror = () => { setLogoErr("Error al leer el archivo."); setLogoUploading(false); };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  return (
    <div className="flex flex-col gap-6">
      {canEdit && <AgentControl clinicId={clinic.id} />}

      {/* ── Header card ── */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div
          className="h-28 relative"
          style={{ background: "linear-gradient(130deg, #0B2F42 0%, #1A5C7A 55%, #2B87A8 100%)" }}
        >
          <div className="absolute inset-0" style={{
            backgroundImage: "radial-gradient(ellipse at 20% 60%, rgba(255,255,255,0.12) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(43,135,168,0.4) 0%, transparent 50%)",
          }} />
        </div>

        <div className="px-6 pb-6">
          <div className="flex items-end gap-4 -mt-12">
            {/* Logo */}
            <div className="relative shrink-0 group">
              <div
                className="w-24 h-24 rounded-2xl border-4 border-white shadow-xl overflow-hidden"
                style={{ background: "linear-gradient(135deg, #1A5C7A, #2B87A8)" }}
              >
                {logoUrl ? (
                  <img src={logoUrl} alt={clinic.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-white font-black text-3xl tracking-tight">{initials}</span>
                  </div>
                )}
              </div>

              {canEdit && (
                <>
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    disabled={logoUploading}
                    className="absolute inset-0 w-24 h-24 rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1"
                  >
                    {logoUploading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} className="w-5 h-5">
                          <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                          <circle cx="12" cy="13" r="4" />
                        </svg>
                        <span className="text-white text-[10px] font-semibold">Cambiar</span>
                      </>
                    )}
                  </button>
                  <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleLogoChange} />
                </>
              )}
            </div>

            <div className="flex-1 min-w-0 pb-2">
              <h2 className="text-2xl font-black text-gray-900 leading-tight truncate">{clinic.name}</h2>
              {clinic.location && (
                <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1.5">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 shrink-0">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
                  </svg>
                  <span className="truncate">{clinic.location}</span>
                </p>
              )}
            </div>

            <span className="shrink-0 mb-2 text-xs font-bold px-3 py-1 rounded-full capitalize"
              style={{ backgroundColor: "#EFF6FF", color: "#1D4ED8" }}>
              {clinic.plan}
            </span>
          </div>

          {logoErr && <p className="mt-2 text-xs text-red-500">{logoErr}</p>}

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-3 mt-5">
            {[
              { label: "Doctores",  value: cfg.doctors?.length  ?? 0, color: "#EFF6FF", text: "#1D4ED8" },
              { label: "Servicios", value: cfg.services?.length ?? 0, color: "#F0FDF4", text: "#15803D" },
              { label: "Boxes",     value: cfg.boxes            ?? 0, color: "#FFF7ED", text: "#C2410C" },
            ].map(({ label, value, color, text }) => (
              <div key={label} className="text-center py-3 px-2 rounded-xl border border-gray-100" style={{ backgroundColor: color }}>
                <p className="text-2xl font-black leading-none" style={{ color: text }}>{value}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Información de contacto ── */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-semibold text-gray-900">Información de contacto</h2>
            <p className="text-xs text-gray-400 mt-0.5">Datos visibles para los pacientes y el asistente</p>
          </div>
          <div className="flex items-center gap-3">
            {saveMsg && <span className={`text-xs font-medium ${saveMsg === "Guardado" ? "text-emerald-600" : "text-red-500"}`}>{saveMsg}</span>}
            {canEdit && !editing && (
              <button onClick={() => setEditing(true)} className="text-sm font-semibold px-4 py-1.5 rounded-full border transition-colors hover:bg-gray-50"
                style={{ borderColor: "#D9D4CD", color: "#1A5C7A" }}>
                Editar
              </button>
            )}
            {canEdit && editing && (
              <div className="flex gap-2">
                <button onClick={() => { setEditing(false); syncForm(clinic); }} className="text-sm text-gray-400 hover:text-gray-600 px-3 py-1.5 transition">Cancelar</button>
                <button onClick={saveBasicInfo} disabled={saving}
                  className="text-sm font-semibold px-4 py-1.5 rounded-full text-white disabled:opacity-50 transition-colors"
                  style={{ backgroundColor: "#1A5C7A" }}>
                  {saving ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <ContactField label="Nombre de la clínica" value={form.name} editable={editing} icon="🏥"
            onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Ej: Galana Clínica Dental" />
          <ContactField label="Teléfono" value={form.phone} editable={editing} icon="📞"
            onChange={(v) => setForm((f) => ({ ...f, phone: v }))} placeholder="+56 9 XXXX XXXX" />
          <ContactField label="WhatsApp" value={form.whatsapp} editable={editing} icon="💬"
            onChange={(v) => setForm((f) => ({ ...f, whatsapp: v }))} placeholder="+56 9 XXXX XXXX" />
          <ContactField label="Instagram" value={form.instagram} editable={editing} icon="📸"
            onChange={(v) => setForm((f) => ({ ...f, instagram: v }))} placeholder="@clinica" prefix={form.instagram && !editing ? undefined : undefined} />
          <div className="sm:col-span-2">
            <ContactField label="Dirección" value={form.location} editable={editing} icon="📍"
              onChange={(v) => setForm((f) => ({ ...f, location: v }))} placeholder="Av. Ejemplo 123, Santiago" />
          </div>
        </div>
      </section>

      {/* ── Horarios ── */}
      <OpeningHoursEditor
        value={cfg.openingHours}
        canEdit={canEdit}
        onSave={saveOpeningHours}
      />

      {/* ── Equipo médico ── */}
      <DoctorsEditor
        doctors={cfg.doctors ?? []}
        boxes={cfg.boxes ?? 1}
        canEdit={canEdit}
        onSave={saveDoctors}
      />

      {/* ── Sedes (solo doctor independiente: la clínica con equipo ya tiene
             una dirección única y usa boxes para separar la agenda) ── */}
      {clinic.accountType === "solo" && (
        <SedesEditor
          sedes={cfg.sedes ?? []}
          canEdit={canEdit}
          onSave={saveSedes}
        />
      )}

      {/* ── Servicios ── */}
      <ServicesEditor
        services={(cfg.services as ServiceRow[]) ?? []}
        canEdit={canEdit}
        onSave={saveServices}
      />

      {/* ── Link de auto-agendamiento ── */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-semibold text-gray-900 mb-1">Página pública de agendamiento</h2>
        <p className="text-xs text-gray-400 mb-4">
          Comparte este link para que tus pacientes agenden directamente. Ideal para bio de Instagram, Google Business o tu sitio web.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 bg-gray-50 rounded-xl border border-gray-200 px-4 py-3 text-xs text-gray-700 font-mono break-all select-all">
            {typeof window !== "undefined" ? window.location.origin : "https://molari.ai"}/book/{clinic.slug}
          </div>
          <button
            onClick={() => {
              const url = `${window.location.origin}/book/${clinic.slug}`;
              navigator.clipboard.writeText(url);
            }}
            className="text-xs font-semibold px-5 py-2.5 rounded-xl border transition-colors hover:bg-gray-50 whitespace-nowrap"
            style={{ borderColor: "#D9D4CD", color: "#1A5C7A" }}
          >
            Copiar link
          </button>
        </div>
        <div className="mt-3">
          <a href={`/book/${clinic.slug}`} target="_blank" rel="noopener noreferrer"
            className="text-xs font-medium underline underline-offset-2 transition-colors hover:opacity-70"
            style={{ color: "#607281" }}>
            Ver página de agendamiento →
          </a>
        </div>
      </section>

      {/* ─── Integraciones (Mercado Pago + SII) ──────────────────────── */}
      {canEdit && (
        <section>
          <IntegrationsSection clinicId={clinic.id} />
        </section>
      )}

    </div>
  );
}
