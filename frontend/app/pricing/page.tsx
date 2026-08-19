import Image from "next/image";
import Link from "next/link";
import { Check } from "lucide-react";

const PLANS = [
  {
    name: "Doctor",
    price: "$12.990",
    period: "/mes",
    description: "Para el dentista independiente. Menos que una consulta particular.",
    highlight: false,
    features: [
      "Recepción IA en WhatsApp y web",
      "Agenda personal + recordatorios",
      "Ficha clínica + odontograma",
      "Pacientes y pagos",
      "1 profesional",
      "Soporte por WhatsApp",
    ],
    cta: "Empezar ahora",
    ctaHref: "/register",
  },
  {
    name: "Esencial",
    price: "$59.990",
    period: "/mes",
    description: "Para la clínica que recién se digitaliza.",
    highlight: false,
    features: [
      "Recepción IA en tu sitio web",
      "Agenda por profesional",
      "Ficha clínica + odontograma",
      "Recordatorios automáticos de cita",
      "Hasta 2 profesionales",
      "Soporte por email",
    ],
    cta: "Comenzar",
    ctaHref: "https://wa.me/56966865887",
  },
  {
    name: "Profesional",
    price: "$99.990",
    period: "/mes",
    description: "La clínica completa. El más elegido.",
    highlight: true,
    features: [
      "Todo lo de Esencial",
      "Recepción IA en WhatsApp Business",
      "Recall automático + lista de espera",
      "Pagos online y boleta electrónica SII",
      "Dashboard de gestión + scoring de pacientes",
      "Hasta 5 profesionales",
      "Soporte prioritario",
    ],
    cta: "Hablar con ventas",
    ctaHref: "https://wa.me/56966865887",
  },
  {
    name: "Clínica+",
    price: "A medida",
    period: "",
    description: "Para grupos de clínicas y multi-sucursal.",
    highlight: false,
    features: [
      "Todo lo de Profesional",
      "Profesionales ilimitados",
      "Múltiples sucursales",
      "Integración con tu sistema vía API",
      "Onboarding dedicado",
      "SLA garantizado",
    ],
    cta: "Contactar equipo",
    ctaHref: "https://wa.me/56966865887",
  },
];

const FAQ = [
  {
    q: "¿Hay contrato de permanencia?",
    a: "No. Los planes son mes a mes. Puedes cancelar cuando quieras.",
  },
  {
    q: "¿Cuánto tarda la implementación?",
    a: "Entre 24 y 48 horas desde que nos entregas los datos de tu clínica. Nosotros cargamos tus servicios, doctores y horarios.",
  },
  {
    q: "¿La agenda y la ficha clínica vienen incluidas?",
    a: "Sí. molari.ai es el sistema completo de tu clínica: agenda, ficha clínica, odontograma, presupuestos y pagos — no es solo un chatbot.",
  },
  {
    q: "¿Puedo sumar más profesionales?",
    a: "Sí. Si tu equipo supera el tope de tu plan, subes al siguiente o lo conversamos en Clínica+. Sin sorpresas en la cuenta.",
  },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-white text-gray-900 font-sans">
      {/* NAV */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-gray-100">
        <Link href="/">
          <Image src="/logo.svg" alt="molari.ai" width={160} height={40} priority />
        </Link>
        <div className="flex items-center gap-6">
          <Link href="/#demo" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
            Demo
          </Link>
          <Link
            href="https://wa.me/56966865887"
            className="bg-blue-600 text-white text-sm font-medium px-5 py-2 rounded-full hover:bg-blue-700 transition-colors"
          >
            Hablar con ventas
          </Link>
        </div>
      </nav>

      {/* HEADER */}
      <section className="max-w-3xl mx-auto px-8 pt-20 pb-12 text-center">
        <p className="text-blue-600 text-sm font-semibold uppercase tracking-widest mb-4">
          Planes y precios
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight mb-4">
          Simples. Sin sorpresas.
        </h1>
        <p className="text-gray-500 text-lg">
          Elige el plan que se ajusta al tamaño de tu clínica. Sin contratos, sin costos ocultos.
        </p>
      </section>

      {/* PLANES */}
      <section className="max-w-6xl mx-auto px-8 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl p-8 border flex flex-col ${
                plan.highlight
                  ? "border-blue-500 shadow-lg shadow-blue-100 bg-blue-50"
                  : "border-gray-200 bg-white"
              }`}
            >
              {plan.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-semibold px-4 py-1 rounded-full">
                  Más popular
                </span>
              )}
              <div className="mb-6">
                <h2 className="text-lg font-bold mb-1">{plan.name}</h2>
                <p className="text-gray-500 text-sm mb-4">{plan.description}</p>
                <div className="flex items-end gap-1">
                  <span className="text-3xl font-extrabold">{plan.price}</span>
                  {plan.period && (
                    <span className="text-gray-400 text-sm mb-1">{plan.period}</span>
                  )}
                </div>
              </div>

              <ul className="space-y-3 flex-1 mb-8">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-blue-500 mt-0.5"><Check className="w-3 h-3" aria-hidden /></span>
                    {f}
                  </li>
                ))}
              </ul>

              <a
                href={plan.ctaHref}
                target="_blank"
                rel="noopener noreferrer"
                className={`w-full text-center font-semibold py-3 rounded-xl transition-colors text-sm ${
                  plan.highlight
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-gray-900 text-white hover:bg-gray-700"
                }`}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-2xl mx-auto px-8">
          <h2 className="text-2xl font-bold text-center mb-10">Preguntas frecuentes</h2>
          <div className="space-y-6">
            {FAQ.map((item) => (
              <div key={item.q} className="bg-white rounded-2xl p-6 border border-gray-100">
                <h3 className="font-semibold mb-2">{item.q}</h3>
                <p className="text-gray-500 text-sm">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-2xl mx-auto px-8 py-20 text-center">
        <h2 className="text-3xl font-bold mb-4">¿Tienes dudas sobre qué plan elegir?</h2>
        <p className="text-gray-500 mb-8">
          Cuéntanos sobre tu clínica y te recomendamos el plan ideal — sin compromiso.
        </p>
        <a
          href="https://wa.me/56966865887"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-green-500 text-white font-semibold px-8 py-3 rounded-full hover:bg-green-600 transition-colors"
        >
          Hablar con el equipo por WhatsApp
        </a>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-gray-100 py-6 text-center text-sm text-gray-400">
        © {new Date().getFullYear()} molari.ai — Santiago, Chile
      </footer>
    </main>
  );
}
