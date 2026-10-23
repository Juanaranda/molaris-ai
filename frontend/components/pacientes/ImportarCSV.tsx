import { useRef, useState } from "react";
import { FileText } from "lucide-react";
import { Button, Dialogo } from "@/components/ui";
import { getToken } from "@/lib/auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type ImportStep = "upload" | "preview" | "result";
interface ImportResult { created: number; skipped: number; total: number; errors: string[]; }
interface PreviewRow { [col: string]: string; }

const COLUMNAS: [string, string][] = [
  ["Nombre",     "Nombre + apellido paterno/materno (Dentalink) o una columna con todo"],
  ["RUT",        "rut, run, dni"],
  ["Teléfono",   "teléfono móvil (preferido), teléfono, celular"],
  ["Email",      "correo electrónico, email, correo"],
  ["Fecha cita", "fecha cita, fecha consulta (DD-MM-AAAA o AAAA-MM-DD)"],
  ["Hora",       "hora, time (HH:MM)"],
  ["Doctor",     "doctor, profesional, dentista"],
  ["Servicio",   "servicio, tratamiento, prestación"],
];

export function ImportCSVModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
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
      setError("Error de conexión. Revisa tu internet y vuelve a intentar.");
    } finally { setImporting(false); }
  }

  const subtitulo =
    step === "upload" ? "Sube un archivo CSV exportado desde tu sistema actual"
    : step === "preview" ? `${fileName}: primeras ${preview.length} fila${preview.length !== 1 ? "s" : ""}`
    : "Importación terminada";

  return (
    <Dialogo titulo="Importar pacientes desde CSV" subtitulo={subtitulo} onClose={onClose} ancho="xl" capa={50}>
      <div className="px-5 py-5">
        {step === "upload" && (
          <div className="flex flex-col gap-5">
            <button type="button" onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-card border-2 border-dashed border-line px-6 py-10 text-center transition-colors hover:border-brand hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-brand">
              <FileText className="h-6 w-6 text-ink-muted" aria-hidden />
              <span className="text-sm font-bold text-ink">Elige un archivo CSV</span>
              <span className="text-[13px] text-ink-muted">Sirve cualquier exportación CSV de tu sistema de gestión</span>
            </button>
            <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />

            <div className="rounded-control bg-ground p-4">
              <p className="mb-2 text-sm font-bold text-ink">Columnas que se reconocen solas</p>
              <dl className="mb-3 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                {COLUMNAS.map(([campo, desc]) => (
                  <div key={campo} className="flex gap-2 text-[13px]">
                    <dt className="w-24 shrink-0 font-semibold text-ink">{campo}</dt>
                    <dd className="text-ink-muted">{desc}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-[13px] text-ink-muted">
                El separador puede ser coma (,) o punto y coma (;). Si no hay fecha de cita, los pacientes quedan con la fecha de hoy.
              </p>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="flex flex-col gap-4">
            <div className="overflow-x-auto rounded-control border border-line">
              <table className="w-full text-[13px]">
                <thead>
                  <tr>
                    {headers.map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-medium whitespace-nowrap text-ink-muted">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} className="border-t border-line-soft">
                      {headers.map((h) => (
                        <td key={h} className="max-w-[160px] truncate px-3 py-2 whitespace-nowrap text-ink">{row[h] ?? ""}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[13px] text-ink-muted">Se muestran hasta 5 filas. Las columnas se detectan solas al importar.</p>
            {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => { setStep("upload"); setError(""); }}>Cambiar archivo</Button>
              <Button className="flex-1" onClick={handleImport} loading={importing}>
                {importing ? "Importando…" : "Importar pacientes"}
              </Button>
            </div>
          </div>
        )}

        {step === "result" && result && (
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-lg font-bold text-brand-strong">Importación terminada</p>
              <p className="text-sm text-ink-muted tabular-nums">{result.total} filas revisadas</p>
            </div>
            <div className="grid grid-cols-2 rounded-control border border-line">
              <div className="px-4 py-3">
                <p className="text-[13px] text-ink-muted">Pacientes creados</p>
                <p className="text-2xl font-semibold text-ok tabular-nums">{result.created}</p>
              </div>
              <div className="border-l border-line px-4 py-3">
                <p className="text-[13px] text-ink-muted">Omitidos</p>
                <p className="text-2xl font-semibold text-ink tabular-nums">{result.skipped}</p>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="rounded-control border border-warn/30 bg-warn-soft p-3">
                <p className="mb-1 text-sm font-bold text-warn">Advertencias ({result.errors.length})</p>
                <ul className="list-disc space-y-0.5 pl-4 text-[13px] text-ink">
                  {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}
            <Button onClick={onClose} className="self-end">Listo</Button>
          </div>
        )}
      </div>
    </Dialogo>
  );
}
