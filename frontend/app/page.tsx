import Image from "next/image";
import Link from "next/link";
import { ChatDemo } from "@/components/ChatDemo";

/* ─── WhatsApp mockup ──────────────────────────────────────────── */
function WhatsAppMockup() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-full max-w-[240px] rounded-[2rem] border-[5px] border-gray-200 shadow-2xl overflow-hidden">
        <div className="px-4 py-3 flex items-center gap-3" style={{ backgroundColor: "#128C7E" }}>
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-xs shrink-0">
            G
          </div>
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
          <div className="flex-1 bg-gray-100 rounded-full px-3 py-1.5 text-[10px] text-gray-400">
            Escribe un mensaje...
          </div>
          <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "#25D366" }}>
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-white"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </div>
        </div>
      </div>
      <div className="text-center">
        <p className="font-semibold text-sm text-gray-900">WhatsApp</p>
        <p className="text-xs text-gray-500">El canal favorito de tus pacientes</p>
      </div>
    </div>
  );
}

/* ─── Instagram mockup ─────────────────────────────────────────── */
function InstagramMockup() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-full max-w-[240px] rounded-[2rem] border-[5px] border-gray-200 shadow-2xl overflow-hidden">
        <div className="px-4 py-3 flex items-center gap-3 bg-gradient-to-r from-purple-600 to-pink-500">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-xs shrink-0">
            G
          </div>
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
          <div className="flex-1 bg-gray-100 rounded-full px-3 py-1.5 text-[10px] text-gray-400">
            Mensaje...
          </div>
          <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-gradient-to-r from-purple-500 to-pink-500">
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-white"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </div>
        </div>
      </div>
      <div className="text-center">
        <p className="font-semibold text-sm text-gray-900">Instagram DM</p>
        <p className="text-xs text-gray-500">Captura leads desde tu perfil</p>
      </div>
    </div>
  );
}

/* ─── Web widget mockup ────────────────────────────────────────── */
function WebWidgetMockup() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-full max-w-[240px] rounded-[2rem] border-[5px] border-gray-200 shadow-2xl overflow-hidden">
        <div className="px-4 py-3 flex items-center gap-3 bg-sky-600">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-xs shrink-0">
            G
          </div>
          <div>
            <p className="text-white font-semibold text-xs">Galana Clínica Dental</p>
            <p className="text-sky-200 text-[10px]">Asistente virtual · En línea</p>
          </div>
        </div>
        <div className="bg-gray-50 px-3 py-3 space-y-2 min-h-[200px]">
          <div className="flex justify-start">
            <div className="max-w-[85%] px-3 py-1.5 rounded-2xl rounded-tl-sm text-xs leading-relaxed bg-gray-200 text-gray-800">
              ¿Cuánto vale una endodoncia?
            </div>
          </div>
          <div className="flex justify-end">
            <div className="max-w-[85%] px-3 py-1.5 rounded-2xl rounded-tr-sm text-xs leading-relaxed bg-sky-600 text-white">
              Varía según la pieza. ¿Quieres ver horarios con el Dr. Garcés?
            </div>
          </div>
          <div className="flex justify-start">
            <div className="max-w-[85%] px-3 py-1.5 rounded-2xl rounded-tl-sm text-xs leading-relaxed bg-gray-200 text-gray-800">
              Sí, para esta semana
            </div>
          </div>
          <div className="flex justify-end">
            <div className="max-w-[85%] px-3 py-1.5 rounded-2xl rounded-tr-sm text-xs leading-relaxed bg-sky-600 text-white">
              Aquí tienes los horarios disponibles 👇
            </div>
          </div>
        </div>
        <div className="bg-white border-t border-gray-100 px-3 py-2 flex gap-2 items-center">
          <div className="flex-1 bg-gray-100 rounded-full px-3 py-1.5 text-[10px] text-gray-400">
            Escribe tu consulta...
          </div>
          <div className="w-7 h-7 rounded-full bg-sky-600 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-white"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </div>
        </div>
      </div>
      <div className="text-center">
        <p className="font-semibold text-sm text-gray-900">Web Widget</p>
        <p className="text-xs text-gray-500">Integrado en tu sitio web</p>
      </div>
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────────────── */
export default function Home() {
  return (
    <main className="min-h-screen bg-white text-gray-900 font-sans overflow-x-hidden">
      {/* NAV */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-gray-100">
        <Image src="/logo.svg" alt="molaris.ai" width={160} height={40} priority />
        <div className="flex items-center gap-6">
          <Link href="/pricing" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
            Precios
          </Link>
          <a
            href="#demo"
            className="bg-blue-600 text-white text-sm font-medium px-5 py-2 rounded-full hover:bg-blue-700 transition-colors"
          >
            Ver demo
          </a>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative max-w-4xl mx-auto px-4 sm:px-8 pt-16 sm:pt-28 pb-14 sm:pb-20 text-center">
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -top-20 -left-20 w-80 h-80 bg-blue-100 rounded-full blur-3xl opacity-40" />
        <div className="pointer-events-none absolute -top-10 -right-10 w-64 h-64 bg-indigo-100 rounded-full blur-3xl opacity-30" />

        <span className="relative inline-flex items-center gap-2 bg-blue-50 border border-blue-100 text-blue-600 text-xs sm:text-sm font-semibold px-4 py-1.5 rounded-full mb-6">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          IA para clínicas dentales
        </span>
        <h1 className="relative text-4xl sm:text-6xl font-extrabold leading-tight tracking-tight mb-5">
          Más pacientes.<br />
          <span className="text-blue-600">Menos trabajo manual.</span>
        </h1>
        <p className="relative text-base sm:text-lg text-gray-500 max-w-2xl mx-auto mb-8 sm:mb-10">
          molaris.ai automatiza la atención en WhatsApp, Instagram y tu web —
          responde 24/7 y convierte más consultas en citas agendadas.
        </p>
        <div className="relative flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="#demo"
            className="inline-block bg-blue-600 text-white font-semibold px-7 sm:px-8 py-3 rounded-full hover:bg-blue-700 transition-colors text-sm sm:text-base"
          >
            Probar ahora →
          </a>
          <a
            href="https://wa.me/56966865887"
            className="inline-block border border-gray-200 text-gray-700 font-semibold px-7 sm:px-8 py-3 rounded-full hover:bg-gray-50 transition-colors text-sm sm:text-base"
          >
            Hablar con el equipo
          </a>
        </div>
      </section>

      {/* STATS STRIP */}
      <section className="border-y border-gray-100 py-6 bg-gray-50/60">
        <div className="max-w-4xl mx-auto px-4 sm:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            {[
              { value: "24/7", label: "Disponible siempre" },
              { value: "<2s", label: "Tiempo de respuesta" },
              { value: "+80%", label: "Tasa de conversión" },
              { value: "0", label: "Llamadas manuales" },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-2xl sm:text-3xl font-extrabold text-blue-600">{s.value}</p>
                <p className="text-xs text-gray-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PLATFORMS */}
      <section className="py-14 sm:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-8">
          <p className="text-blue-600 text-xs sm:text-sm font-semibold uppercase tracking-widest text-center mb-3">
            Multiplataforma
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-3">
            Donde tus pacientes ya están
          </h2>
          <p className="text-gray-500 text-sm text-center max-w-xl mx-auto mb-12 sm:mb-14">
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
      <section className="bg-gray-50 py-12 sm:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-8">
          <h2 className="text-xl sm:text-2xl font-bold text-center mb-8 sm:mb-10">
            ¿Te suena familiar?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            {[
              {
                icon: "💬",
                title: "Mensajes sin respuesta",
                desc: "Pacientes que escriben por WhatsApp o Instagram y no reciben respuesta rápida.",
              },
              {
                icon: "📉",
                title: "Leads que se enfrían",
                desc: "Consultas que llegan pero nunca convierten porque nadie las sigue.",
              },
              {
                icon: "🗓️",
                title: "Agendamiento manual",
                desc: "Coordinar horas por mensaje uno a uno consume tiempo valioso de tu equipo.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-100 shadow-sm"
              >
                <div className="text-3xl mb-3">{item.icon}</div>
                <h3 className="font-semibold text-base mb-2">{item.title}</h3>
                <p className="text-gray-500 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="max-w-4xl mx-auto px-4 sm:px-8 py-12 sm:py-16">
        <h2 className="text-xl sm:text-2xl font-bold text-center mb-8 sm:mb-10">Qué hace molaris.ai</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {[
            {
              icon: "🤖",
              title: "Chatbot inteligente",
              desc: "Responde preguntas frecuentes, informa precios y horarios — 24/7, sin intervención humana.",
            },
            {
              icon: "📅",
              title: "Agendamiento automático",
              desc: "El paciente agenda directamente en la conversación. Sin llamadas, sin coordinación manual.",
            },
            {
              icon: "🎯",
              title: "Scoring de pacientes",
              desc: "Detecta urgencia e intención de cada paciente para priorizar los que más valor generan.",
            },
            {
              icon: "🔁",
              title: "Seguimiento automático",
              desc: "Recordatorios de cita, seguimiento post-consulta y recuperación de pacientes inactivos.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="flex gap-4 p-5 sm:p-6 rounded-2xl border border-gray-100 hover:border-blue-200 hover:shadow-sm transition-all"
            >
              <span className="text-2xl shrink-0">{f.icon}</span>
              <div>
                <h3 className="font-semibold mb-1">{f.title}</h3>
                <p className="text-gray-500 text-sm">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* DEMO */}
      <section id="demo" className="bg-gray-50 py-12 sm:py-16">
        <div className="max-w-xl mx-auto px-4 sm:px-8">
          <h2 className="text-xl sm:text-2xl font-bold text-center mb-2">Pruébalo ahora</h2>
          <p className="text-gray-500 text-center text-sm mb-6 sm:mb-8">
            Demo en vivo del asistente de Galana Clínica Dental
          </p>
          <ChatDemo />
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="max-w-5xl mx-auto px-4 sm:px-8 py-14 sm:py-20">
        <h2 className="text-xl sm:text-2xl font-bold text-center mb-3">Planes y precios</h2>
        <p className="text-gray-500 text-center text-sm mb-10 sm:mb-12">
          Sin contratos largos. Cancela cuando quieras.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-6 items-stretch">
          {/* Starter */}
          <div className="flex flex-col rounded-2xl border border-gray-200 p-6 sm:p-7">
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-4">Starter</p>
            <div className="mb-1">
              <span className="text-4xl font-extrabold tracking-tight">$49</span>
              <span className="text-gray-400 text-sm ml-1">USD / mes</span>
            </div>
            <p className="text-gray-500 text-sm mb-6">Para clínicas pequeñas (1 box)</p>
            <ul className="flex flex-col gap-2 text-sm text-gray-700 mb-8 flex-1">
              {["Chatbot con IA 24/7", "Respuestas a preguntas frecuentes", "Agendamiento automático", "1 canal de atención"].map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <span className="text-blue-500 font-bold">✓</span> {f}
                </li>
              ))}
            </ul>
            <a href="https://wa.me/56966865887" className="block text-center border border-blue-600 text-blue-600 font-semibold py-2.5 rounded-full text-sm hover:bg-blue-50 transition-colors">
              Empezar ahora
            </a>
          </div>

          {/* Pro */}
          <div className="flex flex-col rounded-2xl border-2 border-blue-600 p-6 sm:p-7 relative shadow-lg">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-semibold px-4 py-1 rounded-full whitespace-nowrap">
              Más popular
            </span>
            <p className="text-sm font-semibold text-blue-600 uppercase tracking-widest mb-4">Pro</p>
            <div className="mb-1">
              <span className="text-4xl font-extrabold tracking-tight">$129</span>
              <span className="text-gray-400 text-sm ml-1">USD / mes</span>
            </div>
            <p className="text-gray-500 text-sm mb-6">Para clínicas medianas (2–5 boxes)</p>
            <ul className="flex flex-col gap-2 text-sm text-gray-700 mb-8 flex-1">
              {["Todo lo del plan Starter", "Lead scoring de pacientes", "Seguimiento automático post-consulta", "Analytics de conversión", "Múltiples canales de atención"].map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <span className="text-blue-500 font-bold">✓</span> {f}
                </li>
              ))}
            </ul>
            <a href="https://wa.me/56966865887" className="block text-center bg-blue-600 text-white font-semibold py-2.5 rounded-full text-sm hover:bg-blue-700 transition-colors">
              Empezar ahora
            </a>
          </div>

          {/* Enterprise */}
          <div className="flex flex-col rounded-2xl border border-gray-200 p-6 sm:p-7">
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-4">Enterprise</p>
            <div className="mb-1">
              <span className="text-4xl font-extrabold tracking-tight">Custom</span>
            </div>
            <p className="text-gray-500 text-sm mb-6">Para cadenas o grupos dentales</p>
            <ul className="flex flex-col gap-2 text-sm text-gray-700 mb-8 flex-1">
              {["Todo lo del plan Pro", "Multi-sucursal", "API e integraciones a medida", "Onboarding dedicado", "SLA garantizado"].map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <span className="text-blue-500 font-bold">✓</span> {f}
                </li>
              ))}
            </ul>
            <a href="https://wa.me/56966865887" className="block text-center border border-gray-300 text-gray-700 font-semibold py-2.5 rounded-full text-sm hover:bg-gray-50 transition-colors">
              Hablar con el equipo
            </a>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative bg-blue-600 py-14 sm:py-20 text-center overflow-hidden">
        <div className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 bg-blue-500 rounded-full blur-3xl opacity-40" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 w-64 h-64 bg-indigo-600 rounded-full blur-3xl opacity-40" />
        <div className="relative max-w-2xl mx-auto px-4 sm:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            ¿Tienes una clínica dental?
          </h2>
          <p className="text-blue-100 mb-8 text-sm sm:text-base">
            Implementamos molaris.ai en tu clínica en menos de 48 horas.
          </p>
          <a
            href="https://wa.me/56966865887"
            className="inline-block bg-white text-blue-600 font-semibold px-6 sm:px-8 py-3 rounded-full hover:bg-blue-50 transition-colors text-sm sm:text-base shadow-lg"
          >
            Hablar con el equipo por WhatsApp →
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-gray-100 py-6 text-center text-sm text-gray-400">
        © {new Date().getFullYear()} molaris.ai — Santiago, Chile
      </footer>
    </main>
  );
}
