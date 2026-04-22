"use client";

import { useState, useRef, useEffect } from "react";
import { AvailabilityPicker } from "./AvailabilityPicker";
import { parsePreferredDate } from "@/lib/dateParser";

function extractMentionedDoctor(text: string, doctors: string[]): string | undefined {
  return doctors.find((d) => text.includes(d));
}

interface Message {
  role: "user" | "assistant";
  text: string;
  showPicker?: boolean;
  preferredDate?: string;
  doctorFilter?: string;
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
  doctors?: string[];
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

const DEFAULT_DOCTORS = [
  "Dra. Ana Aranda",
  "Dra. Ivonne Poblete",
  "Dr. Pedro Engel",
  "Dr. Juan Garcés",
  "Dra. Jacqueline Pérez",
];

export function ChatDemo({ clinicSlug = "galana", clinicName = "Galana Clínica Dental", doctors = DEFAULT_DOCTORS }: Props = {}) {
  const initial = `Hola, soy el asistente virtual de ${clinicName}. ¿En qué puedo ayudarte?`;
  const initial_letter = clinicName.charAt(0).toUpperCase();

  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", text: initial }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [context, setContext] = useState<LeadContext | null>(null);
  const [slotBooked, setSlotBooked] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Reset when clinic changes
  useEffect(() => {
    setMessages([{ role: "assistant", text: `Hola, soy el asistente virtual de ${clinicName}. ¿En qué puedo ayudarte?` }]);
    setSessionId(null);
    setContext(null);
    setSlotBooked(false);
  }, [clinicSlug, clinicName]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSlotSelected(slot: {
    date: string;
    dayName: string;
    time: string;
    doctor: string;
    box: string | null;
  }) {
    setSlotBooked(true);
    setMessages((prev) => prev.map((m) => ({ ...m, showPicker: false })));
    const confirmation = `Seleccioné el ${slot.dayName} ${slot.date.slice(8)} a las ${slot.time} con ${slot.doctor}`;
    setMessages((prev) => [...prev, { role: "user", text: confirmation }]);

    fetch(`${API_URL}/api/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clinicSlug,
        sessionId: sessionId ?? undefined,
        patientName: context?.patientName,
        service: context?.serviceInterest,
        ...slot,
      }),
    }).catch(() => {});

    sendToAPI(confirmation, true);
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;
    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    await sendToAPI(text);
  }

  async function sendToAPI(text: string, slotJustBooked = false) {
    setLoading(true);
    const bookedNow = slotBooked || slotJustBooked;
    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, clinicSlug, sessionId: sessionId ?? undefined, slotBooked: bookedNow }),
      });
      const data = await res.json();

      if (!sessionId && data.sessionId) setSessionId(data.sessionId);

      const newContext: LeadContext = { ...context, ...data.context };
      if (data.context) setContext(newContext);

      const wantsBooking =
        !bookedNow &&
        (newContext.intent === "ready_to_book" ||
          /agend|reserv|hora|cita|disponible|horario/i.test(text));

      const preferredDate = parsePreferredDate(text) ?? undefined;
      const doctorFilter = extractMentionedDoctor(data.reply, doctors) ?? undefined;

      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: data.reply, showPicker: wantsBooking, preferredDate, doctorFilter },
      ]);
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
      <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden flex flex-col h-[520px]">
        {/* Header */}
        <div className="bg-sky-600 px-5 py-4 flex items-center gap-3">
          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-sky-600 font-bold text-sm">
            {initial_letter}
          </div>
          <div>
            <p className="text-white font-semibold text-sm">{clinicName}</p>
            <p className="text-sky-200 text-xs">Asistente virtual · En línea</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.map((msg, i) => (
            <div key={i}>
              <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[82%] px-4 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-sky-600 text-white rounded-br-sm"
                      : "bg-gray-100 text-gray-800 rounded-bl-sm"
                  }`}
                >
                  {msg.text}
                </div>
              </div>

              {msg.showPicker && msg.role === "assistant" && (
                <div className="mt-2 ml-1">
                  <AvailabilityPicker
                    service={context?.serviceInterest}
                    doctorFilter={msg.doctorFilter}
                    preferredDate={msg.preferredDate}
                    onSelect={handleSlotSelected}
                  />
                </div>
              )}
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
            Lead Score · molaris.ai
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
