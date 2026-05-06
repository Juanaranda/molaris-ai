"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  text: string;
}

interface LeadContext {
  patientName?: string;
  rut?: string;
  email?: string;
  serviceInterest?: string;
  urgency?: "high" | "medium" | "low";
  intent?: "ready_to_book" | "evaluating" | "just_browsing";
  score?: number;
  slotBooked?: boolean;
}

interface Props {
  clinicSlug?: string;
  clinicName?: string;
  isDemoMode?: boolean;
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

export function ChatDemo({ clinicSlug = "galana", clinicName = "Galana Clínica Dental", isDemoMode = false }: Props = {}) {
  const [assistantName, setAssistantName] = useState<string | null>(isDemoMode ? "Juan" : null);
  const [displayClinicName, setDisplayClinicName] = useState(isDemoMode ? "molari.ai" : clinicName);

  function buildGreeting(aName: string | null, cName: string) {
    if (isDemoMode) {
      return "Hola, soy Juan de molari.ai. Estoy aquí para mostrarte cómo funciona el sistema para clínicas dentales. ¿Qué te gustaría conocer?";
    }
    return aName
      ? `Hola, soy ${aName}, asistente virtual de ${cName}. ¿En qué puedo ayudarte?`
      : `Hola, soy el asistente virtual de ${cName}. ¿En qué puedo ayudarte?`;
  }

  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", text: buildGreeting(isDemoMode ? "Juan" : null, isDemoMode ? "molari.ai" : clinicName) },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [context, setContext] = useState<LeadContext | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSessionId(null);
    setContext(null);
    if (isDemoMode) {
      setAssistantName("Juan");
      setDisplayClinicName("molari.ai");
      setMessages([{ role: "assistant", text: buildGreeting("Juan", "molari.ai") }]);
      return;
    }
    // Fetch clinic info to get assistantName
    fetch(`${API_URL}/api/book/${clinicSlug}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        const aName: string | null = data?.clinic?.assistantName ?? null;
        const cName: string = data?.clinic?.name ?? clinicName;
        setAssistantName(aName);
        setDisplayClinicName(cName);
        setMessages([{ role: "assistant", text: buildGreeting(aName, cName) }]);
      })
      .catch(() => {
        setMessages([{ role: "assistant", text: buildGreeting(null, clinicName) }]);
      });
  }, [clinicSlug, clinicName, isDemoMode]);

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
        body: JSON.stringify({ message: text, clinicSlug, sessionId: sessionId ?? undefined, isDemoMode: isDemoMode || undefined }),
      });
      const data = await res.json();
      if (!sessionId && data.sessionId) setSessionId(data.sessionId);
      if (data.context) setContext((prev) => ({ ...prev, ...data.context }));
      setMessages((prev) => [...prev, { role: "assistant", text: data.reply ?? "Sin respuesta. Intenta de nuevo." }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", text: "Hubo un problema al conectar. Intenta de nuevo." }]);
    } finally {
      setLoading(false);
    }
  }

  // Render message text: detect booking URLs and make them clickable
  function renderText(text: string | undefined) {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, i) =>
      urlRegex.test(part) ? (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer"
          className="underline underline-offset-2 break-all hover:opacity-80 transition-opacity">
          {part}
        </a>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Chat */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden flex flex-col h-[520px]">
        {/* Header */}
        <div className="px-5 py-4 flex items-center gap-3"
          style={{ backgroundColor: isDemoMode ? "#0B2F42" : "#0284C7" }}>
          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center font-bold text-sm"
            style={{ color: isDemoMode ? "#0B2F42" : "#0284C7" }}>
            {isDemoMode ? "J" : (assistantName ?? displayClinicName).charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-white font-semibold text-sm">
              {isDemoMode ? "Juan" : (assistantName ?? displayClinicName)}
            </p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
              {isDemoMode ? "Agente de molari.ai · En línea" : `${assistantName ? `Asistente de ${displayClinicName}` : "Asistente virtual"} · En línea`}
            </p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[82%] px-4 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-sky-600 text-white rounded-br-sm"
                    : "bg-gray-100 text-gray-800 rounded-bl-sm"
                }`}
              >
                {msg.role === "assistant" ? renderText(msg.text) : msg.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-400 px-4 py-2 rounded-2xl rounded-bl-sm text-sm animate-pulse">
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
            className="flex-1 text-sm border border-gray-200 rounded-full px-4 py-2 focus:outline-none focus:border-sky-400"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="bg-sky-600 text-white text-sm font-medium px-4 py-2 rounded-full hover:bg-sky-700 disabled:opacity-40 transition-colors"
          >
            Enviar
          </button>
        </div>
      </div>

      {/* Lead Score Panel */}
      {context && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Lead Score · molari.ai
          </p>
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="text-center shrink-0">
              <div className={`text-4xl font-black ${SCORE_COLOR(context.score ?? 0)}`}>
                {context.score ?? "—"}
              </div>
              <div className="text-xs text-gray-400 mt-1">Score</div>
            </div>
            <div className="flex-1 grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 gap-2 text-sm">
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
