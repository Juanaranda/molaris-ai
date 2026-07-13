"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

interface Message {
  role: "user" | "assistant";
  text: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const SLUG = "molaris-demo";

const STARTER_PROMPTS = [
  "¿Cómo funciona el agendamiento automático?",
  "¿Cuánto cuesta?",
  "¿En qué se diferencia de Vambe?",
  "Tenemos una clínica de 3 boxes en Santiago",
];

export function SalesChat() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", text: "¡Hola! Soy Juan, el asistente de molari.ai. ¿Administras o eres dueño de una clínica dental? Cuéntame un poco sobre tu clínica." },
  ]);
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // No auto-scroll en la carga inicial: scrollIntoView movería TODA la página
    // hacia el chat (que está justo antes de #pricing) al recargar. Solo scrollea
    // una vez que el usuario empezó la conversación, y sin arrastrar la página.
    if (!started) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, started]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setStarted(true);
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, clinicSlug: SLUG, sessionId: sessionId ?? undefined }),
      });
      const data = await res.json();
      if (!sessionId && data.sessionId) setSessionId(data.sessionId);
      setMessages((prev) => [...prev, { role: "assistant", text: data.reply ?? "Sin respuesta. Intenta de nuevo." }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", text: "Hubo un problema al conectar. Intenta de nuevo." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 w-full max-w-lg mx-auto">
      {/* Chat window */}
      <div className="rounded-2xl overflow-hidden shadow-xl flex flex-col" style={{ height: 480, border: "1px solid rgba(255,255,255,0.08)" }}>
        {/* Header */}
        <div className="px-5 py-4 flex items-center gap-3" style={{ backgroundColor: "#0B2F42" }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0" style={{ backgroundColor: "#D95F45", color: "white" }}>
            J
          </div>
          <div>
            <p className="font-semibold text-sm text-white">Juan · molari.ai</p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>Asistente comercial · En línea</p>
          </div>
          <span className="ml-auto flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: "#4ade80" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            En línea
          </span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ backgroundColor: "#F7F5F1" }}>
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 mr-2 mt-0.5 self-start" style={{ backgroundColor: "#D95F45", color: "white" }}>
                  J
                </div>
              )}
              <div
                className="max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
                style={
                  msg.role === "user"
                    ? { backgroundColor: "#0B2F42", color: "white", borderBottomRightRadius: 4 }
                    : { backgroundColor: "white", color: "#0C1B26", borderBottomLeftRadius: 4, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }
                }
              >
                {msg.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start items-center gap-2">
              <div className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0" style={{ backgroundColor: "#D95F45", color: "white" }}>J</div>
              <div className="px-4 py-2.5 rounded-2xl text-sm" style={{ backgroundColor: "white", color: "#9ca3af", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                Escribiendo...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 flex gap-2" style={{ backgroundColor: "white", borderTop: "1px solid #E5E0D9" }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)}
            placeholder="Escribe tu consulta..."
            className="flex-1 text-sm rounded-full px-4 py-2 focus:outline-none"
            style={{ border: "1px solid #E5E0D9", backgroundColor: "#F7F5F1" }}
          />
          <button
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
            className="text-sm font-semibold px-4 py-2 rounded-full transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ backgroundColor: "#D95F45", color: "white" }}
          >
            Enviar
          </button>
        </div>
      </div>

      {/* Starter prompts — shown before first user message */}
      {!started && (
        <div className="flex flex-wrap gap-2 justify-center">
          {STARTER_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => send(p)}
              className="text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
              style={{ border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.75)", backgroundColor: "rgba(255,255,255,0.06)" }}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* CTA */}
      <div className="text-center">
        <Link
          href="/register"
          className="inline-block text-sm font-semibold px-6 py-2.5 rounded-full transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#D95F45", color: "white" }}
        >
          Prueba molari.ai gratis →
        </Link>
      </div>
    </div>
  );
}
