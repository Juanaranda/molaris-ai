"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChatDemo } from "./ChatDemo";

export function DemoSection() {
  const params = useSearchParams();
  const clinicSlug = params.get("clinic") ?? "galana";
  const isCustom = clinicSlug !== "galana";

  return (
    <section id="demo" className="bg-gray-50 py-12 sm:py-16">
      <div className="max-w-xl mx-auto px-4 sm:px-8">
        <p className="text-blue-600 text-xs sm:text-sm font-semibold uppercase tracking-widest text-center mb-3">
          Demo en vivo
        </p>
        <h2 className="text-xl sm:text-2xl font-bold text-center mb-2">Así habla el asistente</h2>

        {isCustom ? (
          <p className="text-gray-500 text-center text-sm mb-6 sm:mb-8">
            Conversando con el asistente configurado para tu clínica.
          </p>
        ) : (
          <>
            <p className="text-gray-500 text-center text-sm mb-2">
              Ejemplo real con Galana Clínica Dental — tu asistente usará la información de tu propia clínica.
            </p>
            <p className="text-center mb-6 sm:mb-8">
              <Link
                href="/login"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium underline underline-offset-2"
              >
                Accede al portal para configurar tu clínica →
              </Link>
            </p>
          </>
        )}

        <ChatDemo clinicSlug={clinicSlug} />
      </div>
    </section>
  );
}
