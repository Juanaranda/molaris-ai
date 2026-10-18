"use client";

import { use, useEffect, useState } from "react";
import { Calendar, CircleCheck, Clock, Stethoscope, User, X } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/**
 * Donde el profesional confirma la hora que pidió un paciente.
 *
 * No exige iniciar sesión a propósito: se abre desde un WhatsApp, con el
 * celular en la mano, probablemente fuera del horario de trabajo. Si hubiera
 * que recordar una contraseña, la hora se queda sin confirmar.
 *
 * Lo que autoriza es el token de la URL: firmado, con vencimiento, y que deja
 * de servir apenas alguien decide.
 */

interface Solicitud {
  paciente: string | null;
  servicio: string | null;
  doctor: string;
  fecha: string;
  hora: string;
  clinica: string;
  venceEl: string | null;
}

const MOTIVOS_TOKEN: Record<string, string> = {
  expirado:    "Este enlace venció. La hora se liberó porque no alcanzó a confirmarse.",
  ya_resuelta: "Esta solicitud ya fue resuelta. No hay nada más que hacer acá.",
  invalido:    "Este enlace no es válido.",
  no_existe:   "Esta solicitud ya no existe.",
};

export default function ConfirmarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [solicitud, setSolicitud] = useState<Solicitud | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<"confirmed" | "cancelled" | null>(null);
  const [motivo, setMotivo] = useState("");
  const [pidiendoMotivo, setPidiendoMotivo] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/confirmar/${token}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(MOTIVOS_TOKEN[d.error] ?? "No pudimos cargar la solicitud.");
        setSolicitud(d);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error"))
      .finally(() => setCargando(false));
  }, [token]);

  async function decidir(accion: "confirmar" | "rechazar") {
    setEnviando(true); setError("");
    try {
      const url = accion === "confirmar"
        ? `${API}/api/confirmar/${token}`
        : `${API}/api/confirmar/${token}/rechazar`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: accion === "rechazar" ? JSON.stringify({ motivo }) : undefined,
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.mensaje ?? MOTIVOS_TOKEN[d.error] ?? "No pudimos registrar tu respuesta.");
      setResultado(d.estado);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally { setEnviando(false); }
  }

  const fechaLegible = solicitud
    ? new Date(`${solicitud.fecha}T12:00:00`).toLocaleDateString("es-CL",
        { weekday: "long", day: "numeric", month: "long" })
    : "";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-10"
      style={{ backgroundColor: "var(--surface, #F7F5F1)" }}>

      <p className="text-sm font-semibold mb-8" style={{ color: "var(--teal-dark, #0B2F42)" }}>molari.ai</p>

      <div className="w-full max-w-md rounded-3xl border bg-white p-6 sm:p-8"
        style={{ borderColor: "#E5E0D9" }}>

        {cargando && <p className="text-sm text-center" style={{ color: "#607281" }}>Cargando…</p>}

        {!cargando && error && !solicitud && (
          <p className="text-sm text-center" style={{ color: "#607281" }}>{error}</p>
        )}

        {/* Resuelta: se dice qué pasó y qué sigue, sin dejar al profesional
            preguntándose si el paciente se enteró. */}
        {resultado && (
          <div className="text-center">
            <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-4"
              style={{ backgroundColor: resultado === "confirmed" ? "#E8F3EE" : "#F7F5F1" }}>
              {resultado === "confirmed"
                ? <CircleCheck className="w-6 h-6" style={{ color: "#1F6B4B" }} aria-hidden />
                : <X className="w-6 h-6" style={{ color: "#607281" }} aria-hidden />}
            </span>
            <h1 className="text-lg font-bold mb-1.5" style={{ color: "var(--teal-dark, #0B2F42)" }}>
              {resultado === "confirmed" ? "Hora confirmada" : "Hora rechazada"}
            </h1>
            <p className="text-sm" style={{ color: "#607281" }}>
              {resultado === "confirmed"
                ? "Le avisamos al paciente y la cita quedó en tu agenda."
                : "Le avisamos al paciente y le ofrecimos otros horarios tuyos."}
            </p>
          </div>
        )}

        {solicitud && !resultado && (
          <>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] mb-1"
              style={{ color: "var(--teal-mid, #1A5C7A)" }}>
              Hora por confirmar
            </p>
            <h1 className="text-xl font-bold mb-5" style={{ color: "var(--teal-dark, #0B2F42)" }}>
              {solicitud.clinica}
            </h1>

            <dl className="flex flex-col gap-3 mb-6">
              {[
                { Icono: User, etiqueta: "Paciente", valor: solicitud.paciente ?? "—" },
                { Icono: Stethoscope, etiqueta: "Motivo", valor: solicitud.servicio ?? "Consulta" },
                { Icono: Calendar, etiqueta: "Día", valor: fechaLegible, capitalizar: true },
                { Icono: Clock, etiqueta: "Hora", valor: `${solicitud.hora} · ${solicitud.doctor}` },
              ].map(({ Icono, etiqueta, valor, capitalizar }) => (
                <div key={etiqueta} className="flex items-start gap-3">
                  <Icono className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#8A9AA6" }} aria-hidden />
                  <div>
                    <dt className="text-[11px] uppercase tracking-wider" style={{ color: "#8A9AA6" }}>{etiqueta}</dt>
                    <dd className={`text-sm font-semibold${capitalizar ? " first-letter:uppercase" : ""}`}
                      style={{ color: "var(--teal-dark, #0B2F42)" }}>{valor}</dd>
                  </div>
                </div>
              ))}
            </dl>

            {error && (
              <p className="text-sm mb-4 rounded-xl px-3.5 py-2.5"
                style={{ backgroundColor: "#FDECEA", color: "#B3261E" }}>{error}</p>
            )}

            {pidiendoMotivo ? (
              <div className="flex flex-col gap-3">
                <label className="text-xs font-semibold" style={{ color: "#607281" }}>
                  ¿Por qué no puedes? Se lo contamos al paciente junto con otros horarios tuyos.
                </label>
                <textarea
                  rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ej: tengo pabellón a esa hora"
                  className="w-full px-3 py-2.5 rounded-xl border text-sm resize-none focus:outline-none focus:ring-2"
                  style={{ borderColor: "#E5E0D9" }}
                />
                <button onClick={() => decidir("rechazar")} disabled={enviando}
                  className="w-full py-3.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                  style={{ backgroundColor: "#B3261E" }}>
                  {enviando ? "Enviando…" : "Rechazar y avisar al paciente"}
                </button>
                <button onClick={() => setPidiendoMotivo(false)} disabled={enviando}
                  className="text-sm" style={{ color: "#607281" }}>Volver</button>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {/* Botones grandes: esto se toca con el pulgar, no con un mouse. */}
                <button onClick={() => decidir("confirmar")} disabled={enviando}
                  className="w-full py-4 rounded-xl text-base font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: "#1F6B4B" }}>
                  {enviando ? "Confirmando…" : "Confirmar esta hora"}
                </button>
                <button onClick={() => setPidiendoMotivo(true)} disabled={enviando}
                  className="w-full py-3.5 rounded-xl text-sm font-semibold border transition-colors"
                  style={{ borderColor: "#E5E0D9", color: "#607281" }}>
                  No puedo a esa hora
                </button>
              </div>
            )}

            {solicitud.venceEl && (
              <p className="text-[11px] text-center mt-4" style={{ color: "#8A9AA6" }}>
                Si nadie responde antes del{" "}
                {new Date(solicitud.venceEl).toLocaleString("es-CL",
                  { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: false })}
                , la hora se libera sola.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
