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
          <Link href="/partners/dashboard"
            className="text-sm font-bold text-[#1A5C7A] hover:text-[#0e4560] transition flex items-center gap-1">
            ← Pacientes
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
