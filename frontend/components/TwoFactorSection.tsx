"use client";

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { estado2FA, setup2FA, activar2FA, desactivar2FA } from "@/lib/auth";

/**
 * Segundo factor de la cuenta (#68).
 *
 * Es opt-in a propósito: obligarlo frenaría el alta, que es donde más se pierde
 * gente. Vive en "Mi perfil" y no en Configuración porque protege a la persona,
 * no a la clínica — dos admins de la misma clínica lo deciden por separado.
 */

type Paso = "cargando" | "apagado" | "configurando" | "respaldos" | "encendido" | "apagando";

export function TwoFactorSection() {
  const [paso, setPaso] = useState<Paso>("cargando");
  const [restantes, setRestantes] = useState(0);
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [codigo, setCodigo] = useState("");
  const [password, setPassword] = useState("");
  const [respaldos, setRespaldos] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const e = await estado2FA();
      setRestantes(e.codigosRespaldoRestantes);
      setPaso(e.activo ? "encendido" : "apagado");
    } catch {
      setPaso("apagado");
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function empezar() {
    setError(""); setOcupado(true);
    try {
      const { secret, otpauthUrl } = await setup2FA();
      setSecret(secret);
      // El QR se arma en el navegador: la URL otpauth lleva el secreto, y no
      // tiene por qué pasar por un servicio de imágenes de terceros.
      setQr(await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 220 }));
      setCodigo("");
      setPaso("configurando");
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally { setOcupado(false); }
  }

  async function confirmar() {
    setError(""); setOcupado(true);
    try {
      const r = await activar2FA(codigo.trim());
      setRespaldos(r.codigosRespaldo);
      setRestantes(r.codigosRespaldo.length);
      setPaso("respaldos");
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally { setOcupado(false); }
  }

  async function apagar() {
    setError(""); setOcupado(true);
    try {
      await desactivar2FA(password, codigo.trim());
      setPassword(""); setCodigo(""); setRestantes(0);
      setPaso("apagado");
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally { setOcupado(false); }
  }

  const Aviso = () => error ? (
    <p className="text-xs rounded-xl px-3 py-2 mt-3" style={{ backgroundColor: "#FDECEA", color: "#B3261E" }}>{error}</p>
  ) : null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        {paso === "encendido"
          ? <ShieldCheck className="w-5 h-5 mt-0.5 shrink-0" style={{ color: "#1F6B4B" }} aria-hidden />
          : <ShieldAlert className="w-5 h-5 mt-0.5 shrink-0" style={{ color: "#8A9AA6" }} aria-hidden />}
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-gray-900">Verificación en dos pasos</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {paso === "encendido"
              ? "Activa. Al entrar te pedimos un código de tu app además de la contraseña."
              : "Con esto, tu contraseña sola no basta para entrar a las fichas de tus pacientes."}
          </p>
        </div>
      </div>

      {paso === "cargando" && <p className="text-xs text-gray-400 mt-4">Cargando…</p>}

      {paso === "apagado" && (
        <>
          <button onClick={empezar} disabled={ocupado}
            className="mt-4 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: "#0B2F42" }}>
            {ocupado ? "Preparando…" : "Activar"}
          </button>
          <Aviso />
        </>
      )}

      {paso === "configurando" && (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-xs text-gray-600">
            Escanea el código con Google Authenticator, Authy o 1Password.
          </p>
          {qr && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={qr} alt="Código QR para configurar la verificación en dos pasos"
              className="rounded-xl border self-start" style={{ borderColor: "#E5E0D9" }} />
          )}
          <details className="text-xs">
            <summary className="cursor-pointer text-gray-500">¿No puedes escanear?</summary>
            <p className="mt-1.5 text-gray-600">Escribe esta clave a mano en tu app:</p>
            <code className="block mt-1 px-3 py-2 rounded-lg bg-gray-50 border text-[11px] break-all tracking-wider"
              style={{ borderColor: "#E5E0D9" }}>{secret}</code>
          </details>

          <label className="text-xs font-semibold text-gray-600 mt-1">
            Escribe el código que muestra tu app
          </label>
          <input value={codigo} onChange={(e) => setCodigo(e.target.value)}
            placeholder="123456" inputMode="numeric" autoComplete="one-time-code"
            className="w-full max-w-[220px] px-3 py-2.5 rounded-xl border text-base text-center tracking-[0.3em] font-bold focus:outline-none focus:ring-2"
            style={{ borderColor: "#E5E0D9" }} />
          <Aviso />
          <div className="flex gap-2">
            <button onClick={confirmar} disabled={ocupado || codigo.trim().length < 6}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: "#1F6B4B" }}>
              {ocupado ? "Verificando…" : "Confirmar y activar"}
            </button>
            <button onClick={() => { setPaso("apagado"); setError(""); }} disabled={ocupado}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold border" style={{ borderColor: "#E5E0D9", color: "#607281" }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {paso === "respaldos" && (
        <div className="mt-4">
          <p className="text-sm font-bold" style={{ color: "#7A5200" }}>Guarda estos códigos ahora</p>
          <p className="text-xs mt-0.5 mb-3" style={{ color: "#8A6A20" }}>
            Son la única forma de entrar si pierdes el teléfono. No los vas a volver a ver:
            se guardan cifrados y no podemos mostrártelos de nuevo.
          </p>
          <div className="grid grid-cols-2 gap-1.5 max-w-xs">
            {respaldos.map((c) => (
              <code key={c} className="px-2.5 py-1.5 rounded-lg bg-gray-50 border text-xs text-center tracking-wider tabular-nums"
                style={{ borderColor: "#E5E0D9" }}>{c}</code>
            ))}
          </div>
          <button onClick={() => setPaso("encendido")}
            className="mt-4 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ backgroundColor: "#0B2F42" }}>
            Ya los guardé
          </button>
        </div>
      )}

      {paso === "encendido" && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-xs text-gray-500">
            Te quedan {restantes} {restantes === 1 ? "código de respaldo" : "códigos de respaldo"}.
          </span>
          <button onClick={() => { setPaso("apagando"); setError(""); setCodigo(""); setPassword(""); }}
            className="text-xs font-semibold hover:underline" style={{ color: "#B3261E" }}>
            Desactivar
          </button>
        </div>
      )}

      {paso === "apagando" && (
        <div className="mt-4 flex flex-col gap-2.5 max-w-xs">
          <p className="text-xs text-gray-600">
            Para desactivarla pedimos las dos cosas: tu contraseña y un código.
            Así nadie que tome tu sesión prestada puede bajarte la protección.
          </p>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Tu contraseña" autoComplete="current-password"
            className="w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2"
            style={{ borderColor: "#E5E0D9" }} />
          <input value={codigo} onChange={(e) => setCodigo(e.target.value)}
            placeholder="123456" inputMode="numeric" autoComplete="one-time-code"
            className="w-full px-3 py-2.5 rounded-xl border text-sm text-center tracking-[0.3em] font-bold focus:outline-none focus:ring-2"
            style={{ borderColor: "#E5E0D9" }} />
          <Aviso />
          <div className="flex gap-2">
            <button onClick={apagar} disabled={ocupado || !password || codigo.trim().length < 6}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: "#B3261E" }}>
              {ocupado ? "Desactivando…" : "Desactivar"}
            </button>
            <button onClick={() => { setPaso("encendido"); setError(""); }} disabled={ocupado}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold border" style={{ borderColor: "#E5E0D9", color: "#607281" }}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
