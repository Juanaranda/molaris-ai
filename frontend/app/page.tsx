import Image from "next/image";
import Link from "next/link";
import { ChatDemo } from "@/components/ChatDemo";

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-gray-900 font-sans">
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
      <section className="max-w-4xl mx-auto px-4 sm:px-8 pt-14 sm:pt-24 pb-12 sm:pb-16 text-center">
        <p className="text-blue-600 text-xs sm:text-sm font-semibold uppercase tracking-widest mb-4">
          IA para clínicas dentales
        </p>
        <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight tracking-tight mb-5 sm:mb-6">
          Más pacientes.<br />
          Menos trabajo manual.
        </h1>
        <p className="text-base sm:text-lg text-gray-500 max-w-2xl mx-auto mb-8 sm:mb-10">
          molaris.ai automatiza la atención, responde consultas 24/7 y convierte
          más leads en citas — con inteligencia artificial entrenada para tu clínica.
        </p>
        <a
          href="#demo"
          className="inline-block bg-blue-600 text-white font-semibold px-7 sm:px-8 py-3 rounded-full hover:bg-blue-700 transition-colors text-sm sm:text-base"
        >
          Probar ahora →
        </a>
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
              className="flex gap-4 p-5 sm:p-6 rounded-2xl border border-gray-100 hover:border-blue-200 transition-colors"
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
              {[
                "Chatbot con IA 24/7",
                "Respuestas a preguntas frecuentes",
                "Agendamiento automático",
                "1 canal de atención",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <span className="text-blue-500 font-bold">✓</span> {f}
                </li>
              ))}
            </ul>
            <a
              href="https://wa.me/56966865887"
              className="block text-center border border-blue-600 text-blue-600 font-semibold py-2.5 rounded-full text-sm hover:bg-blue-50 transition-colors"
            >
              Empezar ahora
            </a>
          </div>

          {/* Pro — destacado */}
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
              {[
                "Todo lo del plan Starter",
                "Lead scoring de pacientes",
                "Seguimiento automático post-consulta",
                "Analytics de conversión",
                "Múltiples canales de atención",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <span className="text-blue-500 font-bold">✓</span> {f}
                </li>
              ))}
            </ul>
            <a
              href="https://wa.me/56966865887"
              className="block text-center bg-blue-600 text-white font-semibold py-2.5 rounded-full text-sm hover:bg-blue-700 transition-colors"
            >
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
              {[
                "Todo lo del plan Pro",
                "Multi-sucursal",
                "API e integraciones a medida",
                "Onboarding dedicado",
                "SLA garantizado",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <span className="text-blue-500 font-bold">✓</span> {f}
                </li>
              ))}
            </ul>
            <a
              href="https://wa.me/56966865887"
              className="block text-center border border-gray-300 text-gray-700 font-semibold py-2.5 rounded-full text-sm hover:bg-gray-50 transition-colors"
            >
              Hablar con el equipo
            </a>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-2xl mx-auto px-4 sm:px-8 py-14 sm:py-20 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold mb-4">¿Tienes una clínica dental?</h2>
        <p className="text-gray-500 mb-8 text-sm sm:text-base">
          Implementamos molaris.ai en tu clínica en menos de 48 horas.
        </p>
        <a
          href="https://wa.me/56966865887"
          className="inline-block bg-green-500 text-white font-semibold px-6 sm:px-8 py-3 rounded-full hover:bg-green-600 transition-colors text-sm sm:text-base"
        >
          Hablar con el equipo por WhatsApp
        </a>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-gray-100 py-6 text-center text-sm text-gray-400">
        © {new Date().getFullYear()} molaris.ai — Santiago, Chile
      </footer>
    </main>
  );
}
