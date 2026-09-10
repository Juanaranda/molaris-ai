"use client";

import { useRef, useState } from "react";
import { AuthUser, updateMe, CLINICAL_ROLE_LABELS } from "@/lib/auth";
import { Stethoscope } from "lucide-react";
import { TwoFactorSection } from "./TwoFactorSection";

interface Props {
  user: AuthUser;
  onUpdate: (updated: AuthUser) => void;
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  SUPERADMIN: { label: "Superadmin", color: "bg-violet-100 text-violet-700" },
  ADMIN:      { label: "Admin",      color: "bg-blue-100 text-blue-700"     },
  USER:       { label: "Usuario",    color: "bg-gray-100 text-gray-600"     },
};

function getInitials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";
}

export function MyProfileTab({ user, onUpdate }: Props) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState("");
  const [form, setForm] = useState({
    name:       user.name ?? "",
    occupation: user.occupation ?? "",
    phone:      user.phone ?? "",
    bio:        user.bio ?? "",
  });

  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoErr, setPhotoErr]             = useState("");
  const photoInputRef = useRef<HTMLInputElement>(null);

  const roleMeta = ROLE_LABELS[user.role] ?? ROLE_LABELS.USER;
  const initials = getInitials(user.name);
  const bioCount = form.bio.length;

  function syncForm(u: AuthUser) {
    setForm({
      name:       u.name ?? "",
      occupation: u.occupation ?? "",
      phone:      u.phone ?? "",
      bio:        u.bio ?? "",
    });
  }

  async function save() {
    if (!form.name.trim()) {
      setMsg("El nombre no puede estar vacío");
      return;
    }
    setSaving(true); setMsg("");
    try {
      const updated = await updateMe({
        name:       form.name.trim(),
        occupation: form.occupation.trim() || null,
        phone:      form.phone.trim() || null,
        bio:        form.bio.trim() || null,
      });
      onUpdate(updated); syncForm(updated); setEditing(false);
      setMsg("Guardado"); setTimeout(() => setMsg(""), 3000);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error al guardar");
    } finally { setSaving(false); }
  }

  function cancel() {
    syncForm(user);
    setEditing(false);
    setMsg("");
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoErr("");

    if (file.size > 600_000) {
      setPhotoErr("La imagen es demasiado grande (máx 600 KB).");
      e.target.value = "";
      return;
    }
    if (!file.type.startsWith("image/")) {
      setPhotoErr("El archivo debe ser una imagen.");
      e.target.value = "";
      return;
    }

    setPhotoUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
        reader.readAsDataURL(file);
      });
      const updated = await updateMe({ photoUrl: dataUrl });
      onUpdate(updated);
    } catch (err) {
      setPhotoErr(err instanceof Error ? err.message : "Error al subir la foto");
    } finally {
      setPhotoUploading(false);
      e.target.value = "";
    }
  }

  async function removePhoto() {
    setPhotoUploading(true); setPhotoErr("");
    try {
      const updated = await updateMe({ photoUrl: null });
      onUpdate(updated);
    } catch (err) {
      setPhotoErr(err instanceof Error ? err.message : "Error al eliminar la foto");
    } finally { setPhotoUploading(false); }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ── Encabezado: avatar + identidad ────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start gap-5">
          {/* Avatar */}
          <div className="relative shrink-0 group">
            {user.photoUrl ? (
              <img src={user.photoUrl} alt={user.name}
                className="w-24 h-24 rounded-2xl object-cover border-2 border-gray-100" />
            ) : (
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#1A5C7A] to-[#0e4560] text-white flex items-center justify-center text-2xl font-black">
                {initials}
              </div>
            )}
            <button onClick={() => photoInputRef.current?.click()} disabled={photoUploading}
              className="absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-full bg-white border-2 border-gray-200 text-gray-600 hover:text-[#1A5C7A] hover:border-[#1A5C7A] flex items-center justify-center shadow-sm transition disabled:opacity-50"
              title="Cambiar foto">
              {photoUploading ? (
                <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </button>
            <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          </div>

          {/* Identidad */}
          <div className="flex-1 min-w-0 w-full">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h2 className="text-lg font-black text-gray-900 truncate">{user.name}</h2>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${roleMeta.color}`}>
                {roleMeta.label}
              </span>
            </div>
            {user.occupation && (
              <p className="text-sm text-gray-600 mb-0.5">{user.occupation}</p>
            )}
            {user.clinicalRole && (
              <p className="text-[11px] text-teal-700 font-semibold mt-0.5"><Stethoscope className="w-4 h-4 inline-block align-[-3px]" aria-hidden /> {CLINICAL_ROLE_LABELS[user.clinicalRole]}</p>
            )}
            <p className="text-xs text-gray-400">{user.email}</p>
            {user.photoUrl && (
              <button onClick={removePhoto} disabled={photoUploading}
                className="mt-3 text-[11px] text-gray-400 hover:text-red-500 transition">
                Eliminar foto
              </button>
            )}
            {photoErr && <p className="text-xs text-red-500 mt-2">{photoErr}</p>}
          </div>

          {/* Acción editar/guardar */}
          <div className="shrink-0 flex flex-col sm:items-end gap-1">
            {!editing ? (
              <button onClick={() => setEditing(true)}
                className="px-3 py-1.5 text-xs font-bold rounded-xl bg-[#1A5C7A] text-white hover:bg-[#0e4560] transition">
                Editar perfil
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={cancel} disabled={saving}
                  className="px-3 py-1.5 text-xs font-bold rounded-xl border border-gray-200 text-gray-500 hover:border-gray-300 transition">
                  Cancelar
                </button>
                <button onClick={save} disabled={saving}
                  className="px-3 py-1.5 text-xs font-bold rounded-xl bg-[#1A5C7A] text-white hover:bg-[#0e4560] transition disabled:opacity-50">
                  {saving ? "Guardando…" : "Guardar"}
                </button>
              </div>
            )}
            {msg && (
              <p className={`text-[11px] ${msg === "Guardado" ? "text-emerald-600" : "text-red-500"}`}>{msg}</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Información personal ──────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-4">Información personal</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field
            label="Nombre completo"
            value={editing ? form.name : user.name}
            editable={editing}
            onChange={(v) => setForm({ ...form, name: v })}
            placeholder="Ej: María González" />

          <Field
            label="Ocupación / título"
            value={editing ? form.occupation : (user.occupation ?? "")}
            editable={editing}
            onChange={(v) => setForm({ ...form, occupation: v })}
            placeholder="Ej: Odontóloga General" />

          <Field
            label="Teléfono personal"
            value={editing ? form.phone : (user.phone ?? "")}
            editable={editing}
            onChange={(v) => setForm({ ...form, phone: v })}
            placeholder="+56 9 1234 5678" />

          <Field
            label="Email"
            value={user.email}
            editable={false}
            onChange={() => {}}
            note="El email es tu identidad de login y no se puede cambiar" />
        </div>

        <div className="mt-5">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Bio</label>
          {editing ? (
            <>
              <textarea
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value.slice(0, 500) })}
                placeholder="Una breve descripción profesional…"
                rows={3}
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1A5C7A]/30 focus:border-[#1A5C7A] resize-none"
              />
              <p className="text-[10px] text-gray-400 text-right mt-1">{bioCount}/500</p>
            </>
          ) : (
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {user.bio || <span className="text-gray-300">—</span>}
            </p>
          )}
        </div>
      </div>

      {/* Seguridad de la cuenta (#68). Va acá y no en Configuración porque es
          de la persona: dos admins de la misma clínica lo deciden por separado. */}
      <TwoFactorSection />
    </div>
  );
}

interface FieldProps {
  label: string;
  value: string;
  editable: boolean;
  onChange: (v: string) => void;
  placeholder?: string;
  note?: string;
}

function Field({ label, value, editable, onChange, placeholder, note }: FieldProps) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">{label}</label>
      {editable ? (
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1A5C7A]/30 focus:border-[#1A5C7A]"
        />
      ) : (
        <p className="text-sm text-gray-700 min-h-[1.5rem]">
          {value || <span className="text-gray-300">—</span>}
        </p>
      )}
      {note && <p className="text-[10px] text-gray-400 mt-1 italic">{note}</p>}
    </div>
  );
}
