"use client";

import { useCallback, useEffect, useState } from "react";
import {
  IntegrationsStatus,
  getIntegrationsStatus,
  updateMercadoPagoConfig, verifyMercadoPago, startMercadoPagoOAuth,
  updateSiiConfig, verifySii, SiiConfigUpdate,
  updateWhatsappConfig, verifyWhatsapp,
} from "@/lib/integrations";

interface Props {
  clinicId: string;
}

/**
 * Sección de configuración de integraciones (Mercado Pago + SII/OpenFactura).
 * Se monta en Mi Clínica. Visible para ADMIN/SUPERADMIN únicamente.
 */
export function IntegrationsSection({ clinicId }: Props) {
  const [status, setStatus]   = useState<IntegrationsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  const fetchStatus = useCallback(async () => {
    setLoading(true); setError("");
    try { setStatus(await getIntegrationsStatus(clinicId)); }
    catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally   { setLoading(false); }
  }, [clinicId]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  if (loading) return <div className="text-sm text-gray-400 py-6 text-center">Cargando…</div>;
  if (error)   return <div className="text-sm text-red-500 py-6 text-center">{error}</div>;
  if (!status) return null;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Integraciones externas</h3>
        <p className="text-[11px] text-gray-400">Configurá pagos online y facturación electrónica desde acá.</p>
      </div>

      <WhatsappCard clinicId={clinicId} configured={status.whatsapp.configured} verified={status.whatsapp.verified} onChange={fetchStatus} />
      <MercadoPagoCard clinicId={clinicId} verified={status.mercadopago.verified} oauthAvailable={status.mercadopago.oauthAvailable ?? false} onChange={fetchStatus} />
      <SiiCard clinicId={clinicId} sii={status.sii} onChange={fetchStatus} />
    </div>
  );
}

/* ─── Status pill ──────────────────────────────────────────────────────── */
function StatusPill({ verified }: { verified: boolean }) {
  return verified ? (
    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">✓ Activo</span>
  ) : (
    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">○ Sin configurar</span>
  );
}

/* ─── Mercado Pago ─────────────────────────────────────────────────────── */
function MercadoPagoCard({ clinicId, verified, oauthAvailable, onChange }: { clinicId: string; verified: boolean; oauthAvailable: boolean; onChange: () => void }) {
  const [accessToken, setAccessToken] = useState("");
  const [saving, setSaving]   = useState(false);
  const [verifying, setVerify] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [msg, setMsg]         = useState("");
  const [error, setError]     = useState("");

  async function connect() {
    setConnecting(true); setError("");
    try {
      const url = await startMercadoPagoOAuth(clinicId);
      window.location.href = url; // redirige a Mercado Pago
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); setConnecting(false); }
  }

  async function save() {
    if (accessToken.trim().length < 10) { setError("Access token muy corto"); return; }
    setSaving(true); setError(""); setMsg("");
    try {
      await updateMercadoPagoConfig(clinicId, { accessToken: accessToken.trim() });
      setMsg("Guardado. Ahora verificá la conexión.");
      setAccessToken("");
      onChange();
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally     { setSaving(false); }
  }

  async function verify() {
    setVerify(true); setError(""); setMsg("");
    try {
      const user = await verifyMercadoPago(clinicId);
      setMsg(`✓ Conectado como ${user.nickname ?? user.email ?? user.id}`);
      onChange();
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally     { setVerify(false); }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50">
        <div className="flex items-center gap-2">
          <span className="text-lg">💳</span>
          <h4 className="text-sm font-bold text-gray-800">Mercado Pago — Pagos online</h4>
        </div>
        <StatusPill verified={verified} />
      </div>
      <div className="p-5 flex flex-col gap-3">
        <p className="text-[11px] text-gray-500">
          Permite a tus pacientes pagar por web. Conectá tu cuenta en un paso, sin copiar nada.
        </p>

        {oauthAvailable ? (
          <>
            <button onClick={connect} disabled={connecting}
              className="inline-flex items-center justify-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl bg-[#009EE3] text-white hover:bg-[#008fd0] transition disabled:opacity-50">
              {connecting ? "Redirigiendo…" : (verified ? "Reconectar Mercado Pago" : "Conectar con Mercado Pago")}
            </button>
            <button onClick={() => setShowManual((v) => !v)}
              className="text-[11px] text-gray-400 underline self-start hover:text-gray-600">
              {showManual ? "Ocultar opción manual" : "o conectar manualmente con un token"}
            </button>
          </>
        ) : null}

        {(!oauthAvailable || showManual) && (
          <div className="flex flex-col gap-3 border-t border-gray-50 pt-3">
            {!oauthAvailable && (
              <p className="text-[11px] text-gray-500">
                Pegá el Access Token de{" "}
                <a href="https://www.mercadopago.cl/developers/panel/credentials" target="_blank" rel="noopener noreferrer"
                   className="text-[#1A5C7A] underline hover:text-[#0e4560]">developers.mercadopago.cl</a>.
              </p>
            )}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Access Token</label>
              <input type="password" value={accessToken} onChange={(e) => setAccessToken(e.target.value)}
                placeholder={verified ? "Ya configurado — ingresá uno nuevo para reemplazar" : "APP_USR-... o TEST-..."}
                className="w-full px-3 py-2 text-sm font-mono rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1A5C7A]/30 focus:border-[#1A5C7A]" />
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={save} disabled={saving || !accessToken.trim()}
                className="text-xs font-bold px-3 py-1.5 rounded-xl bg-[#1A5C7A] text-white hover:bg-[#0e4560] transition disabled:opacity-50">
                {saving ? "Guardando…" : "Guardar token"}
              </button>
              <button onClick={verify} disabled={verifying}
                className="text-xs font-bold px-3 py-1.5 rounded-xl border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition disabled:opacity-50">
                {verifying ? "Verificando…" : "Verificar conexión"}
              </button>
            </div>
          </div>
        )}
        {msg   && <p className="text-xs text-emerald-600">{msg}</p>}
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    </div>
  );
}

/* ─── SII / OpenFactura ────────────────────────────────────────────────── */
function SiiCard({
  clinicId, sii, onChange,
}: { clinicId: string; sii: IntegrationsStatus["sii"]; onChange: () => void }) {
  const [apiKey,       setApiKey]      = useState("");
  const [rutEmisor,    setRut]         = useState(sii.rutEmisor ?? "");
  const [razonSocial,  setRazon]       = useState(sii.razonSocial ?? "");
  const [giro,         setGiro]        = useState(sii.giro ?? "");
  const [documentType, setDocType]     = useState<39 | 41>(sii.documentType === 39 ? 39 : 41);
  const [exenta,       setExenta]      = useState(sii.exenta);
  const [saving, setSaving]   = useState(false);
  const [verifying, setVerify] = useState(false);
  const [msg, setMsg]         = useState("");
  const [error, setError]     = useState("");

  async function save() {
    setSaving(true); setError(""); setMsg("");
    try {
      const data: SiiConfigUpdate = {
        rutEmisor:    rutEmisor.trim() || null,
        razonSocial:  razonSocial.trim() || null,
        giro:         giro.trim() || null,
        documentType,
        exenta,
      };
      if (apiKey.trim()) data.apiKey = apiKey.trim();
      await updateSiiConfig(clinicId, data);
      setMsg("Guardado. Ahora verificá la configuración.");
      setApiKey("");
      onChange();
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally     { setSaving(false); }
  }

  async function verify() {
    setVerify(true); setError(""); setMsg("");
    try {
      const result = await verifySii(clinicId);
      setMsg("✓ " + result.message);
      onChange();
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally     { setVerify(false); }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50">
        <div className="flex items-center gap-2">
          <span className="text-lg">🧾</span>
          <h4 className="text-sm font-bold text-gray-800">SII / OpenFactura — Boleta electrónica</h4>
        </div>
        <StatusPill verified={sii.verified} />
      </div>
      <div className="p-5 flex flex-col gap-3">
        <p className="text-[11px] text-gray-500">
          Emisión de boletas vía OpenFactura (Haulmer). Requiere certificación SII previa.{" "}
          <a href="https://www.haulmer.com/" target="_blank" rel="noopener noreferrer"
             className="text-[#1A5C7A] underline hover:text-[#0e4560]">haulmer.com</a>.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">API Key</label>
            <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
              placeholder={sii.verified ? "Ya configurado — ingresá uno nuevo para reemplazar" : "Pegá tu API key"}
              className="w-full px-3 py-2 text-sm font-mono rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1A5C7A]/30 focus:border-[#1A5C7A]" />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">RUT emisor</label>
            <input value={rutEmisor} onChange={(e) => setRut(e.target.value)}
              placeholder="76.123.456-7"
              className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1A5C7A]/30 focus:border-[#1A5C7A]" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Razón social</label>
            <input value={razonSocial} onChange={(e) => setRazon(e.target.value)}
              placeholder="Galana Clínica Dental SpA"
              className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1A5C7A]/30 focus:border-[#1A5C7A]" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Giro económico</label>
            <input value={giro} onChange={(e) => setGiro(e.target.value)}
              placeholder="Servicios odontológicos"
              className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1A5C7A]/30 focus:border-[#1A5C7A]" />
          </div>
        </div>

        <div className="flex items-center gap-4 mt-1">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Tipo documento</label>
            <div className="flex gap-1">
              {([39, 41] as const).map((t) => (
                <button key={t} type="button" onClick={() => { setDocType(t); setExenta(t === 41); }}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition ${
                    documentType === t
                      ? "bg-[#1A5C7A] text-white border-[#1A5C7A]"
                      : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                  }`}>
                  {t === 39 ? "39 · Afecta" : "41 · Exenta"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1">
            <p className="text-[11px] text-gray-400 mt-5">
              {exenta ? "Sin IVA (servicios médicos exentos)" : "Con IVA 19%"}
            </p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap mt-2">
          <button onClick={save} disabled={saving}
            className="text-xs font-bold px-3 py-1.5 rounded-xl bg-[#1A5C7A] text-white hover:bg-[#0e4560] transition disabled:opacity-50">
            {saving ? "Guardando…" : "Guardar configuración"}
          </button>
          <button onClick={verify} disabled={verifying}
            className="text-xs font-bold px-3 py-1.5 rounded-xl border border-violet-200 text-violet-700 bg-violet-50 hover:bg-violet-100 transition disabled:opacity-50">
            {verifying ? "Verificando…" : "Verificar y activar"}
          </button>
        </div>
        {msg   && <p className="text-xs text-emerald-600">{msg}</p>}
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    </div>
  );
}

/* ─── WhatsApp (Meta Cloud API) ────────────────────────────────────────── */
function WhatsappCard({
  clinicId, configured, verified, onChange,
}: { clinicId: string; configured: boolean; verified: boolean; onChange: () => void }) {
  const [phoneId, setPhoneId] = useState("");
  const [token,   setTokenV]  = useState("");
  const [saving, setSaving]   = useState(false);
  const [verifying, setVerify] = useState(false);
  const [msg, setMsg]         = useState("");
  const [error, setError]     = useState("");

  async function save() {
    if (!/^\d{6,}$/.test(phoneId.trim())) { setError("Phone Number ID debe ser numérico"); return; }
    if (token.trim().length < 20)         { setError("El token parece muy corto"); return; }
    setSaving(true); setError(""); setMsg("");
    try {
      await updateWhatsappConfig(clinicId, { phoneId: phoneId.trim(), token: token.trim() });
      setMsg("Guardado. Ahora verificá la conexión.");
      setTokenV("");
      onChange();
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally     { setSaving(false); }
  }

  async function verify() {
    setVerify(true); setError(""); setMsg("");
    try {
      const num = await verifyWhatsapp(clinicId);
      setMsg(`✓ Conectado: ${num.verifiedName ?? ""} ${num.displayPhone ?? ""}`.trim());
      onChange();
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally     { setVerify(false); }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50">
        <div className="flex items-center gap-2">
          <span className="text-lg">💬</span>
          <h4 className="text-sm font-bold text-gray-800">WhatsApp Meta — Mensajería</h4>
        </div>
        <StatusPill verified={verified} />
      </div>
      <div className="p-5 flex flex-col gap-3">
        <p className="text-[11px] text-gray-500">
          Recordatorios, recall y chat por WhatsApp. Obtené el Phone Number ID y el System User Access Token en{" "}
          <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer"
             className="text-[#1A5C7A] underline hover:text-[#0e4560]">developers.facebook.com</a>{" "}
          (WhatsApp → Configuración de la API).
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Phone Number ID</label>
            <input value={phoneId} onChange={(e) => setPhoneId(e.target.value)}
              placeholder={configured ? "Ya configurado — ingresá uno nuevo para reemplazar" : "123456789012345"}
              className="w-full px-3 py-2 text-sm font-mono rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1A5C7A]/30 focus:border-[#1A5C7A]" />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">System User Access Token</label>
            <input type="password" value={token} onChange={(e) => setTokenV(e.target.value)}
              placeholder={verified ? "Ya configurado — ingresá uno nuevo para reemplazar" : "EAAG... (token permanente)"}
              className="w-full px-3 py-2 text-sm font-mono rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1A5C7A]/30 focus:border-[#1A5C7A]" />
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={save} disabled={saving || !phoneId.trim() || !token.trim()}
            className="text-xs font-bold px-3 py-1.5 rounded-xl bg-[#1A5C7A] text-white hover:bg-[#0e4560] transition disabled:opacity-50">
            {saving ? "Guardando…" : "Guardar credenciales"}
          </button>
          <button onClick={verify} disabled={verifying}
            className="text-xs font-bold px-3 py-1.5 rounded-xl border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition disabled:opacity-50">
            {verifying ? "Verificando…" : "Verificar conexión"}
          </button>
        </div>
        {msg   && <p className="text-xs text-emerald-600">{msg}</p>}
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    </div>
  );
}
