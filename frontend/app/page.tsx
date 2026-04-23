import Image from "next/image";
import Link from "next/link";

/* ─── Icons ──────────────────────────────────────────────────────── */
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

function IconTarget() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconLoop() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11V9a4 4 0 014-4h14" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 13v2a4 4 0 01-4 4H3" />
    </svg>
  );
}

/* ─── WhatsApp mockup ──────────────────────────────────────────────── */
function WhatsAppMockup() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-full max-w-[240px] rounded-[2rem] border-[5px] border-gray-200 shadow-2xl overflow-hidden">
        <div className="px-4 py-3 flex items-center gap-3" style={{ backgroundColor: "#128C7E" }}>
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-xs shrink-0">G</div>
          <div>
            <p className="text-white font-semibold text-xs">Galana Clínica Dental</p>
            <p className="text-white/70 text-[10px]">En línea</p>
          </div>
        </div>
        <div className="px-3 py-3 space-y-2 min-h-[200px]" style={{ backgroundColor: "#E5DDD5", backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c8b8a2' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }}>
          <div className="flex justify-start">
            <div className="max-w-[85%] px-3 py-1.5 rounded-2xl rounded-tl-sm text-xs leading-relaxed bg-white text-gray-800 shadow-sm">
              Hola, quiero agendar una limpieza dental 🦷
            </div>
          </div>
          <div className="flex justify-end">
            <div className="max-w-[85%] px-3 py-1.5 rounded-2xl rounded-tr-sm text-xs leading-relaxed shadow-sm" style={{ backgroundColor: "#DCF8C6", color: "#1a1a1a" }}>
              ¡Hola! Con gusto te ayudo. ¿Tienes preferencia de día?
            </div>
          </div>
          <div className="flex justify-start">
            <div className="max-w-[85%] px-3 py-1.5 rounded-2xl rounded-tl-sm text-xs leading-relaxed bg-white text-gray-800 shadow-sm">
              El martes si es posible
            </div>
          </div>
          <div className="flex justify-end">
            <div className="max-w-[85%] px-3 py-1.5 rounded-2xl rounded-tr-sm text-xs leading-relaxed shadow-sm" style={{ backgroundColor: "#DCF8C6", color: "#1a1a1a" }}>
              Tenemos el martes 10:00 con Dr. Engel ✅ ¿Confirmo?
            </div>
          </div>
        </div>
        <div className="bg-white border-t border-gray-100 px-3 py-2 flex gap-2 items-center">
          <div className="flex-1 bg-gray-100 rounded-full px-3 py-1.5 text-[10px] text-gray-400">Escribe un mensaje...</div>
          <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "#25D366" }}>
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-white"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </div>
        </div>
      </div>
      <div className="text-center">
        <p className="font-semibold text-sm" style={{ color: "#0C1B26" }}>WhatsApp</p>
        <p className="text-xs" style={{ color: "#607281" }}>El canal favorito de tus pacientes</p>
      </div>
    </div>
  );
}

/* ─── Instagram mockup ─────────────────────────────────────────────── */
function InstagramMockup() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-full max-w-[240px] rounded-[2rem] border-[5px] border-gray-200 shadow-2xl overflow-hidden">
        <div className="px-4 py-3 flex items-center gap-3 bg-gradient-to-r from-purple-600 to-pink-500">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-xs shrink-0">G</div>
          <div>
            <p className="text-white font-semibold text-xs">galana.dental</p>
            <p className="text-white/70 text-[10px]">DM · En línea</p>
          </div>
        </div>
        <div className="bg-white px-3 py-3 space-y-2 min-h-[200px]">
          <div className="flex justify-start">
            <div className="max-w-[85%] px-3 py-1.5 rounded-2xl rounded-tl-sm text-xs leading-relaxed bg-gray-100 text-gray-800">
              Me interesa una consulta de ortodoncia
            </div>
          </div>
          <div className="flex justify-end">
            <div className="max-w-[85%] px-3 py-1.5 rounded-2xl rounded-tr-sm text-xs leading-relaxed text-white bg-gradient-to-r from-purple-500 to-pink-500">
              La Dra. Pérez atiende lun, mié y vie 😊 ¿Qué día te acomoda?
            </div>
          </div>
          <div className="flex justify-start">
            <div className="max-w-[85%] px-3 py-1.5 rounded-2xl rounded-tl-sm text-xs leading-relaxed bg-gray-100 text-gray-800">
              El viernes
            </div>
          </div>
          <div className="flex justify-end">
            <div className="max-w-[85%] px-3 py-1.5 rounded-2xl rounded-tr-sm text-xs leading-relaxed text-white bg-gradient-to-r from-purple-500 to-pink-500">
              ¡Perfecto! ¿Me das tu nombre para reservar? ✨
            </div>
          </div>
        </div>
        <div className="bg-white border-t border-gray-100 px-3 py-2 flex gap-2 items-center">
          <div className="flex-1 bg-gray-100 rounded-full px-3 py-1.5 text-[10px] text-gray-400">Mensaje...</div>
          <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-gradient-to-r from-purple-500 to-pink-500">
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-white"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </div>
        </div>
      </div>
      <div className="text-center">
        <p className="font-semibold text-sm" style={{ color: "#0C1B26" }}>Instagram DM</p>
        <p className="text-xs" style={{ color: "#607281" }}>Captura leads desde tu perfil</p>
      </div>
    </div>
  );
}

/* ─── Web widget mockup ────────────────────────────────────────────── */
function WebWidgetMockup() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-full max-w-[240px] rounded-[2rem] border-[5px] border-gray-200 shadow-2xl overflow-hidden">
        <div className="px-4 py-3 flex items-center gap-3" style={{ backgroundColor: "#1A5C7A" }}>
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-xs shrink-0">G</div>
          <div>
            <p className="text-white font-semibold text-xs">Galana Clínica Dental</p>
            <p className="text-white/60 text-[10px]">Asistente virtual · En línea</p>
          </div>
        </div>
        <div className="px-3 py-3 space-y-2 min-h-[200px]" style={{ backgroundColor: "#F7F5F1" }}>
          <div className="flex justify-start">
            <div className="max-w-[85%] px-3 py-1.5 rounded-2xl rounded-tl-sm text-xs leading-relaxed bg-white text-gray-800 shadow-sm">
              ¿Cuánto vale una endodoncia?
            </div>
          </div>
          <div className="flex justify-end">
            <div className="max-w-[85%] px-3 py-1.5 rounded-2xl rounded-tr-sm text-xs leading-relaxed text-white" style={{ backgroundColor: "#1A5C7A" }}>
              Varía según la pieza. ¿Quieres ver horarios con el Dr. Garcés?
            </div>
          </div>
          <div className="flex justify-start">
            <div className="max-w-[85%] px-3 py-1.5 rounded-2xl rounded-tl-sm text-xs leading-relaxed bg-white text-gray-800 shadow-sm">
              Sí, para esta semana
            </div>
          </div>
          <div className="flex justify-end">
            <div className="max-w-[85%] px-3 py-1.5 rounded-2xl rounded-tr-sm text-xs leading-relaxed text-white" style={{ backgroundColor: "#1A5C7A" }}>
              Aquí tienes los horarios disponibles 👇
            </div>
          </div>
        </div>
        <div className="bg-white border-t border-gray-100 px-3 py-2 flex gap-2 items-center">
          <div className="flex-1 bg-gray-100 rounded-full px-3 py-1.5 text-[10px] text-gray-400">Escribe tu consulta...</div>
          <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "#1A5C7A" }}>
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-white"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </div>
        </div>
      </div>
      <div className="text-center">
        <p className="font-semibold text-sm" style={{ color: "#0C1B26" }}>Web Widget</p>
        <p className="text-xs" style={{ color: "#607281" }}>Integrado en tu sitio web</p>
      </div>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────── */
export default function Home() {
  const features = [
    { icon: <IconBot />, title: "Chatbot inteligente", desc: "Responde preguntas frecuentes, informa precios y horarios — 24/7, sin intervención humana." },
    { icon: <IconCalendar />, title: "Agendamiento automático", desc: "El paciente agenda directamente en la conversación. Sin llamadas, sin coordinación manual." },
    { icon: <IconTarget />, title: "Scoring de pacientes", desc: "Detecta urgencia e intención de cada paciente para priorizar los que más valor generan." },
    { icon: <IconLoop />, title: "Seguimiento automático", desc: "Recordatorios de cita, seguimiento post-consulta y recuperación de pacientes inactivos." },
  ];

  const problems = [
    { num: "01", title: "Mensajes sin respuesta", desc: "Pacientes que escriben por WhatsApp o Instagram y no reciben respuesta rápida." },
    { num: "02", title: "Leads que se enfrían", desc: "Consultas que llegan pero nunca convierten porque nadie las sigue." },
    { num: "03", title: "Agendamiento manual", desc: "Coordinar horas por mensaje uno a uno consume tiempo valioso de tu equipo." },
  ];

  const stats = [
    { value: "24/7", label: "Disponible siempre" },
    { value: "<2s", label: "Tiempo de respuesta" },
    { value: "+80%", label: "Tasa de conversión" },
    { value: "0", label: "Llamadas manuales" },
  ];

  return (
    <main className="min-h-screen overflow-x-hidden" style={{ backgroundColor: "#F7F5F1", color: "#0C1B26" }}>

      {/* NAV */}
      <nav className="flex items-center justify-between px-6 sm:px-10 py-5 bg-[#FDFCFB] border-b" style={{ borderColor: "#E5E0D9" }}>
        <Image src="/logo.svg" alt="molaris.ai" width={148} height={38} priority />
        <div className="flex items-center gap-6">
          <Link href="/pricing" className="text-sm font-medium hidden sm:block transition-colors" style={{ color: "#607281" }}>
            Precios
          </Link>
          <Link href="/register" className="text-sm font-medium hidden sm:block transition-colors" style={{ color: "#607281" }}>
            Registrarse
          </Link>
          <Link href="/login" className="text-sm font-medium transition-colors" style={{ color: "#0C1B26" }}>
            Acceder
          </Link>
          <a
            href="#como-funciona"
            className="text-sm font-semibold px-5 py-2 rounded-full text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#0B2F42" }}
          >
            Cómo funciona
          </a>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative overflow-hidden" style={{ backgroundColor: "#F7F5F1" }}>
        {/* Background grid */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(#0B2F42 1px, transparent 1px), linear-gradient(90deg, #0B2F42 1px, transparent 1px)", backgroundSize: "48px 48px" }} />

        <div className="relative max-w-6xl mx-auto px-6 sm:px-10 pt-16 sm:pt-24 pb-12 sm:pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* Left: copy */}
            <div>
              <span className="inline-flex items-center gap-2 text-xs font-bold px-4 py-1.5 rounded-full mb-8 animate-fade-up" style={{ backgroundColor: "#E8F3F7", color: "#1A5C7A", border: "1px solid rgba(26,92,122,0.2)" }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: "#D95F45" }} />
                IA para clínicas dentales
              </span>

              <h1 className="font-[family-name:var(--font-display)] text-5xl sm:text-6xl font-bold leading-[1.08] tracking-tight mb-6 animate-fade-up animate-fade-up-delay-1">
                Más pacientes.<br />
                <span style={{ color: "#D95F45" }}>Menos trabajo<br />manual.</span>
              </h1>

              <p className="text-base sm:text-lg max-w-md mb-10 animate-fade-up animate-fade-up-delay-2" style={{ color: "#607281" }}>
                molaris.ai automatiza la atención en WhatsApp, Instagram y tu web —
                responde 24/7 y convierte más consultas en citas agendadas.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 animate-fade-up animate-fade-up-delay-3">
                <Link
                  href="/register"
                  className="inline-block text-white font-semibold px-8 py-3.5 rounded-full text-sm transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "#0B2F42" }}
                >
                  Regístrate gratis →
                </Link>
                <a
                  href="https://wa.me/56966865887"
                  className="inline-block font-semibold px-8 py-3.5 rounded-full text-sm transition-colors"
                  style={{ border: "1px solid rgba(12,27,38,0.2)", color: "#0C1B26" }}
                >
                  Hablar con el equipo
                </a>
              </div>

              {/* Trust bar */}
              <div className="flex items-center gap-4 mt-10 animate-fade-up animate-fade-up-delay-3">
                <div className="flex -space-x-2">
                  {["G", "C", "P", "A"].map((l, i) => (
                    <div key={i} className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: ["#1A5C7A","#0B2F42","#D95F45","#1A5C7A"][i] }}>{l}</div>
                  ))}
                </div>
                <p className="text-xs" style={{ color: "#607281" }}>
                  <strong style={{ color: "#0C1B26" }}>+12 clínicas</strong> en Chile ya usan molaris.ai
                </p>
              </div>
            </div>

            {/* Right: live activity card */}
            <div className="hidden lg:flex flex-col items-end gap-4 animate-fade-up animate-fade-up-delay-2">
              {/* Main card */}
              <div className="w-full max-w-sm rounded-2xl p-5 shadow-xl" style={{ backgroundColor: "#0B2F42" }}>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">Actividad en vivo</p>
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: "#4ade80" }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    En línea
                  </span>
                </div>
                <div className="space-y-3">
                  {[
                    { canal: "WhatsApp", msg: "Nueva cita confirmada — Dra. Aranda", time: "hace 2 min", dot: "#25D366" },
                    { canal: "Instagram", msg: "Lead calificado — consulta ortodoncia", time: "hace 5 min", dot: "#E1306C" },
                    { canal: "Web", msg: "Pregunta respondida — horarios", time: "hace 8 min", dot: "#1A5C7A" },
                  ].map((item) => (
                    <div key={item.canal} className="flex items-start gap-3 p-3 rounded-xl" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                      <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: item.dot }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white/80 mb-0.5">{item.canal}</p>
                        <p className="text-xs text-white/50 truncate">{item.msg}</p>
                      </div>
                      <p className="text-[10px] text-white/30 shrink-0 mt-0.5">{item.time}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="flex justify-between text-xs">
                    <span style={{ color: "rgba(255,255,255,0.4)" }}>Citas hoy</span>
                    <span className="font-bold" style={{ color: "#D95F45" }}>7 confirmadas</span>
                  </div>
                </div>
              </div>

              {/* Floating badge */}
              <div className="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-lg mr-6" style={{ backgroundColor: "#FDFCFB", border: "1px solid #E5E0D9" }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "#E8F3F7", color: "#1A5C7A" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-bold" style={{ color: "#0C1B26" }}>Respuesta automática</p>
                  <p className="text-[11px]" style={{ color: "#607281" }}>En menos de 2 segundos</p>
                </div>
              </div>
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
                <p className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl font-bold" style={{ color: "#D95F45" }}>
                  {s.value}
                </p>
                <p className="text-xs mt-1.5" style={{ color: "rgba(255,255,255,0.55)" }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PLATFORMS */}
      <section className="py-16 sm:py-24" style={{ backgroundColor: "#FDFCFB" }}>
        <div className="max-w-5xl mx-auto px-6 sm:px-10">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-center mb-3" style={{ color: "#1A5C7A" }}>
            Multiplataforma
          </p>
          <h2 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl font-bold text-center mb-4">
            Donde tus pacientes ya están
          </h2>
          <p className="text-sm text-center max-w-xl mx-auto mb-14" style={{ color: "#607281" }}>
            El mismo asistente inteligente responde en todos tus canales — sin configuración extra por cada uno.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 justify-items-center">
            <WhatsAppMockup />
            <InstagramMockup />
            <WebWidgetMockup />
          </div>
        </div>
      </section>

      {/* PROBLEMA */}
      <section className="py-14 sm:py-20" style={{ backgroundColor: "#F7F5F1" }}>
        <div className="max-w-4xl mx-auto px-6 sm:px-10">
          <h2 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl font-bold text-center mb-12">
            ¿Te suena familiar?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {problems.map((item) => (
              <div
                key={item.num}
                className="rounded-2xl p-6 sm:p-7"
                style={{
                  backgroundColor: "#FDFCFB",
                  borderTop: "2.5px solid #D95F45",
                  boxShadow: "0 1px 3px rgba(12,27,38,0.05)",
                }}
              >
                <p
                  className="font-[family-name:var(--font-display)] text-5xl font-bold mb-5"
                  style={{ color: "rgba(217,95,69,0.18)" }}
                >
                  {item.num}
                </p>
                <h3 className="font-semibold text-base mb-2">{item.title}</h3>
                <p className="text-sm" style={{ color: "#607281" }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-14 sm:py-20" style={{ backgroundColor: "#FDFCFB" }}>
        <div className="max-w-4xl mx-auto px-6 sm:px-10">
          <h2 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl font-bold text-center mb-12">
            Qué hace molaris.ai
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {features.map((f) => (
              <div
                key={f.title}
                className="flex gap-4 p-5 sm:p-6 rounded-2xl transition-shadow hover:shadow-md"
                style={{ backgroundColor: "#F7F5F1", border: "1px solid #E5E0D9" }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: "#E8F3F7", color: "#1A5C7A" }}
                >
                  {f.icon}
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{f.title}</h3>
                  <p className="text-sm" style={{ color: "#607281" }}>{f.desc}</p>
                </div>
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
          <h2 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl font-bold text-center text-white mb-14">
            En marcha en minutos
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-0">
            {[
              {
                step: "01",
                title: "Conectamos tus canales",
                desc: "Integramos WhatsApp Business, tu Instagram y el widget en tu sitio web en una configuración inicial.",
              },
              {
                step: "02",
                title: "El asistente atiende 24/7",
                desc: "Responde consultas, informa precios, agenda citas y califica leads — sin intervención humana.",
              },
              {
                step: "03",
                title: "Tú ves los resultados",
                desc: "Dashboard en tiempo real con leads, citas confirmadas y métricas de conversión por canal.",
              },
            ].map((item, i) => (
              <div key={item.step} className="relative flex flex-col px-6 sm:px-8 py-8 sm:py-0" style={i > 0 ? { borderLeft: "1px solid rgba(255,255,255,0.1)" } : {}}>
                <p className="font-[family-name:var(--font-display)] text-5xl font-bold mb-5" style={{ color: "#D95F45", opacity: 0.6 }}>{item.step}</p>
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
          <h2 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl font-bold text-center mb-3">
            Planes y precios
          </h2>
          <p className="text-sm text-center mb-12" style={{ color: "#607281" }}>
            Sin contratos largos. Cancela cuando quieras.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-6 items-stretch">

            {/* Starter */}
            <div className="flex flex-col rounded-2xl p-6 sm:p-7" style={{ border: "1px solid #E5E0D9", backgroundColor: "#FDFCFB" }}>
              <p className="text-xs font-bold uppercase tracking-[0.12em] mb-5" style={{ color: "#607281" }}>Starter</p>
              <div className="mb-1">
                <span className="font-[family-name:var(--font-display)] text-4xl font-bold">$49</span>
                <span className="text-sm ml-1.5" style={{ color: "#607281" }}>USD / mes</span>
              </div>
              <p className="text-sm mb-6" style={{ color: "#607281" }}>Para clínicas pequeñas (1 box)</p>
              <ul className="flex flex-col gap-2.5 text-sm mb-8 flex-1">
                {["Chatbot con IA 24/7", "Respuestas a preguntas frecuentes", "Agendamiento automático", "1 canal de atención"].map((f) => (
                  <li key={f} className="flex items-center gap-2.5">
                    <span className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold" style={{ backgroundColor: "#E8F3F7", color: "#1A5C7A" }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="https://wa.me/56966865887"
                className="block text-center font-semibold py-3 rounded-full text-sm transition-colors"
                style={{ border: "1.5px solid #1A5C7A", color: "#1A5C7A" }}
              >
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
                <span className="font-[family-name:var(--font-display)] text-4xl font-bold">$129</span>
                <span className="text-sm ml-1.5" style={{ color: "#607281" }}>USD / mes</span>
              </div>
              <p className="text-sm mb-6" style={{ color: "#607281" }}>Para clínicas medianas (2–5 boxes)</p>
              <ul className="flex flex-col gap-2.5 text-sm mb-8 flex-1">
                {["Todo lo del plan Starter", "Lead scoring de pacientes", "Seguimiento automático post-consulta", "Analytics de conversión", "Múltiples canales de atención"].map((f) => (
                  <li key={f} className="flex items-center gap-2.5">
                    <span className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold" style={{ backgroundColor: "#FDECEA", color: "#D95F45" }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="https://wa.me/56966865887"
                className="block text-center text-white font-semibold py-3 rounded-full text-sm transition-opacity hover:opacity-90"
                style={{ backgroundColor: "#D95F45" }}
              >
                Empezar ahora
              </a>
            </div>

            {/* Enterprise */}
            <div className="flex flex-col rounded-2xl p-6 sm:p-7" style={{ border: "1px solid #E5E0D9", backgroundColor: "#FDFCFB" }}>
              <p className="text-xs font-bold uppercase tracking-[0.12em] mb-5" style={{ color: "#607281" }}>Enterprise</p>
              <div className="mb-1">
                <span className="font-[family-name:var(--font-display)] text-4xl font-bold">Custom</span>
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
              <a
                href="https://wa.me/56966865887"
                className="block text-center font-semibold py-3 rounded-full text-sm transition-colors"
                style={{ border: "1.5px solid #E5E0D9", color: "#607281" }}
              >
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
          <h2 className="font-[family-name:var(--font-display)] text-3xl sm:text-5xl font-bold text-white mb-5">
            ¿Tienes una clínica dental?
          </h2>
          <p className="mb-10 text-sm sm:text-base" style={{ color: "rgba(255,255,255,0.6)" }}>
            Regístrate, configura tu clínica y activa tu asistente — tú decides el ritmo.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/register"
              className="inline-block font-semibold px-8 py-3.5 rounded-full text-sm transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#D95F45", color: "white" }}
            >
              Regístrate gratis →
            </Link>
            <a
              href="https://wa.me/56966865887"
              className="inline-block font-semibold px-8 py-3.5 rounded-full text-sm transition-colors"
              style={{ border: "1px solid rgba(255,255,255,0.25)", color: "rgba(255,255,255,0.85)" }}
            >
              Hablar con el equipo
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-6 text-sm" style={{ borderTop: "1px solid #E5E0D9", color: "#607281", backgroundColor: "#FDFCFB" }}>
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>© {new Date().getFullYear()} molaris.ai — Santiago, Chile</span>
          <div className="flex items-center gap-4">
            <Link href="/legal/terminos" className="hover:text-gray-900 transition-colors">Términos y condiciones</Link>
            <Link href="/legal/privacidad" className="hover:text-gray-900 transition-colors">Privacidad</Link>
          </div>
        </div>
      </footer>

    </main>
  );
}
