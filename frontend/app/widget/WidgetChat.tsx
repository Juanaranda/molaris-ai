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
  const clinicSlug = params.get("clinic") ?? "";
  const clinicName = params.get("name") ?? clinicSlug;
  const color = params.get("color") ?? "#0891B2";
  const agentPhone = params.get("agentPhone") ?? null;

  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", text: "Hola 👋 ¿En qué te puedo ayudar?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [context, setContext] = useState<LeadContext | null>(null);
  const [slotBooked, setSlotBooked] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleDismissPicker() {
    setMessages((prev) => prev.map((m) => ({ ...m, showPicker: false })));
  }

  function handleSlotSelected(slot: { date: string; dayName: string; time: string; doctor: string; box: string | null }) {
    setSlotBooked(true);
    setMessages((prev) => prev.map((m) => ({ ...m, showPicker: false })));
    const text = `Seleccioné el ${slot.dayName} ${slot.date.slice(8)} a las ${slot.time} con ${slot.doctor}`;
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

    sendToAPI(text, true);
  }

  const sendToAPI = useCallback(async (text: string, slotJustBooked = false) => {
    setLoading(true);
    const bookedNow = slotBooked || slotJustBooked;
    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, clinicSlug, sessionId: sessionId ?? undefined, slotBooked: bookedNow }),
      });
      if (!res.ok) throw new Error("non-200");
      const data = await res.json();
      if (!sessionId && data.sessionId) setSessionId(data.sessionId);
      if (data.context) setContext((prev) => ({ ...prev, ...data.context }));
      // Picker solo cuando el backend lo indica explícitamente — evita falsos positivos
      const showPicker = !bookedNow && !!data.showScheduler;
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: data.reply, showPicker },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Hubo un problema. Escríbenos directamente al WhatsApp." },
      ]);
    } finally {
      setLoading(false);
    }
  }, [clinicSlug, sessionId, slotBooked]);

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
        }}>{clinicName ? clinicName[0].toUpperCase() : "?"}</div>
        <div>
          <div style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>{clinicName || "Asistente"}</div>
          <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 11 }}>Asistente virtual · En línea</div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 12px 0", display: "flex", flexDirection: "column", gap: 8 }}>
        {messages.map((msg, i) => {
          // Separar texto del link de agendamiento si viene en el mensaje
          const bookingMatch = msg.role === "assistant"
            ? msg.text.match(/^([\s\S]*?)\s*\n\n👉\s*(https?:\/\/\S+)$/)
            : null;
          const mainText  = bookingMatch ? bookingMatch[1].trim() : msg.text;
          const bookingUrl = bookingMatch ? bookingMatch[2] : null;

          return (
          <div key={i}>
            <div style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: "82%", padding: "8px 12px", borderRadius: 16, fontSize: 13, lineHeight: 1.5,
                background: msg.role === "user" ? color : "#f1f5f9",
                color: msg.role === "user" ? "#fff" : "#1e293b",
                borderBottomRightRadius: msg.role === "user" ? 4 : 16,
                borderBottomLeftRadius: msg.role === "user" ? 16 : 4,
              }}>
                {mainText}
                {bookingUrl && (
                  <a
                    href={bookingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "block", marginTop: 10,
                      background: color, color: "#fff",
                      borderRadius: 20, padding: "7px 14px",
                      fontSize: 12, fontWeight: 700, textDecoration: "none",
                      textAlign: "center",
                    }}
                  >
                    📅 Elegir hora en línea
                  </a>
                )}
              </div>
            </div>
            {msg.showPicker && msg.role === "assistant" && (
              <div style={{ marginTop: 6 }}>
                <AvailabilityPicker
                  service={context?.serviceInterest}
                  color={color}
                  onSelect={handleSlotSelected}
                  onDismiss={handleDismissPicker}
                />
              </div>
            )}
          </div>
          );
        })}
        {loading && (
          <div style={{ display: "flex" }}>
            <div style={{ background: "#f1f5f9", padding: "8px 12px", borderRadius: 16, fontSize: 13, color: "#94a3b8" }}>
              Escribiendo...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* WhatsApp agent CTA */}
      {agentPhone && (
        <div style={{ padding: "6px 12px", borderTop: "1px solid #e2e8f0", background: "#f0fdf4" }}>
          <a
            href={`https://wa.me/${agentPhone.replace(/\D/g, "")}?text=Hola%2C+quiero+consultar+sobre+una+cita`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              padding: "7px 12px", borderRadius: 20, background: "#25D366",
              color: "#fff", fontSize: 12, fontWeight: 700, textDecoration: "none",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.845L.057 23.986l6.305-1.653A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.808 9.808 0 01-5.032-1.386l-.36-.214-3.742.981.998-3.648-.235-.374A9.818 9.818 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/>
            </svg>
            Continuar por WhatsApp
          </a>
        </div>
      )}

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
