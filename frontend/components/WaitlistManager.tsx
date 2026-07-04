"use client";

import { useCallback, useEffect, useState } from "react";
import {
  WaitlistEntry,
  listWaitlist, addToWaitlist, updateWaitlistEntry, removeWaitlistEntry,
} from "@/lib/waitlist";

interface Props {
  clinicId: string;
  onClose: () => void;
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  waiting:   { label: "Esperando", cls: "bg-amber-100 text-amber-800" },
  notified:  { label: "Notificado", cls: "bg-blue-100 text-blue-800" },
  converted: { label: "Convertido", cls: "bg-emerald-100 text-emerald-800" },
  expired:   { label: "Expirado",  cls: "bg-gray-100 text-gray-500" },
  cancelled: { label: "Cancelado", cls: "bg-red-100 text-red-700" },
};

export function WaitlistManager({ clinicId, onClose }: Props) {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [busyId,  setBusyId]  = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true); setError("");
    try { setEntries(await listWaitlist(clinicId)); }
    catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally   { setLoading(false); }
  }, [clinicId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function setStatus(entry: WaitlistEntry, status: WaitlistEntry["status"]) {
    if (!confirm(`Marcar a ${entry.patientName} como ${STATUS_META[status]?.label.toLowerCase()}?`)) return;
    setBusyId(entry.id);
    try {
      const updated = await updateWaitlistEntry(clinicId, entry.id, { status });
      setEntries((arr) => arr.map((e) => e.id === entry.id ? updated : e));
    } catch (e) { alert(e instanceof Error ? e.message : "Error"); }
    finally    { setBusyId(null); }
  }

  async function remove(entry: WaitlistEntry) {
    if (!confirm(`Eliminar a ${entry.patientName} de la lista de espera?`)) return;
    setBusyId(entry.id);
    try {
      await removeWaitlistEntry(clinicId, entry.id);
      setEntries((arr) => arr.filter((e) => e.id !== entry.id));
    } catch (e) { alert(e instanceof Error ? e.message : "Error"); }
    finally    { setBusyId(null); }
  }

  const waiting   = entries.filter((e) => e.status === "waiting");
  const notified  = entries.filter((e) => e.status === "notified");
  const other     = entries.filter((e) => !["waiting", "notified"].includes(e.status));

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-stretch sm:items-center justify-center sm:p-4">
      <div className="bg-white rounded-none sm:rounded-2xl shadow-2xl w-full sm:max-w-3xl flex flex-col max-h-[100vh] sm:max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Lista de espera</h2>
            <p className="text-[11px] text-gray-400">
              {waiting.length} esperando · {notified.length} notificado{notified.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowAdd(true)}
              className="text-xs font-bold px-3 py-1.5 rounded-xl bg-[#1A5C7A] text-white hover:bg-[#0e4560] transition">
              + Agregar
            </button>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-400 text-lg leading-none">✕</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading && <div className="text-center text-sm text-gray-400 py-10">Cargando…</div>}
          {error && <div className="text-center text-sm text-red-500 py-10">{error}</div>}
          {!loading && !error && entries.length === 0 && (
            <div className="text-center text-sm text-gray-400 py-10">
              Lista vacía. Cuando se libere un cupo (cita cancelada), Molaris avisa al primero en la lista automáticamente.
            </div>
          )}
          {!loading && entries.length > 0 && (
            <div className="flex flex-col gap-2">
              {[...waiting, ...notified, ...other].map((e) => (
                <EntryRow key={e.id} entry={e} busy={busyId === e.id}
                  onSetStatus={setStatus} onRemove={remove} />
              ))}
            </div>
          )}
        </div>

        {showAdd && (
          <AddModal clinicId={clinicId} onClose={() => setShowAdd(false)}
            onAdded={(e) => { setEntries((arr) => [e, ...arr]); setShowAdd(false); }} />
        )}
      </div>
    </div>
  );
}

function EntryRow({ entry, busy, onSetStatus, onRemove }: {
  entry: WaitlistEntry; busy: boolean;
  onSetStatus: (e: WaitlistEntry, s: WaitlistEntry["status"]) => void;
  onRemove:    (e: WaitlistEntry) => void;
}) {
  const meta = STATUS_META[entry.status] ?? STATUS_META.waiting;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="text-sm font-bold text-gray-900 truncate">{entry.patientName}</span>
          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${meta.cls}`}>{meta.label}</span>
        </div>
        <p className="text-[11px] text-gray-500 truncate">
          📞 {entry.patientPhone}
          {entry.preferredDoctor  && <span> · 👩‍⚕️ {entry.preferredDoctor}</span>}
          {entry.preferredService && <span> · 🔬 {entry.preferredService}</span>}
        </p>
        {(entry.dateFrom || entry.dateTo) && (
          <p className="text-[10px] text-gray-400">
            Rango: {entry.dateFrom ? new Date(entry.dateFrom).toLocaleDateString("es-CL") : "—"}
            {" → "}
            {entry.dateTo ? new Date(entry.dateTo).toLocaleDateString("es-CL") : "—"}
          </p>
        )}
        {entry.notifiedForDate && (
          <p className="text-[10px] text-blue-600 mt-0.5">
            Avisado para el {new Date(entry.notifiedForDate).toLocaleDateString("es-CL")}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {entry.status === "waiting" && (
          <button onClick={() => onSetStatus(entry, "cancelled")} disabled={busy}
            className="text-[11px] font-bold px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50">
            Cancelar
          </button>
        )}
        {entry.status === "notified" && (
          <>
            <button onClick={() => onSetStatus(entry, "converted")} disabled={busy}
              className="text-[11px] font-bold px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
              ✓ Confirmó
            </button>
            <button onClick={() => onSetStatus(entry, "waiting")} disabled={busy}
              className="text-[11px] font-bold px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50">
              Volver a esperar
            </button>
          </>
        )}
        <button onClick={() => onRemove(entry)} disabled={busy}
          className="text-[11px] font-bold px-2 py-1 rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-50">
          ✕
        </button>
      </div>
    </div>
  );
}

function AddModal({ clinicId, onClose, onAdded }: {
  clinicId: string; onClose: () => void; onAdded: (e: WaitlistEntry) => void;
}) {
  const [name,    setName]    = useState("");
  const [phone,   setPhone]   = useState("");
  const [doctor,  setDoctor]  = useState("");
  const [service, setService] = useState("");
  const [from,    setFrom]    = useState("");
  const [to,      setTo]      = useState("");
  const [notes,   setNotes]   = useState("");
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) { setError("Nombre y teléfono son obligatorios"); return; }
    setSaving(true); setError("");
    try {
      const entry = await addToWaitlist(clinicId, {
        patientName: name.trim(),
        patientPhone: phone.trim(),
        preferredDoctor:  doctor.trim() || undefined,
        preferredService: service.trim() || undefined,
        dateFrom: from || undefined,
        dateTo:   to   || undefined,
        notes:    notes.trim() || undefined,
      });
      onAdded(entry);
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally    { setSaving(false); }
  }

  const inputCls = "w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1A5C7A]/30 focus:border-[#1A5C7A]";

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
          <h3 className="text-sm font-bold text-gray-800">Agregar a lista de espera</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 text-lg">✕</button>
        </div>
        <form onSubmit={submit} className="p-5 flex flex-col gap-3 overflow-y-auto">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Nombre *</label>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Teléfono *</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+56912345678" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Doctor preferido</label>
              <input value={doctor} onChange={(e) => setDoctor(e.target.value)} placeholder="Cualquiera" className={inputCls} />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Servicio</label>
              <input value={service} onChange={(e) => setService(e.target.value)} placeholder="Cualquiera" className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Desde</label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Hasta</label>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Notas</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputCls} resize-none`} />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <p className="text-[10px] text-gray-400">
            Cuando se libere un cupo que coincida, Molaris avisa por WhatsApp automáticamente.
          </p>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-500 text-sm font-bold hover:border-gray-300">Cancelar</button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 rounded-xl bg-[#1A5C7A] text-white text-sm font-bold hover:bg-[#0e4560] disabled:opacity-50">
              {saving ? "Guardando…" : "Agregar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
