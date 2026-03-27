"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { AvailabilityPicker } from "@/components/AvailabilityPicker";

interface Message {
  role: "user" | "assistant";
  text: string;
  showPicker?: boolean;
}

interface LeadContext {
  patientName?: string;
  serviceInterest?: string;
  urgency?: "high" | "medium" | "low";
  intent?: "ready_to_book" | "evaluating" | "just_browsing";
  score?: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function WidgetChat() {
  const params = useSearchParams();
  const clinicSlug = params.get("clinic") ?? "galana";
  const color = params.get("color") ?? "#0891B2";

  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", text: "Hola 👋 Soy el asistente de Galana Clínica Dental. ¿En qué te puedo ayudar?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [context, setContext] = useState<LeadContext | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSlotSelected(slot: { date: string; dayName: string; time: string; doctor: string; box: string | null }) {
    setMessages((prev) => prev.map((m) => ({ ...m, showPicker: false })));
    const text = `Quiero el ${slot.dayName} ${slot.date.slice(8)} a las ${slot.time} con ${slot.doctor}`;
    setMessages((prev) => [...prev, { role: "user", text }]);

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

    sendToAPI(text);
  }

  const sendToAPI = useCallback(async (text: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, clinicSlug, sessionId: sessionId ?? undefined }),
      });
      const data = await res.json();
      if (!sessionId && data.sessionId) setSessionId(data.sessionId);
      const newCtx: LeadContext = { ...context, ...data.context };
      if (data.context) setContext(newCtx);
      const wantsBooking =
        newCtx.intent === "ready_to_book" ||
        /agend|reserv|hora|cita|disponible|horario/i.test(text);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: data.reply, showPicker: wantsBooking },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Hubo un problema. Escríbenos directamente al WhatsApp." },
      ]);
    } finally {
      setLoading(false);
    }
  }, [clinicSlug, sessionId, context]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;
    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    await sendToAPI(text);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", maxHeight: 600 }}>
      {/* Header */}
      <div style={{ background: color, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,0.25)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, fontWeight: 700, color: "#fff"
        }}>G</div>
        <div>
          <div style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>Galana Clínica Dental</div>
          <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 11 }}>Asistente virtual · En línea</div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 12px 0", display: "flex", flexDirection: "column", gap: 8 }}>
        {messages.map((msg, i) => (
          <div key={i}>
            <div style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: "82%", padding: "8px 12px", borderRadius: 16, fontSize: 13, lineHeight: 1.5,
                background: msg.role === "user" ? color : "#f1f5f9",
                color: msg.role === "user" ? "#fff" : "#1e293b",
                borderBottomRightRadius: msg.role === "user" ? 4 : 16,
                borderBottomLeftRadius: msg.role === "user" ? 16 : 4,
              }}>
                {msg.text}
              </div>
            </div>
            {msg.showPicker && msg.role === "assistant" && (
              <div style={{ marginTop: 6 }}>
                <AvailabilityPicker service={context?.serviceInterest} onSelect={handleSlotSelected} />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex" }}>
            <div style={{ background: "#f1f5f9", padding: "8px 12px", borderRadius: 16, fontSize: 13, color: "#94a3b8" }}>
              Escribiendo...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "10px 12px", borderTop: "1px solid #e2e8f0", display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Escribe tu consulta..."
          style={{
            flex: 1, border: "1px solid #e2e8f0", borderRadius: 20, padding: "8px 14px",
            fontSize: 13, outline: "none", fontFamily: "inherit"
          }}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          style={{
            background: color, color: "#fff", border: "none", borderRadius: 20,
            padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer",
            opacity: loading || !input.trim() ? 0.4 : 1
          }}
        >
          Enviar
        </button>
      </div>
    </div>
  );
}
