"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AuthUser, PartnerRole, ClinicalRole, TeamMember, CLINICAL_ROLE_LABELS,
  listTeam, inviteTeamMember, updateTeamMember,
} from "@/lib/auth";

interface Props {
  clinicId: string;
  currentUser: AuthUser;
}

const ROLE_LABELS: Record<PartnerRole, { label: string; chip: string }> = {
  SUPERADMIN: { label: "Superadmin", chip: "bg-violet-100 text-violet-700" },
  ADMIN:      { label: "Admin",      chip: "bg-blue-100 text-blue-700"     },
  USER:       { label: "Usuario",    chip: "bg-gray-100 text-gray-600"     },
};

function getInitials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";
}

export function TeamTab({ clinicId, currentUser }: Props) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [showInvite,    setShowInvite]    = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const fetchTeam = useCallback(async () => {
    setLoading(true); setError("");
    try { setMembers(await listTeam(clinicId)); }
    catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally { setLoading(false); }
  }, [clinicId]);

  useEffect(() => { fetchTeam(); }, [fetchTeam]);

  async function setActive(member: TeamMember, active: boolean) {
    if (!confirm(active
      ? `¿Reactivar a ${member.name}?`
      : `¿Desactivar a ${member.name}? No podrá iniciar sesión hasta que lo reactives.`
    )) return;
    setPendingAction(member.id);
    try {
      const updated = await updateTeamMember(clinicId, member.id, { active });
      setMembers((m) => m.map((x) => x.id === member.id ? updated : x));
    } catch (e) { alert(e instanceof Error ? e.message : "Error"); }
    finally { setPendingAction(null); }
  }

  async function setRole(member: TeamMember, role: "USER" | "ADMIN") {
    if (member.role === role) return;
    if (!confirm(`Cambiar rol de ${member.name} a ${ROLE_LABELS[role].label}?`)) return;
    setPendingAction(member.id);
    try {
      const updated = await updateTeamMember(clinicId, member.id, { role });
      setMembers((m) => m.map((x) => x.id === member.id ? updated : x));
    } catch (e) { alert(e instanceof Error ? e.message : "Error"); }
    finally { setPendingAction(null); }
  }

  async function setClinicalRole(member: TeamMember, clinicalRole: ClinicalRole | null) {
    if (member.clinicalRole === clinicalRole) return;
    setPendingAction(member.id);
    try {
      const updated = await updateTeamMember(clinicId, member.id, { clinicalRole });
      setMembers((m) => m.map((x) => x.id === member.id ? updated : x));
    } catch (e) { alert(e instanceof Error ? e.message : "Error"); }
    finally { setPendingAction(null); }
  }

  const activeMembers   = members.filter((m) => m.active);
  const inactiveMembers = members.filter((m) => !m.active);

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-black text-gray-900">Equipo</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {activeMembers.length} activo{activeMembers.length !== 1 ? "s" : ""}
            {inactiveMembers.length > 0 && ` · ${inactiveMembers.length} inactivo${inactiveMembers.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button onClick={() => setShowInvite(true)}
          className="px-3 py-2 text-xs font-bold rounded-xl bg-[#1A5C7A] text-white hover:bg-[#0e4560] transition flex items-center gap-2">
          <span>+</span> Invitar usuario
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-4 py-3">{error}</div>
      )}

      {loading ? (
        <div className="text-center py-12 text-sm text-gray-400">Cargando equipo…</div>
      ) : members.length === 0 ? (
        <div className="text-center py-12 text-sm text-gray-400">Aún no hay otros usuarios en la clínica</div>
      ) : (
        <div className="flex flex-col gap-2">
          {[...activeMembers, ...inactiveMembers].map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              isSelf={m.id === currentUser.id}
              canManage={currentUser.role !== "USER" && m.role !== "SUPERADMIN" || currentUser.role === "SUPERADMIN"}
              pending={pendingAction === m.id}
              onSetActive={(active) => setActive(m, active)}
              onSetRole={(role) => setRole(m, role)}
              onSetClinicalRole={(cr) => setClinicalRole(m, cr)}
            />
          ))}
        </div>
      )}

      {showInvite && (
        <InviteModal
          clinicId={clinicId}
          onClose={() => setShowInvite(false)}
          onCreated={(member) => {
            setMembers((m) => [member, ...m]);
            setShowInvite(false);
          }}
        />
      )}
    </div>
  );
}

interface MemberRowProps {
  member: TeamMember;
  isSelf: boolean;
  canManage: boolean;
  pending: boolean;
  onSetActive: (active: boolean) => void;
  onSetRole: (role: "USER" | "ADMIN") => void;
  onSetClinicalRole: (role: ClinicalRole | null) => void;
}

function MemberRow({ member, isSelf, canManage, pending, onSetActive, onSetRole, onSetClinicalRole }: MemberRowProps) {
  const initials = getInitials(member.name);
  const roleMeta = ROLE_LABELS[member.role];
  const inactive = !member.active;

  return (
    <div className={`bg-white rounded-2xl border p-4 flex items-center gap-4 transition ${
      inactive ? "border-gray-100 opacity-60" : "border-gray-100 hover:border-gray-200"
    }`}>
      {/* Avatar */}
      <div className="shrink-0">
        {member.photoUrl ? (
          <img src={member.photoUrl} alt={member.name} className="w-12 h-12 rounded-xl object-cover" />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1A5C7A] to-[#0e4560] text-white flex items-center justify-center text-sm font-black">
            {initials}
          </div>
        )}
      </div>

      {/* Identidad */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-0.5">
          <span className="text-sm font-bold text-gray-900 truncate">{member.name}</span>
          {isSelf && <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">tú</span>}
          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${roleMeta.chip}`}>
            {roleMeta.label}
          </span>
          {member.clinicalRole && (
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-teal-100 text-teal-700">
              🩺 {CLINICAL_ROLE_LABELS[member.clinicalRole]}
            </span>
          )}
          {inactive && (
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-100 text-red-700">
              Inactivo
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 truncate">{member.occupation || member.email}</p>
        {member.occupation && (
          <p className="text-[11px] text-gray-400 truncate">{member.email}</p>
        )}
      </div>

      {/* Acciones */}
      {canManage && !isSelf && member.role !== "SUPERADMIN" && (
        <div className="shrink-0 flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-1.5">
            <select
              value={member.role}
              onChange={(e) => onSetRole(e.target.value as "USER" | "ADMIN")}
              disabled={pending || inactive}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-[#1A5C7A] disabled:opacity-50"
              title="Rol de plataforma"
            >
              <option value="USER">Usuario</option>
              <option value="ADMIN">Admin</option>
            </select>
            <select
              value={member.clinicalRole ?? ""}
              onChange={(e) => onSetClinicalRole((e.target.value || null) as ClinicalRole | null)}
              disabled={pending || inactive}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-[#1A5C7A] disabled:opacity-50"
              title="Rol clínico (permisos sobre ficha)"
            >
              <option value="">Sin rol clínico</option>
              {(Object.entries(CLINICAL_ROLE_LABELS) as [ClinicalRole, string][]).map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </select>
            <button onClick={() => onSetActive(!inactive)} disabled={pending}
              className={`text-xs font-bold px-2.5 py-1.5 rounded-lg transition disabled:opacity-50 ${
                inactive
                  ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  : "bg-red-50 text-red-600 hover:bg-red-100"
              }`}>
              {pending ? "…" : inactive ? "Reactivar" : "Desactivar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface InviteModalProps {
  clinicId: string;
  onClose: () => void;
  onCreated: (member: TeamMember) => void;
}

function InviteModal({ clinicId, onClose, onCreated }: InviteModalProps) {
  const [name,       setName]       = useState("");
  const [email,      setEmail]      = useState("");
  const [occupation, setOccupation] = useState("");
  const [role,       setRole]       = useState<"USER" | "ADMIN">("USER");
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState("");
  const [tempPass,   setTempPass]   = useState<string | null>(null);
  const [createdName, setCreatedName] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setSaving(true); setError("");
    try {
      const result = await inviteTeamMember(clinicId, {
        name: name.trim(), email: email.trim(), role,
        occupation: occupation.trim() || undefined,
      });
      onCreated(result.user);
      setTempPass(result.tempPassword);
      setCreatedName(result.user.name);
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally { setSaving(false); }
  }

  async function copyPass() {
    if (!tempPass) return;
    try { await navigator.clipboard.writeText(tempPass); } catch { /* ignore */ }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-800">
            {tempPass ? "Usuario creado" : "Invitar nuevo usuario"}
          </h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 text-lg leading-none">✕</button>
        </div>

        {tempPass ? (
          <div className="p-5 flex flex-col gap-4">
            <p className="text-sm text-gray-600">
              ✅ <strong>{createdName}</strong> fue creado/a. Comparte estos datos de forma segura — la contraseña no se mostrará nuevamente.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col gap-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Contraseña temporal</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm font-mono bg-white px-3 py-2 rounded-lg border border-amber-200 select-all">{tempPass}</code>
                <button onClick={copyPass}
                  className="text-xs font-bold px-3 py-2 rounded-lg bg-amber-700 text-white hover:bg-amber-800 transition">
                  Copiar
                </button>
              </div>
              <p className="text-[11px] text-amber-700">El usuario debe cambiarla en su próximo login (próximamente).</p>
            </div>
            <button onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-[#1A5C7A] text-white text-sm font-bold hover:bg-[#0e4560] transition">
              Cerrar
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="p-5 flex flex-col gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Nombre completo *</label>
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Dra. María González"
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1A5C7A]/30 focus:border-[#1A5C7A]" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Email *</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="maria@galana.cl"
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1A5C7A]/30 focus:border-[#1A5C7A]" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Ocupación / título</label>
              <input value={occupation} onChange={(e) => setOccupation(e.target.value)}
                placeholder="Ej: Odontóloga General"
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1A5C7A]/30 focus:border-[#1A5C7A]" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Rol</label>
              <div className="grid grid-cols-2 gap-2">
                {(["USER", "ADMIN"] as const).map((r) => (
                  <button key={r} type="button" onClick={() => setRole(r)}
                    className={`px-3 py-2 text-xs font-bold rounded-xl border transition ${
                      role === r
                        ? "bg-[#1A5C7A] text-white border-[#1A5C7A]"
                        : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                    }`}>
                    {ROLE_LABELS[r].label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5">Los ADMIN pueden gestionar el equipo y editar la clínica.</p>
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="flex gap-2">
              <button type="button" onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm font-bold hover:border-gray-300 transition">
                Cancelar
              </button>
              <button type="submit" disabled={saving || !name.trim() || !email.trim()}
                className="flex-1 py-2.5 rounded-xl bg-[#1A5C7A] text-white text-sm font-bold hover:bg-[#0e4560] transition disabled:opacity-50">
                {saving ? "Creando…" : "Crear usuario"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
