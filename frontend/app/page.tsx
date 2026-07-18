import Image from "next/image";
import Link from "next/link";
import { SalesChat } from "@/components/SalesChat";
import { HeroShowcase } from "@/components/HeroShowcase";
import { AnimateIn } from "@/components/AnimateIn";
import { AnimatedCounter } from "@/components/AnimatedCounter";

/* ─── Icons ─────────────────────────────────────────────────────────── */
function IconLock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
      <rect x="4" y="10" width="16" height="11" rx="3" />
      <path d="M8 10V7a4 4 0 018 0v3" />
      <circle cx="12" cy="15.5" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IconShieldCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
      <path d="M12 3l7 3v6c0 4.2-2.9 7.7-7 9-4.1-1.3-7-4.8-7-9V6l7-3z" />
      <path d="M9 12.2l2.1 2.1L15.2 10" />
    </svg>
  );
}
function IconExport() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
      <path d="M12 3v11m0 0l-3.5-3.5M12 14l3.5-3.5" />
      <path d="M4 16v2.5A2.5 2.5 0 006.5 21h11a2.5 2.5 0 002.5-2.5V16" />
    </svg>
  );
}
function IconBot() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
      <rect x="3" y="11" width="18" height="11" rx="3" />
      <path d="M8 11V7a4 4 0 018 0v4" />
      <circle cx="9" cy="16.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="16.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
      <rect x="3" y="4" width="18" height="18" rx="3" />
      <path d="M16 2v4M8 2v4M3 10h18" />
      <rect x="7" y="14" width="3" height="3" rx="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IconChart() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
      <path d="M3 3v18h18" />
      <path d="M7 16l4-6 4 3 4-7" />
    </svg>
  );
}
function IconBell() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  );
}
function IconTarget() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}
function IconFile() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="12" y2="17" />
    </svg>
  );
}

/* ─── Agenda Calendar Mockup ────────────────────────────────────────── */
function AgendaMockup() {
  const doctors = [
    { name: "Dra. Aranda", bg: "#D1FAE5", border: "#10B981", text: "#065F46", initials: "AA" },
    { name: "Dr. Engel",   bg: "#DBEAFE", border: "#3B82F6", text: "#1E40AF", initials: "PE" },
    { name: "Dra. Pérez",  bg: "#EDE9FE", border: "#8B5CF6", text: "#5B21B6", initials: "JP" },
  ];
  const slots = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30"];
  const appts: { doctor: number; slot: number; name: string; service: string; status: string }[] = [
    { doctor: 0, slot: 1, name: "María González", service: "Limpieza dental", status: "confirmed" },
    { doctor: 1, slot: 0, name: "Carlos Soto",    service: "Ortodoncia",       status: "confirmed" },
    { doctor: 2, slot: 2, name: "Ana Morales",    service: "Blanqueamiento",   status: "pending"   },
    { doctor: 0, slot: 4, name: "Pedro Rojas",    service: "Implante",         status: "confirmed" },
    { doctor: 1, slot: 3, name: "Lucía Vega",     service: "Endodoncia",       status: "confirmed" },
    { doctor: 2, slot: 5, name: "Jorge Fuentes",  service: "Consulta general", status: "confirmed" },
    { doctor: 0, slot: 6, name: "Sofía Muñoz",    service: "Radiografía",      status: "pending"   },
  ];

  return (
    <div style={{ background: "#0B2F42", borderRadius: 20, overflow: "hidden",
      boxShadow: "0 32px 80px rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div style={{ background: "#071E2B", padding: "10px 16px", display: "flex", alignItems: "center", gap: 6,
        borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#FF5F57", display: "inline-block" }} />
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#FFBD2E", display: "inline-block" }} />
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#28C840", display: "inline-block" }} />
        <span style={{ marginLeft: 12, fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>
          molari.ai — Agenda · Lun 5 de mayo
        </span>
      </div>
      <div style={{ padding: "0 0 4px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "52px repeat(3, 1fr)",
          borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "12px 12px 10px" }}>
          <div />
          {doctors.map((doc) => (
            <div key={doc.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 6px" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: doc.bg,
                border: `2px solid ${doc.border}`, display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: 9, fontWeight: 800, color: doc.text, flexShrink: 0 }}>
                {doc.initials}
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.8)", whiteSpace: "nowrap" }}>
                {doc.name}
              </span>
            </div>
          ))}
        </div>
        {slots.map((slot, rowIdx) => (
          <div key={slot} style={{ display: "grid", gridTemplateColumns: "52px repeat(3, 1fr)",
            minHeight: 44, borderBottom: rowIdx % 2 === 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "flex-end",
              paddingRight: 10, paddingTop: 6 }}>
              {rowIdx % 2 === 0 && (
                <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.3)", fontVariantNumeric: "tabular-nums" }}>
                  {slot}
                </span>
              )}
            </div>
            {doctors.map((doc, colIdx) => {
              const appt = appts.find((a) => a.doctor === colIdx && a.slot === rowIdx);
              return (
                <div key={doc.name} style={{ padding: "4px 6px", borderLeft: "1px solid rgba(255,255,255,0.05)" }}>
                  {appt && (
                    <div style={{ background: doc.bg, border: `1.5px solid ${doc.border}`,
                      borderLeft: `3px solid ${doc.border}`, borderRadius: 7, padding: "4px 8px" }}>
                      <p style={{ fontSize: 10, fontWeight: 800, color: doc.text, margin: 0, lineHeight: 1.3 }}>
                        {appt.name}
                      </p>
                      <p style={{ fontSize: 9, color: doc.text, opacity: 0.7, margin: 0 }}>{appt.service}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div style={{ padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,0.07)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(0,0,0,0.2)" }}>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>7 citas hoy</span>
        <div style={{ display: "flex", gap: 8 }}>
          <span style={{ fontSize: 10, background: "#D1FAE5", color: "#065F46", fontWeight: 700,
            padding: "2px 8px", borderRadius: 20 }}>6 confirmadas</span>
          <span style={{ fontSize: 10, background: "#FEF3C7", color: "#92400E", fontWeight: 700,
            padding: "2px 8px", borderRadius: 20 }}>2 pendientes</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Chat mockup ─────────────────────────────────────────────────── */
function ChatMockup({ header, headerBg, messages, inputBg, sendBg, label, sublabel }: {
  header: { name: string; sub: string; initial: string };
  headerBg: string;
  messages: { from: "user" | "bot"; text: string }[];
  inputBg: string;
  sendBg: string;
  label: string;
  sublabel: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-full max-w-[230px] rounded-[2rem] border-[5px] border-gray-200 shadow-2xl overflow-hidden">
        <div className="px-4 py-3 flex items-center gap-3" style={{ background: headerBg }}>
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-xs shrink-0">
            {header.initial}
          </div>
          <div>
            <p className="text-white font-semibold text-xs">{header.name}</p>
            <p className="text-white/70 text-[10px]">{header.sub}</p>
          </div>
        </div>
        <div className="px-3 py-3 space-y-2 min-h-[200px]" style={{ backgroundColor: inputBg }}>
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[85%] px-3 py-1.5 rounded-2xl text-xs leading-relaxed"
                style={m.from === "user"
                  ? { background: sendBg, color: "#fff", borderRadius: "16px 16px 4px 16px" }
                  : { background: "#fff", color: "#1a1a1a", borderRadius: "16px 16px 16px 4px" }}>
                {m.text}
              </div>
            </div>
          ))}
        </div>
        <div className="bg-white border-t border-gray-100 px-3 py-2 flex gap-2 items-center">
          <div className="flex-1 bg-gray-100 rounded-full px-3 py-1.5 text-[10px] text-gray-400">Escribe tu consulta...</div>
          <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: sendBg }}>
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-white"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </div>
        </div>
      </div>
      <div className="text-center">
        <p className="font-semibold text-sm" style={{ color: "#0C1B26" }}>{label}</p>
        <p className="text-xs" style={{ color: "#607281" }}>{sublabel}</p>
      </div>
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────────────────── */
export default function Home() {
  const problems = [
    { num: "01", title: "Mensajes sin respuesta", desc: "Pacientes que escriben por WhatsApp esperan horas sin respuesta — y se van a la clínica de al lado." },
    { num: "02", title: "Agenda gestionada a mano", desc: "Papeles, llamadas y grupos de WhatsApp para coordinar citas le consumen horas valiosas a tu equipo." },
    { num: "03", title: "Sin historial, sin control", desc: "Fichas dispersas, pagos sin registro y planes de tratamiento que no tienen seguimiento real." },
  ];

  const features = [
    {
      icon: <IconBot />,
      color: "#1A5C7A",
      bg: "#E8F3F7",
      accent: "#1A5C7A",
      title: "IA que atiende sola",
      desc: "El asistente responde, califica y agenda en WhatsApp y tu sitio web — las 24 horas, sin que nadie de tu equipo intervenga.",
      bullets: [
        { icon: <IconBot />, text: "Chatbot con IA en WhatsApp y web" },
        { icon: <IconTarget />, text: "Lead scoring automático por urgencia e intención" },
        { icon: <IconBell />, text: "Recordatorios de citas el día anterior y 2h antes" },
        { icon: <IconUsers />, text: "Cada conversación queda registrada y calificada" },
      ],
    },
    {
      icon: <IconCalendar />,
      color: "#7C3AED",
      bg: "#F3E8FF",
      accent: "#7C3AED",
      title: "Agenda + clínica completa",
      desc: "Vista de calendario semanal por profesional, historial clínico, planes de tratamiento con seguimiento y odontograma — todo en una sola plataforma.",
      bullets: [
        { icon: <IconCalendar />, text: "Agenda por doctor, citas en tiempo real desde el chat" },
        { icon: <IconFile />, text: "Historial y notas clínicas editables por cita" },
        { icon: <IconUsers />, text: "Planes de tratamiento con progreso y pagos parciales" },
        { icon: <IconFile />, text: "Presupuestos con odontograma FDI y 19 prestaciones" },
      ],
    },
    {
      icon: <IconChart />,
      color: "#059669",
      bg: "#D1FAE5",
      accent: "#059669",
      title: "Analytics y finanzas",
      desc: "Dashboard en tiempo real con leads, conversión por canal, ingresos del mes, saldo pendiente y rendimiento de cada profesional.",
      bullets: [
        { icon: <IconChart />, text: "Leads calificados y tasa de conversión por canal" },
        { icon: <IconChart />, text: "Ingresos, cobros pendientes y desglose por doctor" },
        { icon: <IconTarget />, text: "Servicios más consultados y métricas de agenda" },
        { icon: <IconBell />, text: "Vista de hoy filtrada por profesional para cada doctor" },
      ],
    },
  ];

  return (
    <main className="min-h-screen overflow-x-hidden" style={{ backgroundColor: "#F7F5F1", color: "#0C1B26" }}>

      {/* NAV */}
      <nav className="flex items-center justify-between px-6 sm:px-10 py-5 bg-[#FDFCFB] border-b" style={{ borderColor: "#E5E0D9" }}>
        <Image src="/logo.svg" alt="molari.ai" width={148} height={38} priority />
        <div className="flex items-center gap-6">
          <a href="#funciones" className="text-sm font-medium hidden sm:block transition-colors" style={{ color: "#607281" }}>
            Funciones
          </a>
          <a href="#pricing" className="text-sm font-medium hidden sm:block transition-colors" style={{ color: "#607281" }}>
            Precios
          </a>
          <Link href="/login" className="text-sm font-medium transition-colors" style={{ color: "#0C1B26" }}>
            Acceder
          </Link>
          <Link
            href="/register"
            className="text-sm font-semibold px-5 py-2 rounded-full text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#D95F45" }}
          >
            Prueba gratis
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative overflow-hidden" style={{ backgroundColor: "#F7F5F1" }}>
        <div className="relative max-w-6xl mx-auto px-6 sm:px-10 pt-10 sm:pt-14 pb-12 sm:pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div>
              <span className="inline-flex items-center gap-2 text-xs font-bold px-4 py-1.5 rounded-full mb-5 animate-fade-up" style={{ backgroundColor: "#E8F3F7", color: "#1A5C7A", border: "1px solid rgba(26,92,122,0.2)" }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: "#D95F45" }} />
                Software de gestión dental · con recepcionista IA 24/7
              </span>

              <h1 className="font-display text-3xl sm:text-5xl font-bold leading-[1.1] tracking-tight mb-4 text-balance animate-fade-up animate-fade-up-delay-1">
                Tu clínica completa.<br />
                {/* Espacio duro: evita que "duerme." quede huérfano al envolver en móvil. */}
                <span style={{ color: "#D95F45" }}>Y una recepcionista que nunca&nbsp;duerme.</span>
              </h1>

              <p className="text-base max-w-md mb-6 animate-fade-up animate-fade-up-delay-2" style={{ color: "#607281" }}>
                molari.ai es tu clínica completa en un solo lugar: agenda, ficha clínica, odontograma, pagos y analytics. Y además, una recepcionista con IA que responde a tus pacientes en WhatsApp y tu web, agenda citas y hace el seguimiento — 24/7.
              </p>

              {/* Un solo CTA primario por sección; el secundario va discreto (outline). */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 animate-fade-up animate-fade-up-delay-3">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center text-white font-bold px-8 py-4 rounded-2xl text-base transition-all hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]"
                  style={{ backgroundColor: "#D95F45", boxShadow: "0 8px 30px rgba(217,95,69,0.35)" }}
                >
                  Prueba molari.ai gratis
                </Link>
                <a
                  href="https://wa.me/56966865887"
                  className="inline-flex items-center justify-center font-semibold px-6 py-4 rounded-2xl text-base transition-colors hover:bg-[#E8F3F7]"
                  style={{ border: "1.5px solid #1A5C7A", color: "#1A5C7A" }}
                >
                  Hablar por WhatsApp
                </a>
              </div>

              {process.env.NEXT_PUBLIC_LIVE_CLINIC_LABEL && (
                <div className="flex items-center gap-3 mt-6 animate-fade-up animate-fade-up-delay-3">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ backgroundColor: "#E8F3F7", border: "1px solid rgba(26,92,122,0.15)" }}>
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: "#1A5C7A" }} />
                    <p className="text-xs font-semibold" style={{ color: "#1A5C7A" }}>
                      En producción · {process.env.NEXT_PUBLIC_LIVE_CLINIC_LABEL}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="animate-fade-up animate-fade-up-delay-2 animate-float-slow">
              <HeroShowcase />
            </div>
          </div>
        </div>
      </section>

      {/* PILARES DEL PRODUCTO */}
      <section style={{ backgroundColor: "#0B2F42" }}>
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-12 sm:py-14">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8">
            {[
              { icon: "📅", value: "Agenda incluida", label: "Calendario por profesional, sin pagar otra herramienta" },
              { icon: "🦷", value: "Ficha clínica", label: "Notas, planes de tratamiento, odontograma y pagos" },
              { icon: "📊", value: "Analytics en vivo", label: "Ingresos, leads, conversión y rendimiento por doctor" },
              { icon: "🤖", value: "Y además: IA 24/7", label: "Recepcionista que atiende sola en WhatsApp y tu web" },
            ].map((s, i) => (
              <AnimateIn key={s.value} delay={i * 90}>
                <div className="flex flex-col gap-2">
                  <span className="text-2xl">{s.icon}</span>
                  <p className="font-bold text-sm sm:text-base leading-tight" style={{ color: "rgba(255,255,255,0.95)" }}>{s.value}</p>
                  <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>{s.label}</p>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* PROBLEMAS — antes de las funciones para crear contexto */}
      <section className="py-14 sm:py-20" style={{ backgroundColor: "#F7F5F1" }}>
        <div className="max-w-4xl mx-auto px-6 sm:px-10">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-center mb-3" style={{ color: "#D95F45" }}>
            ¿Te suena familiar?
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-center mb-12">
            Los problemas que molari.ai resuelve
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {problems.map((item, i) => (
              <AnimateIn key={item.num} delay={i * 110} style={{ height: '100%' }}>
                <div className="rounded-2xl p-6 sm:p-7 h-full"
                  style={{ backgroundColor: "#FDFCFB", borderTop: "2.5px solid #D95F45", boxShadow: "0 1px 3px rgba(12,27,38,0.05)" }}>
                  <p className="font-display text-5xl font-bold mb-5" style={{ color: "rgba(217,95,69,0.18)" }}>{item.num}</p>
                  <h3 className="font-semibold text-base mb-2">{item.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "#607281" }}>{item.desc}</p>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* FOTOS — clínica moderna, doctor y tecnología (elegidas por Juan; Unsplash License) */}
      <section style={{ backgroundColor: "#F7F5F1" }}>
        <div className="max-w-5xl mx-auto px-6 sm:px-10 pb-14 sm:pb-20">
          <AnimateIn>
            <div className="grid grid-cols-2 sm:grid-cols-3 sm:grid-rows-2 gap-3 sm:gap-4 sm:h-[430px]">
              <div className="relative col-span-2 sm:row-span-2 h-64 sm:h-auto rounded-3xl overflow-hidden">
                <Image
                  src="/photos/dentista-paciente.jpg"
                  alt="Dentista conversando con una paciente en una clínica moderna"
                  fill
                  sizes="(max-width: 640px) 100vw, 60vw"
                  className="object-cover"
                />
                <div className="absolute bottom-4 left-4 flex items-center gap-2 px-4 py-2 rounded-full shadow-sm" style={{ backgroundColor: "rgba(253,252,251,0.94)" }}>
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: "#D95F45" }} />
                  <span className="text-xs font-bold" style={{ color: "#0B2F42" }}>Tu equipo atiende — molari responde</span>
                </div>
              </div>
              <div className="relative h-40 sm:h-auto rounded-3xl overflow-hidden">
                <Image
                  src="/photos/box-moderno.jpg"
                  alt="Box de atención dental moderno"
                  fill
                  sizes="(max-width: 640px) 50vw, 30vw"
                  className="object-cover"
                />
              </div>
              <div className="relative h-40 sm:h-auto rounded-3xl overflow-hidden">
                <Image
                  src="/photos/radiografias.jpg"
                  alt="Dentista examinando radiografías en un panel de luz"
                  fill
                  sizes="(max-width: 640px) 50vw, 30vw"
                  className="object-cover"
                />
              </div>
            </div>
          </AnimateIn>
        </div>
      </section>

      {/* FUNCIONES — 3 grandes tarjetas */}
      <section id="funciones" className="py-16 sm:py-24" style={{ backgroundColor: "#FDFCFB" }}>
        <div className="max-w-5xl mx-auto px-6 sm:px-10">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-center mb-3" style={{ color: "#1A5C7A" }}>
            Una plataforma para todo
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-center mb-4">
            Todo lo que necesita tu clínica
          </h2>
          <p className="text-sm text-center max-w-xl mx-auto mb-14" style={{ color: "#607281" }}>
            No es solo un chatbot. Es IA, agenda, historial clínico y analytics — diseñado específicamente para clínicas dentales chilenas.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <AnimateIn key={f.title} delay={i * 120} style={{ height: '100%' }}>
              <div
                className="rounded-3xl p-7 flex flex-col gap-5 transition-shadow hover:shadow-lg h-full"
                style={{ backgroundColor: "white", border: "1px solid #E5E0D9" }}>
                {/* Icon */}
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ backgroundColor: f.bg, color: f.color }}>
                  {f.icon}
                </div>
                {/* Title + desc */}
                <div>
                  <h3 className="font-bold text-lg mb-2" style={{ color: "#0C1B26" }}>{f.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "#607281" }}>{f.desc}</p>
                </div>
                {/* Bullets */}
                <ul className="flex flex-col gap-2.5 mt-auto">
                  {f.bullets.map((b, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm" style={{ color: "#3D5166" }}>
                      <span className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                        style={{ backgroundColor: f.bg, color: f.color, fontSize: 9 }}>
                        ✓
                      </span>
                      {b.text}
                    </li>
                  ))}
                </ul>
              </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* PLATFORMS */}
      <section className="relative py-16 sm:py-24 overflow-hidden" style={{ backgroundColor: "#F7F5F1" }}>
        {/* Foto fundida con el fondo: doctor revisando el celular (decorativa) */}
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 hidden lg:block"
          style={{
            width: 460,
            height: 340,
            backgroundImage: "url(/photos/doctor-celular.jpg)",
            backgroundSize: "cover",
            backgroundPosition: "center 35%",
            opacity: 0.5,
            WebkitMaskImage: "radial-gradient(75% 75% at 70% 40%, rgba(0,0,0,0.9) 25%, transparent 70%)",
            maskImage: "radial-gradient(75% 75% at 70% 40%, rgba(0,0,0,0.9) 25%, transparent 70%)",
          }}
        />
        <div className="max-w-5xl mx-auto px-6 sm:px-10">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-center mb-3" style={{ color: "#1A5C7A" }}>
            Multiplataforma
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-center mb-4">
            Donde tus pacientes ya están
          </h2>
          <p className="text-sm text-center max-w-xl mx-auto mb-14" style={{ color: "#607281" }}>
            El mismo asistente inteligente responde en todos tus canales — cada conversación queda registrada y calificada.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 justify-items-center">
            <AnimateIn delay={0}>
              <div className="animate-float">
                <ChatMockup
                  header={{ name: "Galana Clínica Dental", sub: "En línea", initial: "G" }}
                  headerBg="#128C7E"
                  messages={[
                    { from: "user", text: "Hola, quiero agendar una limpieza 🦷" },
                    { from: "bot",  text: "¡Hola! ¿Tienes preferencia de día?" },
                    { from: "user", text: "El martes si es posible" },
                    { from: "bot",  text: "Martes 10:00 con Dr. Engel ✅ ¿Confirmo?" },
                  ]}
                  inputBg="#E5DDD5"
                  sendBg="#25D366"
                  label="WhatsApp"
                  sublabel="El canal favorito de tus pacientes"
                />
              </div>
            </AnimateIn>
            <AnimateIn delay={120}>
              <div className="animate-float" style={{ animationDelay: '1.5s' }}>
                <ChatMockup
                  header={{ name: "galana.dental", sub: "Widget web · En línea", initial: "G" }}
                  headerBg="linear-gradient(135deg, #1A5C7A, #0e4560)"
                  messages={[
                    { from: "user", text: "Me interesa una consulta de ortodoncia" },
                    { from: "bot",  text: "La Dra. Pérez atiende lun, mié y vie 😊 ¿Qué día?" },
                    { from: "user", text: "El viernes" },
                    { from: "bot",  text: "¡Perfecto! ¿Me das tu nombre? ✨" },
                  ]}
                  inputBg="#f8fafc"
                  sendBg="#1A5C7A"
                  label="Widget web"
                  sublabel="Captura leads desde tu sitio"
                />
              </div>
            </AnimateIn>
            <AnimateIn delay={240}>
              <div className="animate-float" style={{ animationDelay: '2.8s' }}>
                <ChatMockup
                  header={{ name: "Galana Clínica Dental", sub: "Asistente virtual · 24/7", initial: "G" }}
                  headerBg="#1A5C7A"
                  messages={[
                    { from: "user", text: "¿Cuánto vale una endodoncia?" },
                    { from: "bot",  text: "Varía según la pieza. ¿Te agendo con Dr. Garcés?" },
                    { from: "user", text: "Sí, esta semana si puede ser" },
                    { from: "bot",  text: "Aquí tienes los horarios disponibles 👇" },
                  ]}
                  inputBg="#F7F5F1"
                  sendBg="#1A5C7A"
                  label="Cotizaciones y precios"
                  sublabel="Responde dudas antes de la cita"
                />
              </div>
            </AnimateIn>
          </div>

          {/* Métricas del asistente — se muestran solo cuando hay datos reales.
              Activar con NEXT_PUBLIC_STATS_ENABLED=true y cargar los valores por
              variables a medida que aparezcan resultados. Oculto por defecto para
              no mostrar métricas inventadas en beta. */}
          {process.env.NEXT_PUBLIC_STATS_ENABLED === "true" && (
            <div className="mt-14 rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(26,92,122,0.12)", backgroundColor: "#FDFCFB" }}>
              <div className="px-6 py-3 border-b" style={{ borderColor: "rgba(26,92,122,0.08)", backgroundColor: "#F7F5F1" }}>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-center" style={{ color: "#607281" }}>
                  Asistente IA · resultados en producción
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0" style={{ borderColor: "rgba(26,92,122,0.08)" }}>
                {[
                  { value: process.env.NEXT_PUBLIC_STAT_CONVERSATIONS ?? "—", label: "Conversaciones / mes",   color: "#0C1B26",  sub: process.env.NEXT_PUBLIC_STAT_CONVERSATIONS_SUB ?? "" },
                  { value: process.env.NEXT_PUBLIC_STAT_CONVERSION    ?? "—", label: "Leads convertidos",      color: "#D95F45",  sub: process.env.NEXT_PUBLIC_STAT_CONVERSION_SUB    ?? "" },
                  { value: process.env.NEXT_PUBLIC_STAT_BOOKINGS      ?? "—", label: "Citas generadas por IA", color: "#1A5C7A",  sub: process.env.NEXT_PUBLIC_STAT_BOOKINGS_SUB      ?? "sin intervención humana" },
                  { value: process.env.NEXT_PUBLIC_STAT_RESPONSE      ?? "—", label: "Tiempo de respuesta",    color: "#059669",  sub: process.env.NEXT_PUBLIC_STAT_RESPONSE_SUB      ?? "disponible 24 / 7" },
                ].map((m) => (
                  <div key={m.label} className="flex flex-col items-center justify-center gap-1 py-6 px-4 text-center">
                    <AnimatedCounter raw={m.value} color={m.color} />
                    <p className="text-xs font-semibold mt-1" style={{ color: "#0C1B26" }}>{m.label}</p>
                    {m.sub && <p className="text-[10px]" style={{ color: "#9CA8B3" }}>{m.sub}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </section>

      {/* AGENDA PREVIEW */}
      <section style={{ backgroundColor: "#0B2F42" }} className="py-16 sm:py-24 overflow-hidden">
        <div className="max-w-5xl mx-auto px-6 sm:px-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.15em] mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>
                Agenda incluida
              </p>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mb-5 leading-tight">
                Agenda completa,<br />con IA incluida.
              </h2>
              <p className="text-sm sm:text-base leading-relaxed mb-8" style={{ color: "rgba(255,255,255,0.6)" }}>
                Vista de calendario semanal con columna por profesional, citas confirmadas y pendientes,
                recordatorios automáticos y creación de citas con un clic — sin pagar por otra herramienta.
              </p>
              <ul className="flex flex-col gap-3 mb-8">
                {[
                  "Vista semanal con eje horario (09:00 – 19:00)",
                  "Columna por profesional, código de color por doctor",
                  "Crear, editar y cancelar citas directamente",
                  "Recordatorios automáticos el día anterior y 2h antes",
                  "Las citas del chatbot aparecen aquí al instante",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
                    <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: "rgba(217,95,69,0.2)", color: "#D95F45", fontSize: 10, fontWeight: 800 }}>
                      ✓
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/login"
                className="inline-flex items-center gap-2 font-semibold px-6 py-3 rounded-full text-sm transition-opacity hover:opacity-90"
                style={{ border: "1.5px solid rgba(255,255,255,0.25)", color: "rgba(255,255,255,0.85)" }}>
                Acceder al panel
              </Link>
            </div>
            <AnimateIn direction="right" className="w-full animate-float-slow">
              <AgendaMockup />
            </AnimateIn>
          </div>
        </div>
      </section>

      {/* CÓMO FUNCIONA — fondo claro para romper el patrón oscuro */}
      <section id="como-funciona" className="relative py-16 sm:py-24 overflow-hidden" style={{ backgroundColor: "#FDFCFB" }}>
        {/* Foto fundida con el fondo: doctora trabajando en el laptop (decorativa) */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 hidden lg:block"
          style={{
            width: 440,
            height: 320,
            backgroundImage: "url(/photos/doctora-laptop.jpg)",
            backgroundSize: "cover",
            backgroundPosition: "center 30%",
            opacity: 0.45,
            WebkitMaskImage: "radial-gradient(75% 75% at 30% 40%, rgba(0,0,0,0.9) 25%, transparent 70%)",
            maskImage: "radial-gradient(75% 75% at 30% 40%, rgba(0,0,0,0.9) 25%, transparent 70%)",
          }}
        />
        <div className="max-w-4xl mx-auto px-6 sm:px-10">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-center mb-3" style={{ color: "#1A5C7A" }}>
            Proceso
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-center mb-14" style={{ color: "#0C1B26" }}>
            En marcha en minutos
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-0">
            {[
              { step: "01", title: "Conectamos tus canales", desc: "WhatsApp Business y widget web en una configuración inicial guiada." },
              { step: "02", title: "El asistente atiende 24/7", desc: "Responde, califica y agenda directamente desde la conversación." },
              { step: "03", title: "La agenda se actualiza sola", desc: "Cada cita agendada por IA aparece en tu agenda en tiempo real." },
              { step: "04", title: "Tú ves los resultados", desc: "Dashboard con leads, citas y conversión por canal. Todo en un solo lugar." },
            ].map((item, i) => (
              <AnimateIn key={item.step} delay={i * 100}>
                <div className="relative flex flex-col px-6 sm:px-7 py-8 sm:py-0"
                  style={i > 0 ? { borderLeft: "1px solid #E5E0D9" } : {}}>
                  <p className="font-display text-5xl font-bold mb-5" style={{ color: "#D95F45", opacity: 0.4 }}>{item.step}</p>
                  <h3 className="text-base font-bold mb-2" style={{ color: "#0C1B26" }}>{item.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "#607281" }}>{item.desc}</p>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* JUAN — SALES AGENT — solo en desarrollo local (oculto en beta y prod) */}
      {process.env.NODE_ENV !== "production" && (
      <section id="juan" className="py-16 sm:py-24" style={{ backgroundColor: "#0B2F42" }}>
        <div className="max-w-5xl mx-auto px-6 sm:px-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Copy */}
            <div>
              <span className="inline-flex items-center gap-2 text-xs font-bold px-4 py-1.5 rounded-full mb-6" style={{ backgroundColor: "rgba(217,95,69,0.15)", color: "#D95F45", border: "1px solid rgba(217,95,69,0.3)" }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: "#D95F45" }} />
                Habla con Juan
              </span>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mb-4">
                ¿Tienes dudas?<br />
                <span style={{ color: "#D95F45" }}>Pregúntale a Juan.</span>
              </h2>
              <p className="text-sm sm:text-base mb-6" style={{ color: "rgba(255,255,255,0.6)" }}>
                Juan es el asistente virtual de molari.ai. Conoce todo sobre la plataforma, los planes y cómo puede ayudar a tu clínica. Hazle las preguntas que quieras — sin compromiso.
              </p>
              <ul className="flex flex-col gap-2.5 text-sm mb-8">
                {[
                  "¿Cuánto cuesta y qué incluye cada plan?",
                  "¿En qué se diferencia de Vambe o Clienreach?",
                  "¿Cómo funciona el agendamiento automático?",
                  "¿Se puede integrar con mi WhatsApp actual?",
                ].map((q) => (
                  <li key={q} className="flex items-center gap-2.5" style={{ color: "rgba(255,255,255,0.7)" }}>
                    <span className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold" style={{ backgroundColor: "rgba(217,95,69,0.2)", color: "#D95F45" }}>?</span>
                    {q}
                  </li>
                ))}
              </ul>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Powered by molari.ai · IA especializada en clínicas dentales</p>
            </div>
            {/* Chat */}
            <SalesChat />
          </div>
        </div>
      </section>
      )}

      {/* SEGURIDAD DE DATOS */}
      <section className="py-16 sm:py-24" style={{ backgroundColor: "#FDFCFB" }}>
        <div className="max-w-5xl mx-auto px-6 sm:px-10">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-center mb-3" style={{ color: "#1A5C7A" }}>
            Seguridad y privacidad
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-center mb-14">
            Los datos de tus pacientes, protegidos
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-10">
            {[
              {
                icon: <IconLock />,
                title: "Cifrado de extremo a extremo",
                desc: "Los datos clínicos viajan cifrados y se almacenan cifrados en reposo.",
              },
              {
                icon: <IconShieldCheck />,
                title: "Cumplimiento normativo chileno",
                desc: "Diseñado según la Ley 21.719 de protección de datos personales y la normativa de datos de salud.",
              },
              {
                icon: <IconExport />,
                title: "Tus datos son tuyos",
                desc: "Exporta tu información completa cuando quieras, sin letra chica.",
              },
            ].map((item, i) => (
              <AnimateIn key={item.title} delay={i * 110}>
                <div className="flex flex-col gap-3">
                  <span className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#E8F3F7", color: "#1A5C7A" }}>
                    {item.icon}
                  </span>
                  <h3 className="font-semibold text-base">{item.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "#607281" }}>{item.desc}</p>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-16 sm:py-24" style={{ backgroundColor: "#F7F5F1" }}>
        <div className="max-w-6xl mx-auto px-6 sm:px-10">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-center mb-3">Planes y precios</h2>
          <p className="text-sm text-center mb-12" style={{ color: "#607281" }}>Sin contratos largos. Cancela cuando quieras.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6 items-stretch">

            {/* Doctor — plan para dentista independiente (#69) */}
            <AnimateIn delay={0} style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="flex flex-col rounded-2xl p-6 sm:p-7 flex-1" style={{ border: "1px solid #E5E0D9", backgroundColor: "#FDFCFB" }}>
              <p className="text-xs font-bold uppercase tracking-[0.12em] mb-5" style={{ color: "#607281" }}>Doctor</p>
              <div className="mb-1">
                <span className="font-display text-4xl font-bold">$12.990</span>
                <span className="text-sm ml-1.5" style={{ color: "#607281" }}>CLP / mes</span>
              </div>
              <p className="text-sm mb-6" style={{ color: "#607281" }}>Para el dentista independiente — menos que una consulta particular</p>
              <ul className="flex flex-col gap-2.5 text-sm mb-8 flex-1">
                {["Recepcionista IA en WhatsApp y web", "Agenda personal + recordatorios", "Ficha clínica + odontograma", "Pacientes y pagos", "1 profesional"].map((f) => (
                  <li key={f} className="flex items-center gap-2.5">
                    <span className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold" style={{ backgroundColor: "#E8F3F7", color: "#1A5C7A" }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <a href="/register"
                className="block text-center font-semibold py-3 rounded-full text-sm transition-colors"
                style={{ border: "1.5px solid #1A5C7A", color: "#1A5C7A" }}>
                Empezar ahora
              </a>
            </div>
            </AnimateIn>

            {/* Esencial */}
            <AnimateIn delay={110} style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="flex flex-col rounded-2xl p-6 sm:p-7 flex-1" style={{ border: "1px solid #E5E0D9", backgroundColor: "#FDFCFB" }}>
              <p className="text-xs font-bold uppercase tracking-[0.12em] mb-5" style={{ color: "#607281" }}>Esencial</p>
              <div className="mb-1">
                <span className="font-display text-4xl font-bold">$59.990</span>
                <span className="text-sm ml-1.5" style={{ color: "#607281" }}>CLP / mes</span>
              </div>
              <p className="text-sm mb-6" style={{ color: "#607281" }}>Para la clínica que recién se digitaliza</p>
              <ul className="flex flex-col gap-2.5 text-sm mb-8 flex-1">
                {["Recepcionista IA en tu sitio web", "Agenda por profesional", "Ficha clínica + odontograma", "Recordatorios automáticos de cita", "Hasta 2 profesionales"].map((f) => (
                  <li key={f} className="flex items-center gap-2.5">
                    <span className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold" style={{ backgroundColor: "#E8F3F7", color: "#1A5C7A" }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <a href="https://wa.me/56966865887"
                className="block text-center font-semibold py-3 rounded-full text-sm transition-colors"
                style={{ border: "1.5px solid #1A5C7A", color: "#1A5C7A" }}>
                Empezar ahora
              </a>
            </div>
            </AnimateIn>

            {/* Pro */}
            <AnimateIn delay={220} style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="flex flex-col rounded-2xl p-6 sm:p-7 relative shadow-lg flex-1" style={{ border: "2px solid #D95F45", backgroundColor: "#FDFCFB" }}>
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-white text-[11px] font-bold px-4 py-1 rounded-full whitespace-nowrap" style={{ backgroundColor: "#D95F45" }}>
                Más popular
              </span>
              <p className="text-xs font-bold uppercase tracking-[0.12em] mb-5" style={{ color: "#D95F45" }}>Profesional</p>
              <div className="mb-1">
                <span className="font-display text-4xl font-bold">$99.990</span>
                <span className="text-sm ml-1.5" style={{ color: "#607281" }}>CLP / mes</span>
              </div>
              <p className="text-sm mb-6" style={{ color: "#607281" }}>La clínica completa — hasta 5 profesionales</p>
              <ul className="flex flex-col gap-2.5 text-sm mb-8 flex-1">
                {[
                  "Todo lo del plan Esencial",
                  "Recepcionista IA en WhatsApp Business",
                  "Recall automático + lista de espera",
                  "Pagos online y boleta electrónica SII",
                  "Dashboard de gestión + scoring de pacientes",
                  "Soporte prioritario",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2.5">
                    <span className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold" style={{ backgroundColor: "#FDECEA", color: "#D95F45" }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <a href="https://wa.me/56966865887"
                className="block text-center text-white font-semibold py-3 rounded-full text-sm transition-opacity hover:opacity-90"
                style={{ backgroundColor: "#D95F45" }}>
                Empezar ahora
              </a>
            </div>
            </AnimateIn>

            {/* Clínica+ */}
            <AnimateIn delay={330} style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="flex flex-col rounded-2xl p-6 sm:p-7 flex-1" style={{ border: "1px solid #E5E0D9", backgroundColor: "#FDFCFB" }}>
              <p className="text-xs font-bold uppercase tracking-[0.12em] mb-5" style={{ color: "#607281" }}>Clínica+</p>
              <div className="mb-1">
                <span className="font-display text-4xl font-bold">A medida</span>
              </div>
              <p className="text-sm mb-6" style={{ color: "#607281" }}>Para grupos y multi-sucursal</p>
              <ul className="flex flex-col gap-2.5 text-sm mb-8 flex-1">
                {[
                  "Todo lo del plan Profesional",
                  "Profesionales ilimitados",
                  "Múltiples sucursales",
                  "Integración con tu sistema vía API",
                  "Onboarding dedicado",
                  "SLA garantizado",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2.5">
                    <span className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold" style={{ backgroundColor: "#E8F3F7", color: "#1A5C7A" }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <a href="https://wa.me/56966865887"
                className="block text-center font-semibold py-3 rounded-full text-sm transition-colors"
                style={{ border: "1.5px solid #E5E0D9", color: "#607281" }}>
                Hablar con el equipo
              </a>
            </div>
            </AnimateIn>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-16 sm:py-24 text-center overflow-hidden" style={{ backgroundColor: "#0B2F42" }}>
        <Image
          src="/photos/box-moderno.jpg"
          alt=""
          aria-hidden
          fill
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(11,47,66,0.93) 0%, rgba(11,47,66,0.88) 100%)" }} />
        <div className="pointer-events-none absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-10" style={{ border: "1px solid #D95F45" }} />
        <div className="pointer-events-none absolute -bottom-32 -left-32 w-96 h-96 rounded-full opacity-10" style={{ border: "1px solid white" }} />
        <div className="relative max-w-2xl mx-auto px-6 sm:px-10">
          <h2 className="font-display text-3xl sm:text-5xl font-bold text-white mb-5">
            ¿Tienes una clínica dental?
          </h2>
          <p className="mb-10 text-sm sm:text-base" style={{ color: "rgba(255,255,255,0.6)" }}>
            Regístrate, configura tu clínica y activa todo el sistema — chatbot, agenda, historial y analytics incluidos.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register"
              className="inline-block font-semibold px-8 py-3.5 rounded-full text-sm transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#D95F45", color: "white" }}>
              Regístrate gratis
            </Link>
            <a href="https://wa.me/56966865887"
              className="inline-block font-semibold px-8 py-3.5 rounded-full text-sm transition-colors"
              style={{ border: "1px solid rgba(255,255,255,0.25)", color: "rgba(255,255,255,0.85)" }}>
              Hablar con el equipo
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-6 text-sm" style={{ borderTop: "1px solid #E5E0D9", color: "#607281", backgroundColor: "#FDFCFB" }}>
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>© {new Date().getFullYear()} molari.ai — Santiago, Chile</span>
          <div className="flex items-center gap-4">
            <Link href="/legal/terminos" className="hover:text-gray-900 transition-colors">Términos y condiciones</Link>
            <Link href="/legal/privacidad" className="hover:text-gray-900 transition-colors">Privacidad</Link>
          </div>
        </div>
      </footer>

    </main>
  );
}
