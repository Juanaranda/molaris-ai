"use client";

import { useCallback, useEffect, useState } from "react";
import { getMe } from "@/lib/auth";
import {
  ConsentTemplate, ConsentSignature, SignatureMethod,
  listConsentTemplates, listConsentSignatures,
  requestSignature, updateSignature, renderConsent,
} from "@/lib/consents";
import { Check, Globe, Paperclip, PenLine, Printer, X, type LucideIcon } from "lucide-react";

interface Props {
  patientId: string;
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending:   { label: "Pendiente",   cls: "bg-amber-100 text-amber-800" },
  signed:    { label: "Firmado",     cls: "bg-emerald-100 text-emerald-800" },
  rejected:  { label: "Rechazado",   cls: "bg-red-100 text-red-700" },
  expired:   { label: "Expirado",    cls: "bg-gray-100 text-gray-500" },
  cancelled: { label: "Cancelado",   cls: "bg-gray-100 text-gray-500" },
};

const METHOD_META: Record<SignatureMethod, { label: string; Icono: LucideIcon }> = {
  zapsign:        { label: "ZapSign (online)",     Icono: Globe },
  manual_upload:  { label: "Subir PDF firmado",    Icono: Paperclip },
  in_person_pad:  { label: "Firma en clínica",     Icono: PenLine },
};

/**
 * Panel de consentimientos informados (Issue #36).
 * Embebido como tab en PatientRecordModal.
 */
export function ConsentsPanel({ patientId }: Props) {
  const [templates,  setTemplates]  = useState<ConsentTemplate[]>([]);
  const [signatures, setSignatures] = useState<ConsentSignature[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  const [requesting, setRequesting] = useState(false);

  const [showRequest, setShowRequest] = useState(false);
  const [showPreview, setShowPreview] = useState<{ title: string; body: string } | null>(null);
  const [signedLink,  setSignedLink]  = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const me = await getMe();
      if (!me?.clinic?.id) throw new Error("Sin clínica activa");
      const [tpls, sigs] = await Promise.all([
        listConsentTemplates(me.clinic.id),
        listConsentSignatures(patientId),
      ]);
      setTemplates(tpls);
      setSignatures(sigs);
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally     { setLoading(false); }
  }, [patientId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function handleRequest(templateId: string, method: SignatureMethod) {
    setRequesting(true); setError("");
    try {
      const { signUrl } = await requestSignature(patientId, { templateId, signatureMethod: method });
      setShowRequest(false);
      if (signUrl) setSignedLink(signUrl);
      await fetchAll();
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally    { setRequesting(false); }
  }

  async function handlePreview(templateId: string) {
    try {
      const rendered = await renderConsent(patientId, templateId);
      setShowPreview(rendered);
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
  }

  async function uploadSignedPdf(sigId: string, file: File) {
    if (file.size > 1_200_000) { alert("Archivo muy grande (máx 1.2 MB)"); return; }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
      reader.readAsDataURL(file);
    });
    try {
      await updateSignature(sigId, { signedDocumentUrl: dataUrl, status: "signed", signedAt: new Date().toISOString() });
      await fetchAll();
    } catch (e) { alert(e instanceof Error ? e.message : "Error"); }
  }

  async function cancelSignature(sigId: string) {
    if (!confirm("Cancelar esta solicitud de firma?")) return;
    try {
      await updateSignature(sigId, { status: "cancelled" });
      await fetchAll();
    } catch (e) { alert(e instanceof Error ? e.message : "Error"); }
  }

  if (loading) return <div className="py-8 text-sm text-gray-400 text-center">Cargando consentimientos…</div>;
  if (error)   return <div className="py-8 text-sm text-red-500 text-center">{error}</div>;

  const pending = signatures.filter((s) => s.status === "pending");
  const signed  = signatures.filter((s) => s.status === "signed");
  const other   = signatures.filter((s) => !["pending", "signed"].includes(s.status));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Consentimientos informados</h3>
          <p className="text-[11px] text-gray-400">
            Ley 20.584 · {signed.length} firmado{signed.length !== 1 ? "s" : ""} · {pending.length} pendiente{pending.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button onClick={() => setShowRequest(true)}
          className="text-xs font-bold px-3 py-1.5 rounded-xl bg-[#1A5C7A] text-white hover:bg-[#0e4560] transition">
          + Solicitar firma
        </button>
      </div>

      {/* Banner ZapSign link */}
      {signedLink && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-emerald-800 mb-1"><Check className="w-3.5 h-3.5 inline-block mr-1 align-[-2px]" aria-hidden />Link de firma generado</p>
            <code className="text-[10px] font-mono bg-white px-2 py-1 rounded border border-emerald-200 break-all block">{signedLink}</code>
            <p className="text-[11px] text-emerald-700 mt-2">Compartilo con el paciente. ZapSign avisa cuando firme.</p>
          </div>
          <button onClick={() => setSignedLink(null)} className="text-emerald-600 hover:text-emerald-800"><X className="w-4 h-4" aria-hidden /></button>
        </div>
      )}

      {/* Lista de firmas */}
      {signatures.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">Sin consentimientos solicitados.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {[...pending, ...signed, ...other].map((sig) => (
            <SignatureRow key={sig.id} sig={sig}
              onPreview={() => handlePreview(sig.templateId)}
              onUploadPdf={(file) => uploadSignedPdf(sig.id, file)}
              onCancel={() => cancelSignature(sig.id)} />
          ))}
        </div>
      )}

      {showRequest && (
        <RequestModal
          templates={templates}
          requesting={requesting}
          onClose={() => setShowRequest(false)}
          onRequest={handleRequest}
          onPreview={handlePreview}
        />
      )}

      {showPreview && (
        <PreviewModal {...showPreview} onClose={() => setShowPreview(null)} />
      )}
    </div>
  );
}

function SignatureRow({ sig, onPreview, onUploadPdf, onCancel }: {
  sig: ConsentSignature;
  onPreview: () => void;
  onUploadPdf: (file: File) => void;
  onCancel: () => void;
}) {
  const status = STATUS_META[sig.status] ?? STATUS_META.pending;
  const method = METHOD_META[sig.signatureMethod];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-sm font-bold text-gray-900 truncate">{sig.template.title}</span>
          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${status.cls}`}>{status.label}</span>
        </div>
        <p className="text-[11px] text-gray-500">
          <method.Icono className="w-3.5 h-3.5 inline-block align-[-2px] mr-1" aria-hidden />{method.label} · solicitado {new Date(sig.requestedAt).toLocaleDateString("es-CL")} por {sig.requestedBy.name}
        </p>
        {sig.signedAt && (
          <p className="text-[11px] text-emerald-600 mt-0.5"><Check className="w-3.5 h-3.5 inline-block mr-1 align-[-2px]" aria-hidden />Firmado el {new Date(sig.signedAt).toLocaleDateString("es-CL")}</p>
        )}
        {sig.notes && <p className="text-[11px] text-gray-400 mt-1 italic">{sig.notes}</p>}
      </div>

      <div className="flex flex-col gap-1.5 shrink-0">
        <button onClick={onPreview}
          className="text-[11px] font-bold px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
          Ver texto
        </button>
        {sig.signedDocumentUrl && (
          <a href={sig.signedDocumentUrl} target="_blank" rel="noopener noreferrer"
            className="text-[11px] font-bold px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-center">
            Ver PDF
          </a>
        )}
        {sig.status === "pending" && sig.signatureMethod === "manual_upload" && (
          <label className="text-[11px] font-bold px-2 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-center cursor-pointer">
            Subir PDF
            <input type="file" accept="application/pdf,image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadPdf(f); }} />
          </label>
        )}
        {sig.status === "pending" && (
          <button onClick={onCancel}
            className="text-[11px] font-bold px-2 py-1 rounded-lg text-red-500 hover:bg-red-50">
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}

function RequestModal({ templates, requesting, onClose, onRequest, onPreview }: {
  templates: ConsentTemplate[];
  requesting: boolean;
  onClose: () => void;
  onRequest: (templateId: string, method: SignatureMethod) => void;
  onPreview: (templateId: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string>(templates[0]?.id ?? "");
  const [method,     setMethod]     = useState<SignatureMethod>("manual_upload");

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
          <h3 className="text-sm font-bold text-gray-800">Solicitar consentimiento</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 text-lg"><X className="w-4 h-4" aria-hidden /></button>
        </div>
        <div className="p-5 flex flex-col gap-4 overflow-y-auto">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Template</label>
            {templates.length === 0 ? (
              <p className="text-sm text-gray-400">Sin templates disponibles</p>
            ) : (
              <div className="flex flex-col gap-1">
                {templates.map((t) => (
                  <div key={t.id} className="flex items-center gap-2">
                    <label className="flex-1 flex items-center gap-2 cursor-pointer">
                      <input type="radio" checked={selectedId === t.id} onChange={() => setSelectedId(t.id)} />
                      <span className="text-sm">{t.title}</span>
                    </label>
                    <button type="button" onClick={() => onPreview(t.id)}
                      className="text-[10px] font-bold text-blue-600 hover:underline">Ver</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Método de firma</label>
            <div className="grid grid-cols-1 gap-2">
              {(Object.entries(METHOD_META) as [SignatureMethod, typeof METHOD_META.zapsign][]).map(([key, m]) => (
                <button key={key} type="button" onClick={() => setMethod(key)}
                  className={`text-left px-3 py-2 text-sm font-bold rounded-xl border transition ${
                    method === key
                      ? "bg-[#1A5C7A] text-white border-[#1A5C7A]"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                  }`}>
                  <m.Icono className="w-3.5 h-3.5 inline-block align-[-2px] mr-1" aria-hidden />{m.label}
                </button>
              ))}
            </div>
            {method === "zapsign" && (
              <p className="text-[10px] text-gray-400 mt-1">Requiere ZapSign configurado en la clínica.</p>
            )}
            {method === "in_person_pad" && (
              <p className="text-[10px] text-gray-400 mt-1">Se marca como firmado al instante. Para registro.</p>
            )}
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-500 text-sm font-bold hover:border-gray-300">Cancelar</button>
            <button type="button" onClick={() => onRequest(selectedId, method)} disabled={requesting || !selectedId}
              className="flex-1 py-2 rounded-xl bg-[#1A5C7A] text-white text-sm font-bold hover:bg-[#0e4560] disabled:opacity-50">
              {requesting ? "Solicitando…" : "Solicitar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewModal({ title, body, onClose }: { title: string; body: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
          <h3 className="text-sm font-bold text-gray-800 truncate">{title}</h3>
          <div className="flex gap-2 items-center">
            <button onClick={() => window.print()}
              className="text-xs font-bold px-3 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
              <Printer className="w-4 h-4 inline-block align-[-3px]" aria-hidden /> Imprimir
            </button>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 text-lg"><X className="w-4 h-4" aria-hidden /></button>
          </div>
        </div>
        <div className="p-6 overflow-y-auto">
          <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans leading-relaxed">{body}</pre>
        </div>
      </div>
    </div>
  );
}
