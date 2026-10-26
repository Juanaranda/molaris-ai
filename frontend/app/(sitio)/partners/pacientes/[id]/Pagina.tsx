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
import { idDePaciente } from "@/lib/rutasApp";
import { PatientRecordView } from "@/components/PatientRecordModal";

export default function PatientPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  // En la web el id viene en la ruta; en la app, en la query (ver rutasApp).
  const [patientId, setPatientId] = useState<string | null>(null);

  useEffect(() => {
    getMe().then((data) => {
      if (!data) { router.push("/login"); return; }
      setPatientId(idDePaciente(params?.id, window.location.search));
    });
  }, [router, params?.id]);

  if (!patientId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ground">
        <p className="text-sm text-ink-muted">Cargando…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ground">
      <header className="sticky top-0 z-40 border-b border-line bg-surface">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-2 flex items-center gap-3">
          {/* Botón de volver, no una flecha suelta: el "←" pegado al texto se
              leía como parte del nombre de la sección. */}
          <Link href="/partners/dashboard"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-control border border-line bg-surface px-3 text-sm font-semibold text-brand-strong transition-colors hover:border-brand hover:text-brand focus-visible:outline-2 focus-visible:outline-brand sm:min-h-9">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}
              strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 shrink-0">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Volver
          </Link>
          <span className="text-line" aria-hidden>/</span>
          <span className="text-sm text-ink-muted">Ficha clínica</span>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5">
        <PatientRecordView patientId={patientId} variant="page" />
      </main>
    </div>
  );
}
