"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMe, logout, updateClinic, AuthUser, ClinicData } from "@/lib/auth";
import { DoctorsEditor, DoctorRow } from "@/components/DoctorsEditor";
import { ServicesEditor, ServiceRow } from "@/components/ServicesEditor";

/* ─── Tipos de config ──────────────────────────────────────────────────────── */
interface ClinicConfig {
  tone?: string;
  doctors?: DoctorRow[];
  services?: ServiceRow[];
  boxes?: number;
  schedule?: { weekdays?: string; saturday?: string; sunday?: string };
}

/* ─── Badge de rol ─────────────────────────────────────────────────────────── */
function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    SUPERADMIN: "bg-purple-100 text-purple-700",
    ADMIN: "bg-blue-100 text-blue-700",
    USER: "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${styles[role] ?? styles.USER}`}>
      {role}
    </span>
  );
}

/* ─── Campo editable ────────────────────────────────────────────────────────── */
function InfoField({ label, value, editable, onChange }: {
  label: string; value: string; editable: boolean; onChange: (v: string) => void;
}) {
  if (!editable) {
    return (
      <div>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">{label}</p>
        <p className="text-sm text-gray-800">{value || "—"}</p>
      </div>
    );
  }
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
      />
    </div>
  );
}

/* ─── Dashboard ─────────────────────────────────────────────────────────────── */
export default function PartnersDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [clinic, setClinic] = useState<ClinicData | null>(null);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", whatsapp: "", instagram: "", location: "" });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    getMe().then((data) => {
      if (!data) { router.push("/login"); return; }
      setUser(data.user);
      setClinic(data.clinic);
      if (data.clinic) syncForm(data.clinic);
      setLoading(false);
    });
  }, [router]);

  function syncForm(c: ClinicData) {
    setForm({ name: c.name ?? "", phone: c.phone ?? "", whatsapp: c.whatsapp ?? "", instagram: c.instagram ?? "", location: c.location ?? "" });
  }

  function handleLogout() { logout(); router.push("/"); }

  async function saveBasicInfo() {
    if (!clinic) return;
    setSaving(true); setSaveMsg("");
    try {
      const updated = await updateClinic(clinic.id, form);
      setClinic(updated); syncForm(updated); setEditing(false);
      setSaveMsg("Guardado"); setTimeout(() => setSaveMsg(""), 3000);
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : "Error al guardar");
    } finally { setSaving(false); }
  }

  async function saveDoctors(doctors: DoctorRow[], boxes: number) {
    if (!clinic) return;
    const cfg = { ...(clinic.config as ClinicConfig), doctors, boxes };
    const updated = await updateClinic(clinic.id, { config: cfg as Record<string, unknown> });
    setClinic(updated);
  }

  async function saveServices(services: ServiceRow[]) {
    if (!clinic) return;
    const cfg = { ...(clinic.config as ClinicConfig), services };
    const updated = await updateClinic(clinic.id, { config: cfg as Record<string, unknown> });
    setClinic(updated);
  }

  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERADMIN";
  const cfg = (clinic?.config as ClinicConfig) ?? {};

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 sm:px-8 py-4 bg-white border-b border-gray-100">
        <Link href="/"><Image src="/logo.svg" alt="molaris.ai" width={130} height={34} priority /></Link>
        <div className="flex items-center gap-4">
          {user && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 hidden sm:block">{user.name}</span>
              <RoleBadge role={user.role} />
            </div>
          )}
          <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
            Cerrar sesión
          </button>
        </div>
      </nav>

      <div className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-8 py-8 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              {clinic ? clinic.name : "Sin clínica asignada"}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Panel de administración · molaris.ai</p>
          </div>
          {saveMsg && (
            <span className={`text-sm px-3 py-1.5 rounded-full border ${saveMsg === "Guardado" ? "text-green-600 bg-green-50 border-green-100" : "text-red-600 bg-red-50 border-red-100"}`}>
              {saveMsg}
            </span>
          )}
        </div>

        {!clinic && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6 text-sm text-yellow-800">
            Tu usuario no tiene una clínica asignada. Contacta al equipo de molaris.ai.
          </div>
        )}

        {clinic && (
          <>
            {/* ── Info básica ─────────────────────────────────────── */}
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-semibold text-gray-900">Información de la clínica</h2>
                {canEdit && !editing && (
                  <button onClick={() => setEditing(true)} className="text-sm text-blue-600 hover:text-blue-700 font-medium">Editar</button>
                )}
                {canEdit && editing && (
                  <div className="flex gap-3">
                    <button onClick={() => { setEditing(false); syncForm(clinic); }} className="text-sm text-gray-500 hover:text-gray-700">Cancelar</button>
                    <button onClick={saveBasicInfo} disabled={saving} className="text-sm bg-blue-600 text-white font-medium px-4 py-1.5 rounded-full hover:bg-blue-700 disabled:opacity-50 transition-colors">
                      {saving ? "Guardando..." : "Guardar"}
                    </button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <InfoField label="Nombre" value={form.name} editable={editing} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
                <InfoField label="Teléfono" value={form.phone} editable={editing} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} />
                <InfoField label="WhatsApp" value={form.whatsapp} editable={editing} onChange={(v) => setForm((f) => ({ ...f, whatsapp: v }))} />
                <InfoField label="Instagram" value={form.instagram} editable={editing} onChange={(v) => setForm((f) => ({ ...f, instagram: v }))} />
                <InfoField label="Ubicación" value={form.location} editable={editing} onChange={(v) => setForm((f) => ({ ...f, location: v }))} />
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Plan</p>
                  <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 capitalize">{clinic.plan}</span>
                </div>
              </div>
            </section>

            {/* ── Horarios (solo lectura por ahora) ───────────────── */}
            {cfg.schedule && (
              <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h2 className="font-semibold text-gray-900 mb-4">Horarios de atención</h2>
                <div className="flex flex-col gap-2 text-sm">
                  {cfg.schedule.weekdays && <div className="flex justify-between"><span className="text-gray-500">Semana</span><span className="text-gray-800">{cfg.schedule.weekdays}</span></div>}
                  {cfg.schedule.saturday && <div className="flex justify-between"><span className="text-gray-500">Sábado</span><span className="text-gray-800">{cfg.schedule.saturday}</span></div>}
                  {cfg.schedule.sunday && <div className="flex justify-between"><span className="text-gray-500">Domingo</span><span className="text-gray-800">{cfg.schedule.sunday}</span></div>}
                </div>
                <p className="text-xs text-gray-400 mt-4">Para modificar horarios, contacta al equipo.</p>
              </section>
            )}

            {/* ── Doctores (editable) ──────────────────────────────── */}
            <DoctorsEditor
              doctors={cfg.doctors ?? []}
              boxes={cfg.boxes ?? 1}
              canEdit={canEdit}
              onSave={saveDoctors}
            />

            {/* ── Servicios (editable) ─────────────────────────────── */}
            <ServicesEditor
              services={(cfg.services as ServiceRow[]) ?? []}
              canEdit={canEdit}
              onSave={saveServices}
            />

            {/* ── CTA demo ─────────────────────────────────────────── */}
            <section className="bg-blue-600 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-white">Probar el asistente de tu clínica</p>
                <p className="text-blue-100 text-sm mt-1">Conversa con el agente configurado para {clinic.name}</p>
              </div>
              <Link
                href={`/?clinic=${clinic.slug}#demo`}
                className="shrink-0 bg-white text-blue-600 font-semibold px-6 py-2.5 rounded-full text-sm hover:bg-blue-50 transition-colors"
              >
                Abrir demo →
              </Link>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
