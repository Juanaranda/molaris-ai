"use client";

import { useEffect, useState } from "react";
import { getToken } from "@/lib/auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const MONTHS = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

interface Patient {
  key: string; name: string; rut: string | null; phone: string | null; email: string | null;
  visits: number; lastVisit: string; lastDoctor: string; services: string[];
}

interface HistoryEntry {
  id: string; doctor: string; date: string; time: string;
  service: string | null; status: string; notes: string | null;
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    confirmed: "bg-emerald-50 text-emerald-700 border-emerald-100",
    pending:   "bg-amber-50 text-amber-700 border-amber-100",
    cancelled: "bg-gray-50 text-gray-400 border-gray-100",
  };
  const labels: Record<string, string> = { confirmed: "Confirmada", pending: "Pendiente", cancelled: "Cancelada" };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${map[status] ?? map.pending}`}>
      {labels[status] ?? status}
    </span>
  );
}

function PatientDetail({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!patient.rut) return;
    const token = getToken(); if (!token) return;
    setLoading(true);
    fetch(`${API}/api/patients/${encodeURIComponent(patient.rut)}/history`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setHistory)
      .finally(() => setLoading(false));
  }, [patient.rut]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-6 py-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white font-black text-sm mb-3">
                {patient.name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
              </div>
              <h2 className="text-lg font-black text-white">{patient.name}</h2>
              {patient.rut && <p className="text-sm text-white/60 mt-0.5">{patient.rut}</p>}
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition flex items-center justify-center text-white/70">
              ✕
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            {patient.phone && (
              <div>
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-wide">Teléfono</p>
                <p className="text-sm font-semibold text-white/90">{patient.phone}</p>
              </div>
            )}
            {patient.email && (
              <div>
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-wide">Email</p>
                <p className="text-sm font-semibold text-white/90">{patient.email}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] text-white/40 font-bold uppercase tracking-wide">Visitas totales</p>
              <p className="text-sm font-semibold text-white/90">{patient.visits}</p>
            </div>
            <div>
              <p className="text-[10px] text-white/40 font-bold uppercase tracking-wide">Última visita</p>
              <p className="text-sm font-semibold text-white/90">{fmtDate(patient.lastVisit)}</p>
            </div>
          </div>
          {patient.services.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {patient.services.map((s) => (
                <span key={s} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-white/70">{s}</span>
              ))}
            </div>
          )}
        </div>

        {/* History */}
        <div className="flex flex-col overflow-hidden" style={{ maxHeight: 340 }}>
          <div className="px-5 py-3 border-b border-gray-50">
            <h3 className="text-sm font-bold text-gray-800">Historial de citas</h3>
          </div>
          <div className="overflow-y-auto">
            {loading ? (
              <div className="p-5 space-y-3">
                {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />)}
              </div>
            ) : history.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Sin historial disponible</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {history.map((h) => (
                  <div key={h.id} className="flex items-center gap-4 px-5 py-3">
                    <div className="shrink-0 text-center w-20">
                      <p className="text-xs font-bold text-gray-800">{h.time}</p>
                      <p className="text-[10px] text-gray-400">{fmtDate(h.date)}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-700 truncate">{h.doctor.replace("Dra. ","").replace("Dr. ","")}</p>
                      {h.service && <p className="text-[11px] text-gray-400 truncate">{h.service}</p>}
                    </div>
                    <StatusPill status={h.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PatientsTab() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [selected, setSelected] = useState<Patient | null>(null);

  useEffect(() => {
    const token = getToken(); if (!token) return;
    fetch(`${API}/api/patients`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setPatients)
      .finally(() => setLoading(false));
  }, []);

  const filtered = patients.filter((p) => {
    const q = search.toLowerCase();
    return !q || p.name.toLowerCase().includes(q) || (p.rut ?? "").includes(q) || (p.phone ?? "").includes(q);
  });

  return (
    <div className="flex flex-col gap-5">
      {/* Search + count */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, RUT o teléfono..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
        </div>
        <span className="text-xs font-semibold text-gray-400 shrink-0">{filtered.length} paciente{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Patient list */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">👤</p>
            <p className="text-sm font-medium text-gray-500">
              {search ? "No se encontró ningún paciente" : "Sin pacientes registrados"}
            </p>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="hidden sm:grid grid-cols-[1fr_110px_130px_110px_90px_40px] gap-4 px-5 py-2.5 border-b border-gray-50">
              {["Paciente", "RUT", "Teléfono", "Última visita", "Visitas", ""].map((h) => (
                <span key={h} className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{h}</span>
              ))}
            </div>
            <div className="divide-y divide-gray-50">
              {filtered.map((p) => (
                <button key={p.key} onClick={() => setSelected(p)}
                  className="w-full text-left px-5 py-3.5 hover:bg-gray-50 transition group flex sm:grid sm:grid-cols-[1fr_110px_130px_110px_90px_40px] sm:gap-4 items-center gap-3">
                  {/* Name + initials */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-black text-slate-500 shrink-0">
                      {p.name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{p.name}</p>
                      {p.services.length > 0 && (
                        <p className="text-[11px] text-gray-400 truncate">{p.services.slice(0, 2).join(", ")}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 hidden sm:block">{p.rut ?? "—"}</span>
                  <span className="text-xs text-gray-500 hidden sm:block">{p.phone ?? "—"}</span>
                  <span className="text-xs text-gray-500 hidden sm:block">{fmtDate(p.lastVisit)}</span>
                  <span className="text-xs font-bold text-blue-600 hidden sm:block">{p.visits}</span>
                  <span className="text-gray-300 group-hover:text-gray-400 transition text-sm shrink-0">›</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {selected && <PatientDetail patient={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
