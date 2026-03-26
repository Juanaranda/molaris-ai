"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  text: string;
}

interface LeadContext {
  patientName?: string;
  serviceInterest?: string;
  urgency?: "high" | "medium" | "low";
  intent?: "ready_to_book" | "evaluating" | "just_browsing";
  score?: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const URGENCY_LABEL: Record<string, string> = {
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

const INTENT_LABEL: Record<string, string> = {
  ready_to_book: "Listo para agendar",
  evaluating: "Evaluando",
  just_browsing: "Solo explorando",
};

const SCORE_COLOR = (score: number) => {
  if (score >= 70) return "text-green-600";
  if (score >= 40) return "text-yellow-500";
  return "text-gray-400";
};

export function ChatDemo() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "Hola, soy el asistente virtual de Galana Clínica Dental. ¿En qué puedo ayudarte?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [context, setContext] = useState<LeadContext | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          clinicSlug: "galana",
          sessionId: sessionId ?? undefined,
        }),
      });
      const data = await res.json();

      // Guardar sessionId del backend en el primer mensaje
      if (!sessionId && data.sessionId) setSessionId(data.sessionId);
      if (data.context) setContext((prev) => ({ ...prev, ...data.context }));

      setMessages((prev) => [...prev, { role: "assistant", text: data.reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Hubo un problema al conectar. Intenta de nuevo." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Chat */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden flex flex-col h-[480px]">
        {/* Header */}
        <div className="bg-blue-600 px-5 py-4 flex items-center gap-3">
          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-blue-600 font-bold text-sm">
            G
          </div>
          <div>
            <p className="text-white font-semibold text-sm">Galana Clínica Dental</p>
            <p className="text-blue-200 text-xs">Asistente virtual · En línea</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-br-sm"
                    : "bg-gray-100 text-gray-800 rounded-bl-sm"
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-400 px-4 py-2 rounded-2xl rounded-bl-sm text-sm">
                Escribiendo...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-100 px-4 py-3 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Escribe tu consulta..."
            className="flex-1 text-sm border border-gray-200 rounded-full px-4 py-2 focus:outline-none focus:border-blue-400"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-full hover:bg-blue-700 disabled:opacity-40 transition-colors"
          >
            Enviar
          </button>
        </div>
      </div>

      {/* Lead Score Panel — solo visible si hay contexto */}
      {context && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Lead Score · molaris.ai
          </p>
          <div className="flex items-center gap-6">
            {/* Score */}
            <div className="text-center">
              <div className={`text-4xl font-black ${SCORE_COLOR(context.score ?? 0)}`}>
                {context.score ?? "—"}
              </div>
              <div className="text-xs text-gray-400 mt-1">Score</div>
            </div>

            <div className="flex-1 grid grid-cols-2 gap-2 text-sm">
              {context.patientName && (
                <div>
                  <span className="text-gray-400 text-xs">Paciente</span>
                  <p className="font-medium text-gray-800">{context.patientName}</p>
                </div>
              )}
              {context.serviceInterest && (
                <div>
                  <span className="text-gray-400 text-xs">Servicio</span>
                  <p className="font-medium text-gray-800">{context.serviceInterest}</p>
                </div>
              )}
              {context.urgency && (
                <div>
                  <span className="text-gray-400 text-xs">Urgencia</span>
                  <p className="font-medium text-gray-800">{URGENCY_LABEL[context.urgency]}</p>
                </div>
              )}
              {context.intent && (
                <div>
                  <span className="text-gray-400 text-xs">Intención</span>
                  <p className="font-medium text-gray-800">{INTENT_LABEL[context.intent]}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
