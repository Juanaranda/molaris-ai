"use client";

import { useEffect, useRef, useState } from "react";
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

/* ── CSV Import modal ────────────────────────────────────────────────── */
type ImportStep = "upload" | "preview" | "result";

interface ImportResult { created: number; skipped: number; total: number; errors: string[]; }
interface PreviewRow { [col: string]: string; }

function ImportCSVModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep]         = useState<ImportStep>("upload");
  const [csvText, setCsvText]   = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview]   = useState<PreviewRow[]>([]);
  const [headers, setHeaders]   = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult]     = useState<ImportResult | null>(null);
  const [error, setError]       = useState("");

  function parsePreview(text: string) {
    const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return;
    const delim = lines[0].split(";").length > lines[0].split(",").length ? ";" : ",";
    const hdrs = lines[0].split(delim).map((h) => h.trim().replace(/^["']|["']$/g, ""));
    const rows = lines.slice(1, 6).map((line) => {
      const vals = line.split(delim).map((v) => v.trim().replace(/^["']|["']$/g, ""));
      const row: PreviewRow = {};
      hdrs.forEach((h, i) => { row[h] = vals[i] ?? ""; });
      return row;
    });
    setHeaders(hdrs);
    setPreview(rows);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvText(text);
      parsePreview(text);
      setStep("preview");
      setError("");
    };
    reader.readAsText(file, "UTF-8");
  }

  async function handleImport() {
    setImporting(true); setError("");
    try {
      const token = getToken();
      const res = await fetch(`${API}/api/patients/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ csv: csvText }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Error al importar"); return; }
      setResult(data);
      setStep("result");
      onSuccess();
    } catch {
      setError("Error de conexión");
    } finally { setImporting(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-2xl w-full max-w-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
          <div>
            <h2 className="text-base font-black text-gray-900">Importar pacientes desde CSV</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {step === "upload" && "Sube un archivo CSV de Reservo, Dentalink u otro sistema"}
              {step === "preview" && `${fileName} — ${preview.length} fila${preview.length !== 1 ? "s" : ""} de preview`}
              {step === "result" && "Importación completada"}
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 transition flex items-center justify-center text-gray-500 shrink-0">✕</button>
        </div>

        <div className="px-6 py-5">
          {/* Step: upload */}
          {step === "upload" && (
            <div className="flex flex-col gap-5">
              {/* Drop zone */}
              <button
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center hover:border-blue-300 hover:bg-blue-50 transition cursor-pointer w-full">
                <div className="text-4xl mb-3">📄</div>
                <p className="text-sm font-bold text-gray-700 mb-1">Haz clic para seleccionar un archivo CSV</p>
                <p className="text-xs text-gray-400">Compatible con Reservo, Dentalink, Excel exportado como CSV</p>
              </button>
              <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />

              {/* Format guide */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <p className="text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Columnas aceptadas</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                  {[
                    ["Nombre paciente", "nombre, paciente, name"],
                    ["RUT",             "rut, run, dni"],
                    ["Teléfono",        "telefono, celular, phone"],
                    ["Email",           "email, correo, mail"],
                    ["Fecha",           "fecha, date (DD/MM/YYYY)"],
                    ["Hora",            "hora, time (HH:MM)"],
                    ["Doctor",          "doctor, profesional, dentista"],
                    ["Servicio",        "servicio, tratamiento"],
                  ].map(([campo, cols]) => (
                    <div key={campo} className="flex gap-2 text-xs">
                      <span className="font-semibold text-slate-700 w-28 shrink-0">{campo}:</span>
                      <span className="text-slate-400">{cols}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-3">La fila "Nombre paciente" y "Fecha" son obligatorias. El separador puede ser coma (,) o punto y coma (;).</p>
              </div>
            </div>
          )}

          {/* Step: preview */}
          {step === "preview" && (
            <div className="flex flex-col gap-4">
              <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50">
                      {headers.map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-bold text-gray-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {preview.map((row, i) => (
                      <tr key={i}>
                        {headers.map((h) => (
                          <td key={h} className="px-3 py-2 text-gray-700 whitespace-nowrap max-w-[160px] truncate">{row[h] ?? ""}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 text-center">
                Mostrando máx. 5 filas de preview. El sistema detectará automáticamente las columnas.
              </p>
              {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
              <div className="flex gap-3">
                <button onClick={() => { setStep("upload"); setError(""); }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition">
                  Cambiar archivo
                </button>
                <button onClick={handleImport} disabled={importing}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: "#D95F45" }}>
                  {importing ? "Importando..." : "Confirmar importación"}
                </button>
              </div>
            </div>
          )}

          {/* Step: result */}
          {step === "result" && result && (
            <div className="flex flex-col items-center gap-5 py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center text-3xl">
                ✅
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900 text-center mb-1">¡Importación completada!</h3>
                <p className="text-sm text-gray-500 text-center">{result.total} filas procesadas</p>
              </div>
              <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
                <div className="bg-emerald-50 rounded-xl p-4 text-center border border-emerald-100">
                  <p className="text-3xl font-black text-emerald-600">{result.created}</p>
                  <p className="text-xs font-semibold text-emerald-600 mt-1">Creadas</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
                  <p className="text-3xl font-black text-gray-400">{result.skipped}</p>
                  <p className="text-xs font-semibold text-gray-400 mt-1">Omitidas</p>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="w-full bg-amber-50 border border-amber-100 rounded-xl p-3">
                  <p className="text-xs font-bold text-amber-700 mb-1">Advertencias ({result.errors.length})</p>
                  <ul className="text-xs text-amber-600 space-y-0.5">
                    {result.errors.map((e, i) => <li key={i}>• {e}</li>)}
                  </ul>
                </div>
              )}
              <button onClick={onClose}
                className="px-8 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition">
                Listo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Main PatientsTab ─────────────────────────────────────────────────── */
export function PatientsTab() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [showImport, setShowImport] = useState(false);
  const [selected, setSelected] = useState<Patient | null>(null);

  function loadPatients() {
    const token = getToken(); if (!token) return;
    setLoading(true);
    fetch(`${API}/api/patients`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setPatients)
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadPatients(); }, []);

  const filtered = patients.filter((p) => {
    const q = search.toLowerCase();
    return !q || p.name.toLowerCase().includes(q) || (p.rut ?? "").includes(q) || (p.phone ?? "").includes(q);
  });

  return (
    <div className="flex flex-col gap-5">
      {/* Search + import */}
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
        <span className="text-xs font-semibold text-gray-400 shrink-0 hidden sm:block">
          {filtered.length} paciente{filtered.length !== 1 ? "s" : ""}
        </span>
        <button onClick={() => setShowImport(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-600 hover:border-blue-300 hover:text-blue-600 transition shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          Importar CSV
        </button>
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

      {showImport && (
        <ImportCSVModal
          onClose={() => setShowImport(false)}
          onSuccess={() => { setShowImport(false); loadPatients(); }}
        />
      )}
    </div>
  );
}
