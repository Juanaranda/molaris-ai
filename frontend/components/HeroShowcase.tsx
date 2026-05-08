"use client";

import { useEffect, useState } from "react";

/* ─── Mockup 1: Canales activos ─────────────────────────────────────────── */
function ActivityMockup() {
  return (
    <div style={{ background: "#0B2F42", borderRadius: 20, overflow: "hidden",
      boxShadow: "0 24px 64px rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div style={{ background: "#071E2B", padding: "10px 16px", display: "flex", alignItems: "center", gap: 6,
        borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#FF5F57", display: "inline-block" }} />
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#FFBD2E", display: "inline-block" }} />
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#28C840", display: "inline-block" }} />
        <span style={{ marginLeft: 12, fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>
          molari.ai — Actividad en vivo
        </span>
      </div>
      <div style={{ padding: "18px 18px 8px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 }}>
            Hoy · 5 de mayo
          </p>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "#4ade80" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", display: "inline-block" }} />
            En línea
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { canal: "WhatsApp",  msg: "Nueva cita — Dra. Aranda · 10:30",    dot: "#25D366", time: "2 min" },
            { canal: "Instagram", msg: "Lead calificado — ortodoncia",          dot: "#E1306C", time: "5 min" },
            { canal: "Agenda",    msg: "Recordatorio enviado — Pedro R.",       dot: "#8B5CF6", time: "8 min" },
            { canal: "Web",       msg: "Consulta — precio implante dental",     dot: "#1A5C7A", time: "14 min" },
            { canal: "WhatsApp",  msg: "Cita confirmada — Dra. Pérez · 11:00", dot: "#25D366", time: "22 min" },
          ].map((item, idx) => (
            <div key={idx} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
              borderRadius: 12, background: "rgba(255,255,255,0.05)" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: item.dot, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.75)", margin: 0 }}>{item.canal}</p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", margin: 0, overflow: "hidden",
                  textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.msg}</p>
              </div>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", flexShrink: 0 }}>hace {item.time}</p>
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: "12px 18px 14px", borderTop: "1px solid rgba(255,255,255,0.07)",
        display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Citas confirmadas hoy</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: "#D95F45" }}>7 confirmadas</span>
      </div>
    </div>
  );
}

/* ─── Mockup 2: Agenda — fiel a la plataforma (fondo claro) ─────────────── */
function AgendaMockup() {
  const doctors = [
    { name: "Dra. Aranda", bg: "#D1FAE5", border: "#10B981", text: "#065F46", initials: "AA" },
    { name: "Dr. Engel",   bg: "#DBEAFE", border: "#1A5C7A", text: "#0B2F42", initials: "PE" },
    { name: "Dra. Pérez",  bg: "#EDE9FE", border: "#8B5CF6", text: "#5B21B6", initials: "JP" },
  ];
  const slots = ["09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30"];
  const appts: { doctor: number; slot: number; name: string; service: string }[] = [
    { doctor: 0, slot: 0, name: "María G.",  service: "Limpieza" },
    { doctor: 1, slot: 1, name: "Carlos S.", service: "Ortodoncia" },
    { doctor: 2, slot: 2, name: "Ana M.",    service: "Blanqueamiento" },
    { doctor: 0, slot: 3, name: "Pedro R.",  service: "Implante" },
    { doctor: 1, slot: 4, name: "Lucía V.",  service: "Endodoncia" },
    { doctor: 2, slot: 5, name: "Jorge F.",  service: "Consulta" },
    { doctor: 0, slot: 6, name: "Sofía M.",  service: "Radiografía" },
    { doctor: 1, slot: 7, name: "Diego A.",  service: "Control" },
  ];

  return (
    <div style={{ background: "#FDFCFB", borderRadius: 16, border: "1px solid #E5E0D9",
      overflow: "hidden", boxShadow: "0 8px 40px rgba(12,27,38,0.1)" }}>
      {/* Browser chrome */}
      <div style={{ background: "#F0EDE8", padding: "8px 14px", borderBottom: "1px solid #E5E0D9",
        display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#FF5F57", display: "inline-block" }} />
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#FFBD2E", display: "inline-block" }} />
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#28C840", display: "inline-block" }} />
        <span style={{ marginLeft: 8, fontSize: 9, color: "#9ca3af", fontWeight: 600 }}>molari.ai — Agenda</span>
      </div>
      {/* Toolbar: semana/día toggle + fecha */}
      <div style={{ background: "#FDFCFB", padding: "8px 12px", borderBottom: "1px solid #E5E0D9",
        display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: "1px solid #E5E0D9" }}>
          {["Semana", "Día"].map((v, i) => (
            <span key={v} style={{
              fontSize: 9, fontWeight: 700, padding: "3px 10px",
              background: i === 0 ? "#0B2F42" : "#FDFCFB",
              color: i === 0 ? "#fff" : "#9ca3af",
            }}>{v}</span>
          ))}
        </div>
        <span style={{ fontSize: 9, color: "#607281", fontWeight: 600 }}>Lun 5 — Sáb 10 mayo</span>
      </div>
      {/* Doctor header */}
      <div style={{ display: "grid", gridTemplateColumns: "40px repeat(3, 1fr)",
        borderBottom: "1px solid #E5E0D9", padding: "8px 8px 6px", background: "#F7F5F1" }}>
        <div />
        {doctors.map((doc) => (
          <div key={doc.name} style={{ display: "flex", alignItems: "center", gap: 5, padding: "0 4px" }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", background: doc.bg,
              border: `1.5px solid ${doc.border}`, display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 7, fontWeight: 800, color: doc.text, flexShrink: 0 }}>
              {doc.initials}
            </div>
            <span style={{ fontSize: 9, fontWeight: 700, color: "#374151", whiteSpace: "nowrap" }}>
              {doc.name}
            </span>
          </div>
        ))}
      </div>
      {/* Time grid */}
      {slots.map((slot, rowIdx) => (
        <div key={slot} style={{ display: "grid", gridTemplateColumns: "40px repeat(3, 1fr)",
          minHeight: 36, borderBottom: "1px solid #F0EDE8" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "flex-end",
            paddingRight: 8, paddingTop: 4 }}>
            {rowIdx % 2 === 0 && (
              <span style={{ fontSize: 8, fontWeight: 600, color: "#9ca3af" }}>{slot}</span>
            )}
          </div>
          {doctors.map((doc, colIdx) => {
            const appt = appts.find((a) => a.doctor === colIdx && a.slot === rowIdx);
            return (
              <div key={doc.name} style={{ padding: "3px 4px", borderLeft: "1px solid #F0EDE8" }}>
                {appt && (
                  <div style={{ background: doc.bg, borderLeft: `2.5px solid ${doc.border}`,
                    borderRadius: 5, padding: "3px 6px" }}>
                    <p style={{ fontSize: 8, fontWeight: 800, color: doc.text, margin: 0, lineHeight: 1.3 }}>{appt.name}</p>
                    <p style={{ fontSize: 7, color: doc.text, opacity: 0.65, margin: 0 }}>{appt.service}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
      {/* Footer */}
      <div style={{ padding: "8px 12px", borderTop: "1px solid #E5E0D9",
        display: "flex", alignItems: "center", justifyContent: "space-between", background: "#F7F5F1" }}>
        <span style={{ fontSize: 9, color: "#607281" }}>8 citas hoy</span>
        <div style={{ display: "flex", gap: 5 }}>
          <span style={{ fontSize: 8, background: "#D1FAE5", color: "#065F46", fontWeight: 700,
            padding: "2px 7px", borderRadius: 20 }}>6 confirmadas</span>
          <span style={{ fontSize: 8, background: "#FEF3C7", color: "#92400E", fontWeight: 700,
            padding: "2px 7px", borderRadius: 20 }}>2 pendientes</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Mockup 3: Analytics — fiel al nuevo layout (clínica primero) ───────── */
function AnalyticsMockup() {
  const months = [
    { label: "Dic", h: 38 }, { label: "Ene", h: 52 }, { label: "Feb", h: 45 },
    { label: "Mar", h: 68 }, { label: "Abr", h: 72 }, { label: "May", h: 90 },
  ];
  const services = [
    { name: "Ortodoncia",  count: 23, pct: 100, color: "#8B5CF6" },
    { name: "Limpieza",    count: 18, pct: 78,  color: "#8B5CF6" },
    { name: "Implantes",   count: 11, pct: 48,  color: "#8B5CF6" },
    { name: "Endodoncia",  count: 7,  pct: 30,  color: "#8B5CF6" },
  ];

  return (
    <div style={{ background: "#FDFCFB", borderRadius: 16, border: "1px solid #E5E0D9",
      overflow: "hidden", boxShadow: "0 8px 40px rgba(12,27,38,0.1)" }}>
      {/* Browser chrome */}
      <div style={{ background: "#F0EDE8", padding: "8px 14px", borderBottom: "1px solid #E5E0D9",
        display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#FF5F57", display: "inline-block" }} />
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#FFBD2E", display: "inline-block" }} />
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#28C840", display: "inline-block" }} />
        <span style={{ marginLeft: 8, fontSize: 9, color: "#9ca3af", fontWeight: 600 }}>molari.ai — Analítica</span>
        <span style={{ marginLeft: "auto", fontSize: 9, background: "#D1FAE5", color: "#065F46",
          fontWeight: 700, padding: "1px 7px", borderRadius: 20 }}>En vivo</span>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 2, padding: "7px 10px 0", borderBottom: "1px solid #E5E0D9", background: "#FDFCFB" }}>
        {["Resumen", "Doctores", "Pacientes", "Servicios", "Operaciones"].map((t, i) => (
          <span key={t} style={{
            fontSize: 9, fontWeight: i === 0 ? 800 : 600, padding: "4px 8px",
            borderRadius: "8px 8px 0 0", marginBottom: -1,
            color: i === 0 ? "#1A5C7A" : "#9ca3af",
            background: i === 0 ? "#FDFCFB" : "transparent",
            border: i === 0 ? "1px solid #E5E0D9" : "1px solid transparent",
            borderBottom: i === 0 ? "1px solid #FDFCFB" : "1px solid transparent",
          }}>{t}</span>
        ))}
      </div>

      <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
        {/* ── KPIs de clínica ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 5 }}>
          {[
            { label: "Citas este mes", value: "89",    color: "#0C1B26", bg: "#F7F5F1",  border: "#E5E0D9",  sub: "+12 vs mes ant." },
            { label: "Ingresos",       value: "$2.4M", color: "#059669", bg: "#ECFDF5",  border: "#A7F3D0",  sub: "+$320k vs ant." },
            { label: "Ticket prom.",   value: "$27k",  color: "#1A5C7A", bg: "#EFF6FA",  border: "#A9D3E5",  sub: "" },
            { label: "Pacientes",      value: "214",   color: "#7C3AED", bg: "#F5F3FF",  border: "#DDD6FE",  sub: "+8 nuevos" },
          ].map((m) => (
            <div key={m.label} style={{ background: m.bg, border: `1px solid ${m.border}`, borderRadius: 8, padding: "6px 8px" }}>
              <p style={{ fontSize: 7, color: "#9ca3af", margin: "0 0 2px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{m.label}</p>
              <p style={{ fontSize: 15, fontWeight: 900, color: m.color, margin: 0, lineHeight: 1 }}>{m.value}</p>
              {m.sub && <p style={{ fontSize: 7, color: "#10b981", margin: "2px 0 0", fontWeight: 600 }}>{m.sub}</p>}
            </div>
          ))}
        </div>

        {/* ── Ingresos + servicios ── */}
        <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 6 }}>
          {/* Bar chart ingresos */}
          <div style={{ background: "#FDFCFB", border: "1px solid #E5E0D9", borderRadius: 8, padding: "8px 10px" }}>
            <p style={{ fontSize: 7, color: "#9ca3af", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 6px" }}>
              Ingresos 6 meses
            </p>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 44 }}>
              {months.map((m) => (
                <div key={m.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <div style={{ width: "100%", borderRadius: "3px 3px 0 0", background: "#10b981",
                    height: `${m.h * 0.44}px`, minHeight: 2 }} />
                  <span style={{ fontSize: 7, color: "#9ca3af", fontWeight: 600 }}>{m.label}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Top servicios */}
          <div style={{ background: "#FDFCFB", border: "1px solid #E5E0D9", borderRadius: 8, padding: "8px 10px" }}>
            <p style={{ fontSize: 7, color: "#9ca3af", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 6px" }}>
              Top servicios
            </p>
            {services.map((s) => (
              <div key={s.name} style={{ marginBottom: 5 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <span style={{ fontSize: 8, color: "#374151" }}>{s.name}</span>
                  <span style={{ fontSize: 8, color: "#9ca3af", fontWeight: 700 }}>{s.count}</span>
                </div>
                <div style={{ height: 3, background: "#F0EDE8", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${s.pct}%`, background: s.color, borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Asistente IA ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 7, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.1em", whiteSpace: "nowrap" }}>
            Asistente IA · captación
          </span>
          <div style={{ flex: 1, height: 1, background: "#E5E0D9" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 5 }}>
          {[
            { label: "Conversaciones", value: "342", color: "#0C1B26" },
            { label: "Leads captados", value: "127",  color: "#0C1B26" },
            { label: "Score IA",       value: "81/100", color: "#059669" },
            { label: "Conversión",     value: "68%",  color: "#D95F45" },
          ].map((m) => (
            <div key={m.label} style={{ background: "#F7F5F1", border: "1px solid #E5E0D9", borderRadius: 8, padding: "6px 8px" }}>
              <p style={{ fontSize: 7, color: "#9ca3af", margin: "0 0 2px", fontWeight: 600 }}>{m.label}</p>
              <p style={{ fontSize: 12, fontWeight: 900, color: m.color, margin: 0, lineHeight: 1 }}>{m.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Showcase principal ─────────────────────────────────────────────────── */
const TABS = [
  { label: "Canales activos", dot: "#25D366" },
  { label: "Agenda",          dot: "#8B5CF6" },
  { label: "Analytics",       dot: "#D95F45" },
];

export function HeroShowcase() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setActive((a) => (a + 1) % 3), 4500);
    return () => clearInterval(t);
  }, []);

  const screens = [ActivityMockup, AgendaMockup, AnalyticsMockup];

  return (
    <div className="flex flex-col gap-4">
      {/* Tab pills */}
      <div className="flex items-center gap-2">
        {TABS.map((t, i) => (
          <button
            key={t.label}
            onClick={() => { setActive(i); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all"
            style={active === i
              ? { background: "#0B2F42", color: "#fff", border: "1px solid #0B2F42", outline: "none" }
              : { color: "#607281", border: "1px solid #E5E0D9", background: "#FDFCFB", outline: "none" }}
          >
            <span className="w-1.5 h-1.5 rounded-full transition-colors"
              style={{ backgroundColor: active === i ? t.dot : "#c0c8d0" }} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Crossfade area */}
      <div style={{ position: "relative", minHeight: 440 }}>
        {screens.map((Screen, i) => (
          <div key={i} style={{
            position: "absolute", inset: 0,
            opacity: i === active ? 1 : 0,
            transition: "opacity 0.55s ease-in-out",
            pointerEvents: i === active ? "auto" : "none",
          }}>
            <Screen />
          </div>
        ))}
      </div>

      {/* Progress bar dots */}
      <div className="flex items-center gap-2 justify-center">
        {TABS.map((_, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            style={{
              height: 3, borderRadius: 99,
              width: active === i ? 28 : 8,
              background: active === i ? "#D95F45" : "#D9D4CC",
              transition: "all 0.4s ease",
              border: "none", cursor: "pointer", padding: 0,
            }}
          />
        ))}
      </div>
    </div>
  );
}
