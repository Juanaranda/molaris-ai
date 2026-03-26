import { ChatDemo } from "@/components/ChatDemo";

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-gray-900 font-sans">
      {/* NAV */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-gray-100">
        <span className="text-xl font-bold tracking-tight">
          molaris<span className="text-blue-600">.ai</span>
        </span>
        <a
          href="#demo"
          className="bg-blue-600 text-white text-sm font-medium px-5 py-2 rounded-full hover:bg-blue-700 transition-colors"
        >
          Ver demo
        </a>
      </nav>

      {/* HERO */}
      <section className="max-w-4xl mx-auto px-8 pt-24 pb-16 text-center">
        <p className="text-blue-600 text-sm font-semibold uppercase tracking-widest mb-4">
          IA para clínicas dentales
        </p>
        <h1 className="text-5xl font-extrabold leading-tight tracking-tight mb-6">
          Más pacientes.<br />
          Menos trabajo manual.
        </h1>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-10">
          molaris.ai automatiza la atención, responde consultas 24/7 y convierte
          más leads en citas — con inteligencia artificial entrenada para tu clínica.
        </p>
        <a
          href="#demo"
          className="inline-block bg-blue-600 text-white font-semibold px-8 py-3 rounded-full hover:bg-blue-700 transition-colors text-base"
        >
          Probar ahora →
        </a>
      </section>

      {/* PROBLEMA */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-4xl mx-auto px-8">
          <h2 className="text-2xl font-bold text-center mb-10">
            ¿Te suena familiar?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
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
                className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
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
      <section className="max-w-4xl mx-auto px-8 py-16">
        <h2 className="text-2xl font-bold text-center mb-10">Qué hace molaris.ai</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
              className="flex gap-4 p-6 rounded-2xl border border-gray-100 hover:border-blue-200 transition-colors"
            >
              <span className="text-2xl">{f.icon}</span>
              <div>
                <h3 className="font-semibold mb-1">{f.title}</h3>
                <p className="text-gray-500 text-sm">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* DEMO */}
      <section id="demo" className="bg-gray-50 py-16">
        <div className="max-w-xl mx-auto px-8">
          <h2 className="text-2xl font-bold text-center mb-2">Pruébalo ahora</h2>
          <p className="text-gray-500 text-center text-sm mb-8">
            Demo en vivo del asistente de Galana Clínica Dental
          </p>
          <ChatDemo />
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-2xl mx-auto px-8 py-20 text-center">
        <h2 className="text-3xl font-bold mb-4">¿Tienes una clínica dental?</h2>
        <p className="text-gray-500 mb-8">
          Implementamos molaris.ai en tu clínica en menos de 48 horas.
        </p>
        <a
          href="https://wa.me/56966865887"
          className="inline-block bg-green-500 text-white font-semibold px-8 py-3 rounded-full hover:bg-green-600 transition-colors"
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
