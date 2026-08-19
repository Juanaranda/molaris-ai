"use client";

import { useState } from "react";
import { changePassword, logout } from "@/lib/auth";
import { Eye, EyeOff } from "lucide-react";

interface Props {
  onSuccess: () => void;
}

/**
 * Modal bloqueante que aparece cuando el usuario tiene `mustChangePassword=true`.
 * No se puede cerrar — la única forma de continuar es cambiar la contraseña
 * o cerrar sesión.
 */
export function ChangePasswordGate({ onSuccess }: Props) {
  const [current,    setCurrent]    = useState("");
  const [next,       setNext]       = useState("");
  const [confirm,    setConfirm]    = useState("");
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState("");

  const matches = next.length > 0 && next === confirm;
  const validLength = next.length >= 8;
  const different = current.length > 0 && next.length > 0 && current !== next;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!matches || !validLength || !different) return;
    setSaving(true); setError("");
    try {
      await changePassword(current, next);
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cambiar contraseña");
    } finally { setSaving(false); }
  }

  function signOut() {
    logout();
    window.location.href = "/partners/login";
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-[#1A5C7A] to-[#0e4560] text-white px-6 py-5">
          <div className="flex items-center gap-3 mb-1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <h2 className="text-base font-black">Cambia tu contraseña</h2>
          </div>
          <p className="text-xs opacity-90">
            Esta es tu primera sesión con la contraseña temporal. Define una nueva para continuar.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={submit} className="p-6 flex flex-col gap-4">
          <PasswordField
            label="Contraseña actual (temporal)"
            value={current}
            onChange={setCurrent}
            autoFocus
          />
          <PasswordField
            label="Nueva contraseña"
            value={next}
            onChange={setNext}
            hint={next.length > 0 && !validLength ? "Mínimo 8 caracteres" : undefined}
            hintError={next.length > 0 && !validLength}
          />
          <PasswordField
            label="Confirma nueva contraseña"
            value={confirm}
            onChange={setConfirm}
            hint={confirm.length > 0 && !matches ? "No coinciden" : (matches && validLength ? "Coinciden" : undefined)}
            hintError={confirm.length > 0 && !matches}
            hintOk={matches && validLength}
          />

          {!different && current.length > 0 && next.length > 0 && (
            <p className="text-xs text-red-500">La nueva contraseña debe ser distinta a la actual</p>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2">{error}</div>
          )}

          <button type="submit" disabled={saving || !matches || !validLength || !different}
            className="w-full py-2.5 rounded-xl bg-[#1A5C7A] text-white text-sm font-bold hover:bg-[#0e4560] transition disabled:opacity-40 disabled:cursor-not-allowed">
            {saving ? "Guardando…" : "Cambiar contraseña"}
          </button>

          <button type="button" onClick={signOut}
            className="text-xs text-gray-400 hover:text-gray-600 transition">
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  );
}

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
  hint?: string;
  hintError?: boolean;
  hintOk?: boolean;
}

function PasswordField({ label, value, onChange, autoFocus, hint, hintError, hintOk }: PasswordFieldProps) {
  const [shown, setShown] = useState(false);
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={shown ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus={autoFocus}
          className="w-full px-3 py-2 pr-10 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1A5C7A]/30 focus:border-[#1A5C7A]"
        />
        <button type="button" onClick={() => setShown((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600">
          {shown ? <EyeOff className="w-4 h-4" aria-hidden /> : <Eye className="w-4 h-4" aria-hidden />}
        </button>
      </div>
      {hint && (
        <p className={`text-[10px] mt-1 ${hintError ? "text-red-500" : hintOk ? "text-emerald-600" : "text-gray-400"}`}>{hint}</p>
      )}
    </div>
  );
}
