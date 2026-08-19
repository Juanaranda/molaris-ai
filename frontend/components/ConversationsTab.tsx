"use client";

import { useEffect, useState } from "react";
import {
  listConversations, getConversation,
  type ConversationSummary, type ConversationDetail,
} from "@/lib/conversations";
import { BetaWhatsappCard } from "@/components/BetaWhatsappCard";

const CH: Record<string, { label: string; bg: string; fg: string }> = {
  web:      { label: "Web",      bg: "#EEF3F8", fg: "#185FA5" },
  whatsapp: { label: "WhatsApp", bg: "#E9F5EC", fg: "#0F6E56" },
};

function channelBadge(channel: string) {
  return CH[channel] ?? { label: channel, bg: "#F1EFE8", fg: "#5F5E5A" };
}

function relTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `hace ${days} d`;
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "short" });
}

export function ConversationsTab() {
  const [list, setList] = useState<ConversationSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    listConversations()
      .then((rows) => setList(rows))
      .catch((e) => setError(e instanceof Error ? e.message : "Error"))
      .finally(() => setLoadingList(false));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga de datos, no estado derivado
    if (!selectedId) { setDetail(null); return; }
    setLoadingDetail(true);
    getConversation(selectedId)
      .then((d) => setDetail(d))
      .catch((e) => setError(e instanceof Error ? e.message : "Error"))
      .finally(() => setLoadingDetail(false));
  }, [selectedId]);

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-xl font-bold" style={{ color: "#0C1B26" }}>Conversaciones</h2>
        <p className="text-sm" style={{ color: "#607281" }}>
          Mira cómo el asistente atiende a tus pacientes en tiempo real.
        </p>
      </div>

      {error && (
        <p className="text-sm rounded-xl px-4 py-2.5 mb-4"
          style={{ color: "#993C1D", backgroundColor: "#FAECE7" }}>{error}</p>
      )}

      {!loadingList && list.length === 0 && (
        <div className="mb-4 max-w-md">
          <BetaWhatsappCard />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">
        {/* Lista */}
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "#E5E0D9", backgroundColor: "white" }}>
          {loadingList ? (
            <p className="text-sm p-5" style={{ color: "#607281" }}>Cargando…</p>
          ) : list.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm font-semibold" style={{ color: "#0C1B26" }}>Aún no hay conversaciones</p>
              <p className="text-xs mt-1" style={{ color: "#607281" }}>
                Cuando un paciente escriba al asistente, aparecerá aquí.
              </p>
            </div>
          ) : (
            <div className="divide-y max-h-[70vh] overflow-y-auto" style={{ borderColor: "#F0EDE8" }}>
              {list.map((c) => {
                const badge = channelBadge(c.channel);
                const active = c.id === selectedId;
                const name = c.context?.patientName || "Paciente sin identificar";
                return (
                  <button key={c.id} onClick={() => setSelectedId(c.id)}
                    className="w-full text-left px-4 py-3 transition hover:bg-black/[0.02]"
                    style={active ? { backgroundColor: "#E8F3F7" } : {}}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sm font-semibold truncate" style={{ color: "#0C1B26" }}>{name}</span>
                      <span className="text-[10px] shrink-0" style={{ color: "#607281" }}>{relTime(c.updatedAt)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: badge.bg, color: badge.fg }}>{badge.label}</span>
                      {c.context?.serviceInterest && (
                        <span className="text-[10px] truncate" style={{ color: "#607281" }}>{c.context.serviceInterest}</span>
                      )}
                      {c.context?.slotBooked && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: "#E1F5EE", color: "#0F6E56" }}>agendó</span>
                      )}
                      {typeof c.leadScore === "number" && c.leadScore > 0 && (
                        <span className="text-[10px]" style={{ color: "#607281" }}>· lead {c.leadScore}</span>
                      )}
                    </div>
                    <p className="text-[11px] mt-1" style={{ color: "#9AA5AD" }}>{c._count.messages} mensajes</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Hilo */}
        <div className="rounded-2xl border overflow-hidden flex flex-col min-h-[400px]"
          style={{ borderColor: "#E5E0D9", backgroundColor: "#FBFAF8" }}>
          {!selectedId ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <p className="text-sm text-center" style={{ color: "#607281" }}>
                Selecciona una conversación para ver el hilo completo.
              </p>
            </div>
          ) : loadingDetail || !detail ? (
            <p className="text-sm p-5" style={{ color: "#607281" }}>Cargando conversación…</p>
          ) : (
            <>
              {/* Cabecera con contexto del paciente */}
              <div className="px-5 py-3 border-b bg-white" style={{ borderColor: "#E5E0D9" }}>
                <p className="text-sm font-bold" style={{ color: "#0C1B26" }}>
                  {detail.context?.patientName || "Paciente sin identificar"}
                </p>
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  {detail.context?.rut && <span className="text-[11px]" style={{ color: "#607281" }}>RUT {detail.context.rut}</span>}
                  {detail.context?.serviceInterest && <span className="text-[11px]" style={{ color: "#607281" }}>· {detail.context.serviceInterest}</span>}
                  {detail.context?.urgency && <span className="text-[11px]" style={{ color: "#993C1D" }}>· {detail.context.urgency}</span>}
                  {detail.context?.slotBooked && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: "#E1F5EE", color: "#0F6E56" }}>agendó cita</span>
                  )}
                </div>
              </div>

              {/* Mensajes */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 max-h-[62vh]">
                {detail.messages.map((m) => {
                  const isAgent = m.role === "assistant";
                  return (
                    <div key={m.id} className={`flex ${isAgent ? "justify-end" : "justify-start"}`}>
                      <div className="max-w-[80%] rounded-2xl px-4 py-2.5"
                        style={isAgent
                          ? { backgroundColor: "#1A5C7A", color: "white", borderBottomRightRadius: 4 }
                          : { backgroundColor: "white", color: "#0C1B26", border: "1px solid #E5E0D9", borderBottomLeftRadius: 4 }}>
                        <p className="text-[10px] font-semibold mb-0.5" style={{ color: isAgent ? "rgba(255,255,255,0.7)" : "#9AA5AD" }}>
                          {isAgent ? "Asistente" : "Paciente"}
                        </p>
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.content}</p>
                        <p className="text-[10px] mt-1 text-right" style={{ color: isAgent ? "rgba(255,255,255,0.6)" : "#B4B2A9" }}>
                          {new Date(m.createdAt).toLocaleString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
