"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getMe, sendVerificationCode, verifyEmailCode } from "@/lib/auth";

const CODE_LEN = 6;
const RESEND_COOLDOWN = 60;

export default function VerificarCorreoPage() {
  return (
    <Suspense fallback={<Cargando />}>
      <VerificarCorreo />
    </Suspense>
  );
}

function Cargando() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--surface, #F7F5F1)" }}>
      <p className="text-sm" style={{ color: "var(--muted, #607281)" }}>Cargando…</p>
    </div>
  );
}

function VerificarCorreo() {
  const router = useRouter();
  // A dónde volver al terminar. Quien viene del registro sigue al setup; quien
  // llega desde el banner del panel vuelve a donde estaba, no al onboarding.
  const nextParam = useSearchParams().get("next");
  const destino = nextParam?.startsWith("/") ? nextParam : "/partners/setup";
  const [email, setEmail] = useState("");
  const [digits, setDigits] = useState<string[]>(Array(CODE_LEN).fill(""));
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [sentNotice, setSentNotice] = useState("");
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  // El código ya salió en el registro; acá solo se confirma quién es y si le
  // falta verificar. Si ya está verificado, no tiene nada que hacer en esta
  // pantalla — por ejemplo si vuelve con el botón "atrás".
  useEffect(() => {
    let cancelado = false;
    getMe().then((data) => {
      if (cancelado) return;
      if (!data) { router.replace("/login"); return; }
      if (data.user.emailVerified) { router.replace(destino); return; }
      setEmail(data.user.email);
      setChecking(false);
      inputs.current[0]?.focus();
    });
    return () => { cancelado = true; };
  }, [router, destino]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const code = digits.join("");

  function setDigit(i: number, value: string) {
    const limpio = value.replace(/\D/g, "");
    if (!limpio) {
      setDigits((d) => d.map((v, idx) => (idx === i ? "" : v)));
      return;
    }
    // Pegar el código completo desde el correo debe funcionar en cualquier casilla.
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
    setSentNotice("");
    try {
      await verifyEmailCode(valor);
      router.push(destino);
    } catch (err) {
      const e = err as Error & { needsNewCode?: boolean };
      setError(e.message);
      setDigits(Array(CODE_LEN).fill(""));
      inputs.current[0]?.focus();
      if (e.needsNewCode) setCooldown(0);
      setLoading(false);
    }
  }

  // Se envía solo al completar los 6 dígitos: nadie quiere apretar un botón
  // extra después de tipear el código.
  useEffect(() => {
    if (code.length === CODE_LEN) submit(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function reenviar() {
    if (cooldown > 0) return;
    setError("");
    try {
      await sendVerificationCode();
      setSentNotice("Te enviamos un código nuevo.");
      setCooldown(RESEND_COOLDOWN);
      setDigits(Array(CODE_LEN).fill(""));
      inputs.current[0]?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos enviar el código");
    }
  }

  if (checking) return <Cargando />;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12"
      style={{ backgroundColor: "var(--surface, #F7F5F1)" }}>

      <Link href="/" className="text-sm font-semibold mb-10" style={{ color: "var(--teal-dark, #0B2F42)" }}>
        molari.ai
      </Link>

      <div className="w-full max-w-md rounded-3xl border bg-white p-8 sm:p-10"
        style={{ borderColor: "#E5E0D9" }}>

        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6 text-xl"
          style={{ backgroundColor: "var(--surface, #F7F5F1)" }}>
          ✉️
        </div>

        <h1 className="font-[family-name:var(--font-display,sans-serif)] text-2xl font-bold mb-2"
          style={{ color: "var(--teal-dark, #0B2F42)" }}>
          Confirma tu correo
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--muted, #607281)" }}>
          Enviamos un código de 6 dígitos a <strong style={{ color: "var(--teal-dark, #0B2F42)" }}>{email}</strong>.
          Revisa también la carpeta de spam.
        </p>

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
              className="w-11 h-14 sm:w-12 sm:h-16 text-center text-2xl font-bold rounded-2xl border-2 outline-none transition-colors disabled:opacity-50"
              style={{
                borderColor: d ? "var(--teal, #1A5C7A)" : "#E5E0D9",
                color: "var(--teal-dark, #0B2F42)",
                backgroundColor: "white",
              }}
            />
          ))}
        </div>

        {error && (
          <p className="text-sm mb-4 rounded-xl px-4 py-3" style={{ backgroundColor: "#FDECEA", color: "#B3261E" }}>
            {error}
          </p>
        )}
        {sentNotice && !error && (
          <p className="text-sm mb-4 rounded-xl px-4 py-3" style={{ backgroundColor: "#E8F3EE", color: "#1F6B4B" }}>
            {sentNotice}
          </p>
        )}

        <button
          type="button"
          onClick={reenviar}
          disabled={cooldown > 0}
          className="text-sm font-semibold disabled:opacity-40 disabled:cursor-default hover:underline"
          style={{ color: "var(--teal, #1A5C7A)" }}
        >
          {cooldown > 0 ? `Reenviar código en ${cooldown}s` : "No me llegó — reenviar código"}
        </button>

        <div className="mt-8 pt-6 border-t" style={{ borderColor: "#E5E0D9" }}>
          <button
            type="button"
            onClick={() => router.push(destino)}
            className="text-sm hover:underline"
            style={{ color: "var(--muted, #607281)" }}
          >
            Lo hago después →
          </button>
          <p className="text-xs mt-2" style={{ color: "var(--muted, #607281)" }}>
            Puedes entrar igual, pero necesitamos tu correo confirmado para
            recuperar tu contraseña y avisarte de cosas importantes.
          </p>
        </div>
      </div>
    </div>
  );
}
