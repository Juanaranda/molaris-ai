import Image from "next/image";
import Link from "next/link";
import { HeroShowcase } from "@/components/HeroShowcase";

/* ─── Icons ─────────────────────────────────────────────────────────── */
function IconBot() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
      <rect x="3" y="11" width="18" height="11" rx="3" />
      <path d="M8 11V7a4 4 0 018 0v4" />
      <circle cx="9" cy="16.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="16.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
      <rect x="3" y="4" width="18" height="18" rx="3" />
      <path d="M16 2v4M8 2v4M3 10h18" />
      <rect x="7" y="14" width="3" height="3" rx="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IconChart() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
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

      {/* Fake OS title bar */}
      <div style={{ background: "#071E2B", padding: "10px 16px", display: "flex", alignItems: "center", gap: 6,
        borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#FF5F57", display: "inline-block" }} />
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#FFBD2E", display: "inline-block" }} />
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#28C840", display: "inline-block" }} />
        <span style={{ marginLeft: 12, fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>
          molari.ai — Agenda · Lun 5 de mayo
        </span>
      </div>

      {/* Calendar grid */}
      <div style={{ padding: "0 0 4px" }}>
        {/* Doctor headers */}
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

        {/* Slots */}
        {slots.map((slot, rowIdx) => (
          <div key={slot} style={{ display: "grid", gridTemplateColumns: "52px repeat(3, 1fr)",
            minHeight: 44, borderBottom: rowIdx % 2 === 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
            {/* Time label */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "flex-end",
              paddingRight: 10, paddingTop: 6 }}>
              {rowIdx % 2 === 0 && (
                <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.3)", fontVariantNumeric: "tabular-nums" }}>
                  {slot}
                </span>
              )}
            </div>
            {/* Doctor cells */}
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

      {/* Bottom bar */}
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

/* ─── Chat mockup (reutilizable) ─────────────────────────────────────── */
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
  const pillars = [
    {
      icon: <IconBot />,
      title: "IA 24/7 en tus canales",
      desc: "Responde consultas, informa precios y horarios en WhatsApp, Instagram y tu web — sin intervención humana.",
      color: "#1A5C7A", bg: "#E8F3F7",
    },
    {
      icon: <IconCalendar />,
      title: "Agenda inteligente",
      desc: "Vista de calendario por profesional, gestión de citas con un clic — sin herramientas adicionales, incluido en tu plan.",
      color: "#7C3AED", bg: "#F3E8FF",
    },
    {
      icon: <IconChart />,
      title: "Dashboard de analytics",
      desc: "Métricas en tiempo real: leads calificados, tasa de conversión, servicios más consultados y mucho más.",
      color: "#0B2F42", bg: "#E8F3F7",
    },
    {
      icon: <IconTarget />,
      title: "Lead scoring",
      desc: "Detecta urgencia e intención de cada paciente para que nunca pierdas un lead de alto valor.",
      color: "#D95F45", bg: "#FEF0ED",
    },
    {
      icon: <IconBell />,
      title: "Recordatorios automáticos",
      desc: "El día anterior y 2 horas antes de cada cita — sin que nadie en tu equipo tenga que hacer nada.",
      color: "#059669", bg: "#D1FAE5",
    },
    {
      icon: <IconUsers />,
      title: "Flujo de agendamiento",
      desc: "Desde la consulta inicial hasta la cita confirmada, sin formularios engorrosos — solo nombre y RUT.",
      color: "#1A5C7A", bg: "#E8F3F7",
    },
  ];

  const problems = [
    { num: "01", title: "Mensajes sin respuesta", desc: "Pacientes que escriben por WhatsApp o Instagram y esperan horas sin obtener respuesta." },
    { num: "02", title: "Agenda gestionada a mano", desc: "Anotar en papeles o coordinar citas por chat consume tiempo valioso de tu equipo." },
    { num: "03", title: "Leads que se enfrían", desc: "Consultas que llegan pero nunca convierten porque nadie hace seguimiento a tiempo." },
  ];

  const stats = [
    { value: "24/7", label: "Disponible siempre" },
    { value: "<2s",  label: "Tiempo de respuesta" },
    { value: "+60%", label: "Más citas confirmadas" },
    { value: "0",    label: "Llamadas de coordinación" },
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
            href="/demo/galana"
            className="text-sm font-semibold px-5 py-2 rounded-full text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#D95F45" }}
          >
            Ver demo
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative overflow-hidden" style={{ backgroundColor: "#F7F5F1" }}>
        <div className="relative max-w-6xl mx-auto px-6 sm:px-10 pt-16 sm:pt-24 pb-12 sm:pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* Left: copy */}
            <div>
              <span className="inline-flex items-center gap-2 text-xs font-bold px-4 py-1.5 rounded-full mb-8 animate-fade-up" style={{ backgroundColor: "#E8F3F7", color: "#1A5C7A", border: "1px solid rgba(26,92,122,0.2)" }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: "#D95F45" }} />
                Sistema completo para clínicas dentales
              </span>

              <h1 className="font-display text-5xl sm:text-6xl font-bold leading-[1.08] tracking-tight mb-6 animate-fade-up animate-fade-up-delay-1">
                IA, agenda y<br />
                <span style={{ color: "#D95F45" }}>analytics — todo<br />en uno.</span>
              </h1>

              <p className="text-base sm:text-lg max-w-md mb-10 animate-fade-up animate-fade-up-delay-2" style={{ color: "#607281" }}>
                molari.ai automatiza la atención en WhatsApp, Instagram y tu web,
                gestiona tu agenda completa y te muestra cada lead en tiempo real.
              </p>

              <div className="flex flex-col gap-3 animate-fade-up animate-fade-up-delay-3">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center text-white font-bold px-10 py-5 rounded-2xl text-lg transition-all hover:opacity-90 hover:scale-[1.02] active:scale-[0.98] w-full sm:w-auto"
                  style={{ backgroundColor: "#D95F45", boxShadow: "0 8px 30px rgba(217,95,69,0.35)" }}
                >
                  Prueba molari.ai gratis
                </Link>
                <div className="flex items-center gap-4">
                  <Link href="/login" className="text-sm font-semibold underline underline-offset-2" style={{ color: "#607281" }}>
                    Iniciar sesión
                  </Link>
                  <span style={{ color: "#c0c8d0" }}>·</span>
                  <a href="https://wa.me/56966865887" className="text-sm font-semibold" style={{ color: "#607281" }}>
                    Hablar con el equipo
                  </a>
                </div>
              </div>

              {/* Trust */}
              <div className="flex items-center gap-3 mt-10 animate-fade-up animate-fade-up-delay-3">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ backgroundColor: "#E8F3F7", border: "1px solid rgba(26,92,122,0.15)" }}>
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: "#1A5C7A" }} />
                  <p className="text-xs font-semibold" style={{ color: "#1A5C7A" }}>
                    En producción · Galana Clínica Dental, Santiago
                  </p>
                </div>
              </div>
            </div>

            {/* Right: rotating showcase */}
            <div className="animate-fade-up animate-fade-up-delay-2">
              <HeroShowcase />
            </div>

          </div>
        </div>
      </section>

      {/* STATS */}
      <section style={{ backgroundColor: "#0B2F42" }}>
        <div className="max-w-4xl mx-auto px-6 sm:px-10 py-12 sm:py-14">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
            {stats.map((s) => (
              <div key={s.label}>
                <p className="font-display text-3xl sm:text-4xl font-bold" style={{ color: "#D95F45" }}>{s.value}</p>
                <p className="text-xs mt-1.5" style={{ color: "rgba(255,255,255,0.55)" }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FUNCIONES (6 pillars) */}
      <section id="funciones" className="py-16 sm:py-24" style={{ backgroundColor: "#F7F5F1" }}>
        <div className="max-w-5xl mx-auto px-6 sm:px-10">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-center mb-3" style={{ color: "#1A5C7A" }}>
            El sistema completo
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-center mb-4">
            Todo lo que necesita tu clínica
          </h2>
          <p className="text-sm text-center max-w-xl mx-auto mb-14" style={{ color: "#607281" }}>
            No es solo un chatbot. Es IA + agenda + analytics en una sola plataforma, diseñada para clínicas dentales chilenas.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {pillars.map((p) => (
              <div key={p.title} className="flex gap-4 p-5 sm:p-6 rounded-2xl transition-shadow hover:shadow-md"
                style={{ backgroundColor: "#FDFCFB", border: "1px solid #E5E0D9" }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: p.bg, color: p.color }}>
                  {p.icon}
                </div>
                <div>
                  <h3 className="font-semibold mb-1 text-sm">{p.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "#607281" }}>{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
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
            <div className="w-full">
              <AgendaMockup />
            </div>
          </div>
        </div>
      </section>

      {/* PLATFORMS */}
      <section className="py-16 sm:py-24" style={{ backgroundColor: "#FDFCFB" }}>
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
            <ChatMockup
              header={{ name: "galana.dental", sub: "DM · En línea", initial: "G" }}
              headerBg="linear-gradient(135deg, #7C3AED, #EC4899)"
              messages={[
                { from: "user", text: "Me interesa una consulta de ortodoncia" },
                { from: "bot",  text: "La Dra. Pérez atiende lun, mié y vie 😊 ¿Qué día?" },
                { from: "user", text: "El viernes" },
                { from: "bot",  text: "¡Perfecto! ¿Me das tu nombre? ✨" },
              ]}
              inputBg="#ffffff"
              sendBg="#E1306C"
              label="Instagram DM"
              sublabel="Captura leads desde tu perfil"
            />
            <ChatMockup
              header={{ name: "Galana Clínica Dental", sub: "Asistente virtual", initial: "G" }}
              headerBg="#1A5C7A"
              messages={[
                { from: "user", text: "¿Cuánto vale una endodoncia?" },
                { from: "bot",  text: "Varía según la pieza. ¿Horarios con Dr. Garcés?" },
                { from: "user", text: "Sí, para esta semana" },
                { from: "bot",  text: "Aquí tienes los horarios disponibles 👇" },
              ]}
              inputBg="#F7F5F1"
              sendBg="#1A5C7A"
              label="Web Widget"
              sublabel="Integrado en tu sitio web"
            />
          </div>
        </div>
      </section>

      {/* PROBLEMAS */}
      <section className="py-14 sm:py-20" style={{ backgroundColor: "#F7F5F1" }}>
        <div className="max-w-4xl mx-auto px-6 sm:px-10">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-center mb-12">¿Te suena familiar?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {problems.map((item) => (
              <div key={item.num} className="rounded-2xl p-6 sm:p-7"
                style={{ backgroundColor: "#FDFCFB", borderTop: "2.5px solid #D95F45", boxShadow: "0 1px 3px rgba(12,27,38,0.05)" }}>
                <p className="font-display text-5xl font-bold mb-5" style={{ color: "rgba(217,95,69,0.18)" }}>{item.num}</p>
                <h3 className="font-semibold text-base mb-2">{item.title}</h3>
                <p className="text-sm" style={{ color: "#607281" }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section id="como-funciona" className="py-16 sm:py-24" style={{ backgroundColor: "#0B2F42" }}>
        <div className="max-w-4xl mx-auto px-6 sm:px-10">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-center mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>
            Proceso
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-center text-white mb-14">En marcha en minutos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-0">
            {[
              { step: "01", title: "Conectamos tus canales", desc: "WhatsApp Business, Instagram y widget web en una configuración inicial guiada." },
              { step: "02", title: "El asistente atiende 24/7", desc: "Responde, califica y agenda directamente desde la conversación." },
              { step: "03", title: "La agenda se actualiza sola", desc: "Cada cita agendada por IA aparece en tu agenda en tiempo real." },
              { step: "04", title: "Tú ves los resultados", desc: "Dashboard con leads, citas y conversión por canal. Todo en un solo lugar." },
            ].map((item, i) => (
              <div key={item.step} className="relative flex flex-col px-6 sm:px-7 py-8 sm:py-0"
                style={i > 0 ? { borderLeft: "1px solid rgba(255,255,255,0.1)" } : {}}>
                <p className="font-display text-5xl font-bold mb-5" style={{ color: "#D95F45", opacity: 0.6 }}>{item.step}</p>
                <h3 className="text-base font-bold text-white mb-2">{item.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-16 sm:py-24" style={{ backgroundColor: "#FDFCFB" }}>
        <div className="max-w-5xl mx-auto px-6 sm:px-10">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-center mb-3">Planes y precios</h2>
          <p className="text-sm text-center mb-12" style={{ color: "#607281" }}>Sin contratos largos. Cancela cuando quieras.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-6 items-stretch">

            {/* Starter */}
            <div className="flex flex-col rounded-2xl p-6 sm:p-7" style={{ border: "1px solid #E5E0D9", backgroundColor: "#FDFCFB" }}>
              <p className="text-xs font-bold uppercase tracking-[0.12em] mb-5" style={{ color: "#607281" }}>Starter</p>
              <div className="mb-1">
                <span className="font-display text-4xl font-bold">$49</span>
                <span className="text-sm ml-1.5" style={{ color: "#607281" }}>USD / mes</span>
              </div>
              <p className="text-sm mb-6" style={{ color: "#607281" }}>Para clínicas pequeñas (1 box)</p>
              <ul className="flex flex-col gap-2.5 text-sm mb-8 flex-1">
                {["Chatbot con IA 24/7", "Agendamiento por chat", "Agenda con vista de calendario", "1 canal de atención"].map((f) => (
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

            {/* Pro */}
            <div className="flex flex-col rounded-2xl p-6 sm:p-7 relative shadow-lg" style={{ border: "2px solid #D95F45", backgroundColor: "#FDFCFB" }}>
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-white text-[11px] font-bold px-4 py-1 rounded-full whitespace-nowrap" style={{ backgroundColor: "#D95F45" }}>
                Más popular
              </span>
              <p className="text-xs font-bold uppercase tracking-[0.12em] mb-5" style={{ color: "#D95F45" }}>Pro</p>
              <div className="mb-1">
                <span className="font-display text-4xl font-bold">$129</span>
                <span className="text-sm ml-1.5" style={{ color: "#607281" }}>USD / mes</span>
              </div>
              <p className="text-sm mb-6" style={{ color: "#607281" }}>Para clínicas medianas (2–5 boxes)</p>
              <ul className="flex flex-col gap-2.5 text-sm mb-8 flex-1">
                {["Todo lo del plan Starter", "Lead scoring de pacientes", "Recordatorios automáticos", "Analytics de conversión en tiempo real", "Múltiples canales de atención"].map((f) => (
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

            {/* Enterprise */}
            <div className="flex flex-col rounded-2xl p-6 sm:p-7" style={{ border: "1px solid #E5E0D9", backgroundColor: "#FDFCFB" }}>
              <p className="text-xs font-bold uppercase tracking-[0.12em] mb-5" style={{ color: "#607281" }}>Enterprise</p>
              <div className="mb-1">
                <span className="font-display text-4xl font-bold">Custom</span>
              </div>
              <p className="text-sm mb-6" style={{ color: "#607281" }}>Para cadenas o grupos dentales</p>
              <ul className="flex flex-col gap-2.5 text-sm mb-8 flex-1">
                {["Todo lo del plan Pro", "Multi-sucursal", "API e integraciones a medida", "Onboarding dedicado", "SLA garantizado"].map((f) => (
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
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-16 sm:py-24 text-center overflow-hidden" style={{ backgroundColor: "#0B2F42" }}>
        <div className="pointer-events-none absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-10" style={{ border: "1px solid #D95F45" }} />
        <div className="pointer-events-none absolute -bottom-32 -left-32 w-96 h-96 rounded-full opacity-10" style={{ border: "1px solid white" }} />
        <div className="relative max-w-2xl mx-auto px-6 sm:px-10">
          <h2 className="font-display text-3xl sm:text-5xl font-bold text-white mb-5">
            ¿Tienes una clínica dental?
          </h2>
          <p className="mb-10 text-sm sm:text-base" style={{ color: "rgba(255,255,255,0.6)" }}>
            Regístrate, configura tu clínica y activa todo el sistema — chatbot, agenda y analytics incluidos.
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
