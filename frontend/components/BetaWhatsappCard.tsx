"use client";

/**
 * Muestra el número de WhatsApp de prueba (Twilio de beta) para que el usuario
 * le escriba directo al agente. Solo aparece si NEXT_PUBLIC_BETA_WHATSAPP_NUMBER
 * está configurada (en Vercel). El join code (sandbox de Twilio) se pre-escribe
 * en el mensaje del link wa.me para que baste con tocar "enviar".
 */
export function BetaWhatsappCard({ compact = false }: { compact?: boolean }) {
  const number = process.env.NEXT_PUBLIC_BETA_WHATSAPP_NUMBER;
  if (!number) return null;

  const joinCode = process.env.NEXT_PUBLIC_BETA_WHATSAPP_JOINCODE ?? "";
  const digits = number.replace(/\D/g, "");
  const prefill = joinCode || "Hola";
  const link = `https://wa.me/${digits}?text=${encodeURIComponent(prefill)}`;

  return (
    <div className="rounded-2xl border p-5 flex flex-col gap-3"
      style={{ borderColor: "#9FE1CB", backgroundColor: "#E1F5EE" }}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: "white" }}>💬</div>
        <div>
          <p className="text-sm font-bold" style={{ color: "#0F6E56" }}>Prueba el agente por WhatsApp</p>
          <p className="text-xs" style={{ color: "#0F6E56" }}>Escríbele directo a nuestro número de prueba</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl px-4 py-3" style={{ backgroundColor: "white" }}>
        <span className="text-base font-bold tracking-wide" style={{ color: "#0C1B26" }}>{number}</span>
        <a href={link} target="_blank" rel="noopener noreferrer"
          className="text-xs font-bold text-white px-4 py-2 rounded-xl transition hover:opacity-90 shrink-0"
          style={{ backgroundColor: "#0F6E56" }}>
          Abrir en WhatsApp
        </a>
      </div>

      {!compact && (
        <p className="text-[11px] leading-relaxed" style={{ color: "#0F6E56" }}>
          {joinCode
            ? <>La primera vez, envía el mensaje <strong>{joinCode}</strong> (ya viene escrito) para activar la conexión. Después háblale como un paciente y verás cómo responde.</>
            : <>Háblale como si fueras un paciente y verás al asistente responder en tiempo real.</>}
        </p>
      )}
    </div>
  );
}
