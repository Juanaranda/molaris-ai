"use client";

/**
 * Ficha del paciente como página completa (no modal).
 *
 * Con URL propia la ficha se puede abrir en otra pestaña, compartir entre el
 * equipo y volver con el botón atrás — el flujo real de una clínica donde la
 * recepcionista y el doctor miran al mismo paciente a la vez. El modal quedó
 * solo como vista rápida legada.
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getMe } from "@/lib/auth";
import { PatientRecordView } from "@/components/PatientRecordModal";

export default function PatientPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getMe().then((data) => {
      if (!data) { router.push("/login"); return; }
      setReady(true);
    });
  }, [router]);

  if (!ready || !params?.id) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F0EDE8]">
        <p className="text-sm text-gray-400">Cargando…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0EDE8]">
      <header className="bg-white/80 backdrop-blur border-b border-[#E5E0D9] sticky top-0 z-40">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          {/* Botón de volver, no una flecha suelta: el "←" pegado al texto se
              leía como parte del nombre de la sección. */}
          <Link href="/partners/dashboard"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-[#1A5C7A] border border-[#E5E0D9] hover:border-[#1A5C7A] bg-white rounded-xl px-3 py-1.5 transition">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}
              strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 shrink-0">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Volver
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm text-gray-500">Ficha clínica</span>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5">
        <PatientRecordView patientId={params.id} variant="page" />
      </main>
    </div>
  );
}
