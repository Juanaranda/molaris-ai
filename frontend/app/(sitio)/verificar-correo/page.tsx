"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  getMe, sendVerificationCode, verifyEmailCode, sendPhoneCode, verifyPhoneCode,
  type CanalCodigo,
} from "@/lib/auth";
import { Button, Field, Tabs } from "@/components/ui";

const CODE_LEN = 6;
const RESEND_COOLDOWN = 60;

/**
 * Verificar la cuenta al registrarse (MOL-52).
 *
 * Basta con UNO: correo o WhatsApp, a elección. El código del correo ya salió
 * en el registro, por eso esa pestaña parte abierta; la de WhatsApp pide el
 * celular primero. Hasta verificar se puede mirar y configurar, pero no cargar
 * pacientes ni conectar WhatsApp.
 *
 * La ruta sigue siendo /verificar-correo para no romper los enlaces que ya
 * existen (registro y banner del panel).
 */
export default function VerificarCuentaPage() {
  return (
    <Suspense fallback={<Cargando />}>
      <VerificarCuenta />
    </Suspense>
  );
}

function Cargando() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-ground">
      <p className="text-sm text-ink-muted">Cargando…</p>
    </div>
  );
}

type Canal = "correo" | "whatsapp";

function VerificarCuenta() {
  const router = useRouter();
  // A dónde volver al terminar. Quien viene del registro sigue al setup; quien
  // llega desde el banner del panel vuelve a donde estaba, no al onboarding.
  const nextParam = useSearchParams().get("next");
  const destino = nextParam?.startsWith("/") ? nextParam : "/partners/setup";
  const [email, setEmail] = useState("");
  const [telefonoGuardado, setTelefonoGuardado] = useState("");
  const [canal, setCanal] = useState<Canal>("correo");
  const [checking, setChecking] = useState(true);

  // Si ya verificó por cualquiera de los dos, no tiene nada que hacer acá —
  // por ejemplo si vuelve con el botón "atrás".
  useEffect(() => {
    let cancelado = false;
    getMe().then((data) => {
      if (cancelado) return;
      if (!data) { router.replace("/login"); return; }
      if (data.user.emailVerified || data.user.phoneVerified) { router.replace(destino); return; }
      setEmail(data.user.email);
      setTelefonoGuardado(data.user.phone ?? "");
      setChecking(false);
    });
    return () => { cancelado = true; };
  }, [router, destino]);

  if (checking) return <Cargando />;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-ground">
      <Link href="/" className="text-sm font-semibold mb-10 text-brand-strong">molari.ai</Link>

      <div className="w-full max-w-md rounded-card border border-line bg-surface p-6 sm:p-10">
        <h1 className="font-[family-name:var(--font-display,sans-serif)] text-2xl font-bold mb-2 text-brand-strong">
          Verifica tu cuenta
        </h1>
        <p className="text-sm mb-6 text-ink-muted">
          Es para confirmar que eres tú. Con uno basta: elige dónde quieres recibir el código.
        </p>

        <Tabs
          label="Dónde recibir el código"
          value={canal}
          onChange={(id) => setCanal(id as Canal)}
          items={[{ id: "correo", label: "Por correo" }, { id: "whatsapp", label: "Por WhatsApp" }]}
          className="mb-6"
        />

        {canal === "correo"
          ? <PorCorreo email={email} onListo={() => router.push(destino)} />
          : <PorWhatsApp telefonoInicial={telefonoGuardado} onListo={() => router.push(destino)} />}

        <div className="mt-8 pt-6 border-t border-line">
          <button type="button" onClick={() => router.push(destino)} className="text-sm text-ink-muted hover:underline">
            Lo hago después →
          </button>
          <p className="text-xs mt-2 text-ink-muted">
            Puedes entrar y configurar tu clínica, pero para cargar pacientes o
            conectar WhatsApp primero tienes que verificar tu cuenta.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Correo: el código ya salió en el registro ───────────────────────────── */

function PorCorreo({ email, onListo }: { email: string; onListo: () => void }) {
  const [aviso, setAviso] = useState("");
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useCuentaRegresiva(RESEND_COOLDOWN);

  async function reenviar() {
    setError("");
    try {
      await sendVerificationCode();
      setAviso("Te enviamos un código nuevo.");
      setCooldown(RESEND_COOLDOWN);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos enviar el código");
    }
  }

  return (
    <>
      <p className="text-sm mb-6 text-ink-muted">
        Enviamos un código de 6 dígitos a <strong className="text-brand-strong">{email}</strong>.
        Revisa también la carpeta de spam.
      </p>
      <IngresoCodigo
        verificar={verifyEmailCode}
        onListo={onListo}
        onNecesitaNuevo={() => setCooldown(0)}
        error={error}
        aviso={aviso}
      />
      <BotonReenviar cooldown={cooldown} onClick={reenviar} />
    </>
  );
}

/* ── WhatsApp: primero el celular, después el código ─────────────────────── */

const TEXTO_CANAL: Record<CanalCodigo, string> = {
  whatsapp: "por WhatsApp",
  sms: "por SMS",
  // Solo en local, sin WhatsApp ni SMS configurados.
  log: "(modo prueba: el código quedó en el registro del servidor)",
};

function PorWhatsApp({ telefonoInicial, onListo }: { telefonoInicial: string; onListo: () => void }) {
  const [telefono, setTelefono] = useState(telefonoInicial);
  const [enviado, setEnviado] = useState<{ telefono: string; canal: CanalCodigo } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [cooldown, setCooldown] = useCuentaRegresiva(0);

  async function enviar() {
    setError("");
    setAviso("");
    setEnviando(true);
    try {
      const r = await sendPhoneCode(telefono);
      if (r.alreadyVerified) { onListo(); return; }
      if (enviado) setAviso("Te enviamos un código nuevo.");
      setEnviado({ telefono: r.telefono ?? telefono, canal: r.canal ?? "whatsapp" });
      setCooldown(RESEND_COOLDOWN);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos enviar el código");
    } finally {
      setEnviando(false);
    }
  }

  if (!enviado) {
    return (
      <form onSubmit={(e) => { e.preventDefault(); enviar(); }} className="flex flex-col gap-4">
        <Field
          label="Tu celular"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+56 9 1234 5678"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          hint="Te llega por WhatsApp. Si tu número no tiene WhatsApp, por SMS."
          error={error || undefined}
        />
        <Button type="submit" loading={enviando} disabled={!telefono.trim()} block>
          Enviarme el código
        </Button>
      </form>
    );
  }

  return (
    <>
      <p className="text-sm mb-6 text-ink-muted">
        Enviamos un código de 6 dígitos a <strong className="text-brand-strong">{enviado.telefono}</strong>{" "}
        {TEXTO_CANAL[enviado.canal]}.{" "}
        <button type="button" onClick={() => { setEnviado(null); setError(""); setAviso(""); }}
          className="font-semibold text-brand hover:underline">
          Cambiar número
        </button>
      </p>
      <IngresoCodigo
        verificar={verifyPhoneCode}
        onListo={onListo}
        onNecesitaNuevo={() => setCooldown(0)}
        error={error}
        aviso={aviso}
      />
      <BotonReenviar cooldown={cooldown} onClick={enviar} />
    </>
  );
}

/* ── Piezas compartidas ──────────────────────────────────────────────────── */

function useCuentaRegresiva(inicial: number) {
  const [segundos, setSegundos] = useState(inicial);
  useEffect(() => {
    if (segundos <= 0) return;
    const t = setTimeout(() => setSegundos((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [segundos]);
  return [segundos, setSegundos] as const;
}

function BotonReenviar({ cooldown, onClick }: { cooldown: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={cooldown > 0}
      className="text-sm font-semibold text-brand disabled:opacity-40 disabled:cursor-default hover:underline"
    >
      {cooldown > 0 ? `Reenviar código en ${cooldown}s` : "No me llegó — reenviar código"}
    </button>
  );
}

/** Seis casillas que se envían solas al completarse; pegar el código entero funciona. */
function IngresoCodigo({ verificar, onListo, onNecesitaNuevo, error: errorExterno, aviso }: {
  verificar: (codigo: string) => Promise<void>;
  onListo: () => void;
  onNecesitaNuevo: () => void;
  error: string;
  aviso: string;
}) {
  const [digits, setDigits] = useState<string[]>(Array(CODE_LEN).fill(""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const reenfocar = useRef(false);
  const code = digits.join("");

  useEffect(() => { inputs.current[0]?.focus(); }, []);

  // Tras un código malo se vuelve a la primera casilla. Va en un efecto porque
  // mientras se revisa las casillas están deshabilitadas, y una deshabilitada
  // no toma el foco: hay que esperar al render que las habilita.
  useEffect(() => {
    if (loading || !reenfocar.current) return;
    reenfocar.current = false;
    inputs.current[0]?.focus();
  }, [loading]);

  // Un aviso nuevo (se reenvió el código) limpia lo que había escrito.
  useEffect(() => {
    if (!aviso) return;
    setError("");
    setDigits(Array(CODE_LEN).fill(""));
    inputs.current[0]?.focus();
  }, [aviso]);

  function setDigit(i: number, value: string) {
    const limpio = value.replace(/\D/g, "");
    if (!limpio) {
      setDigits((d) => d.map((v, idx) => (idx === i ? "" : v)));
      return;
    }
    if (limpio.length > 1) {
      const chars = limpio.slice(0, CODE_LEN - i).split("");
      setDigits((d) => {
        const next = [...d];
        chars.forEach((c, k) => { next[i + k] = c; });
        return next;
      });
      inputs.current[Math.min(i + chars.length, CODE_LEN - 1)]?.focus();
      return;
    }
    setDigits((d) => d.map((v, idx) => (idx === i ? limpio : v)));
    if (i < CODE_LEN - 1) inputs.current[i + 1]?.focus();
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    // Backspace en una casilla vacía retrocede, que es lo que espera la mano.
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      e.preventDefault();
      inputs.current[i - 1]?.focus();
      setDigits((d) => d.map((v, idx) => (idx === i - 1 ? "" : v)));
    }
    if (e.key === "ArrowLeft" && i > 0) inputs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < CODE_LEN - 1) inputs.current[i + 1]?.focus();
  }

  async function submit(valor: string) {
    if (valor.length !== CODE_LEN || loading) return;
    setLoading(true);
    setError("");
    try {
      await verificar(valor);
      onListo();
    } catch (err) {
      const e = err as Error & { needsNewCode?: boolean };
      setError(e.message);
      setDigits(Array(CODE_LEN).fill(""));
      if (e.needsNewCode) onNecesitaNuevo();
      reenfocar.current = true;
      setLoading(false);
    }
  }

  // Se envía solo al completar los 6 dígitos: nadie quiere apretar un botón
  // extra después de tipear el código.
  useEffect(() => {
    if (code.length === CODE_LEN) submit(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const mensajeError = error || errorExterno;

  return (
    <>
      <div className="flex gap-2 sm:gap-3 justify-between mb-6">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => { inputs.current[i] = el; }}
            value={d}
            onChange={(e) => setDigit(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(i, e)}
            disabled={loading}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            aria-label={`Dígito ${i + 1} de ${CODE_LEN}`}
            className={`w-11 h-14 sm:w-12 sm:h-16 text-center text-2xl font-bold rounded-control border-2 bg-surface text-brand-strong outline-none transition-colors disabled:opacity-50 focus:border-brand ${d ? "border-brand" : "border-line"}`}
          />
        ))}
      </div>

      {mensajeError && (
        <p role="alert" className="text-sm mb-4 rounded-control px-4 py-3 bg-danger-soft text-danger">{mensajeError}</p>
      )}
      {aviso && !mensajeError && (
        <p className="text-sm mb-4 rounded-control px-4 py-3 bg-ok-soft text-ok">{aviso}</p>
      )}
    </>
  );
}
