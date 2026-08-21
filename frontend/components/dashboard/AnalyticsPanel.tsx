"use client";

import { useState } from "react";
import type { ClinicData } from "@/lib/auth";
import { SetupChecklist } from "@/components/SetupChecklist";
import type { Analytics } from "./types";
import { AnaliticaResumen } from "./analytics/Resumen";
import { AnaliticaDoctores } from "./analytics/Doctores";
import { AnaliticaPacientes } from "./analytics/Pacientes";
import { AnaliticaServicios } from "./analytics/Servicios";
import { AnaliticaOperaciones } from "./analytics/Operaciones";

/**
 * Panel de analítica del dashboard. Eran ~550 líneas dentro de page.tsx, más
 * de un tercio del archivo, y no las comparte nadie: tiene sus propias
 * sub-pestañas y su propio estado.
 */
type AnalyticsSub = "resumen" | "doctores" | "pacientes" | "servicios" | "operaciones";

export function AnalyticsPanel({ clinic, analytics, loading, onGoToConfig, onRetry }: {
  clinic: ClinicData;
  analytics: Analytics | null;
  loading: boolean;
  onGoToConfig: () => void;
  onRetry: () => void;
}) {
  const [sub, setSub]                 = useState<AnalyticsSub>("resumen");
  return (
    <div className="flex flex-col gap-5">
      <SetupChecklist clinic={clinic} onGoToConfig={onGoToConfig} />

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && !analytics && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center text-sm text-gray-400">
          No se pudieron cargar los datos.{" "}
          <button onClick={onRetry} className="text-blue-600 hover:underline">Reintentar</button>
        </div>
      )}

      {!loading && analytics && (
        <>
          {/* Sub-tabs */}
          <div className="flex gap-1 overflow-x-auto">
            {([
              ["resumen",     "Resumen"],
              ["doctores",    "Doctores"],
              ["pacientes",   "Pacientes"],
              ["servicios",   "Servicios"],
              ["operaciones", "Operaciones"],
            ] as [AnalyticsSub, string][]).map(([key, label]) => (
              <button key={key} onClick={() => setSub(key)}
                className={`px-4 py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition ${
                  sub === key ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-500 hover:border-gray-300"
                }`}>
                {label}
              </button>
            ))}
          </div>

          {sub === "resumen"     && <AnaliticaResumen     analytics={analytics} />}
          {sub === "doctores"    && <AnaliticaDoctores    analytics={analytics} />}
          {sub === "pacientes"   && <AnaliticaPacientes   analytics={analytics} clinic={clinic} />}
          {sub === "servicios"   && <AnaliticaServicios   analytics={analytics} />}
          {sub === "operaciones" && <AnaliticaOperaciones analytics={analytics} />}
        </>
      )}
    </div>
  );
}

