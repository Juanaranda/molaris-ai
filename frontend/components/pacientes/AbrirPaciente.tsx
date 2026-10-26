"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { getToken } from "@/lib/auth";
import { cx } from "@/lib/cx";
import { PatientDetail } from "./DetallePaciente";
import type { Patient } from "./formato";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/** Lo que trae una cita o una fila sobre su paciente. */
export type RefPaciente = {
  name: string | null;
  rut: string | null;
  phone?: string | null;
  email?: string | null;
};

/**
 * El paciente tal como se sabe desde la cita. Se usa si el backend no lo
 * encuentra (por ejemplo, si todas sus citas están canceladas): el detalle
 * abre igual, con lo que hay.
 */
export function pacienteDesdeCita(ref: RefPaciente): Patient {
  return {
    key: ref.rut ?? (ref.name ?? "").toLowerCase().trim(),
    name: ref.name ?? "Paciente", rut: ref.rut, phone: ref.phone ?? null, email: ref.email ?? null,
    visits: 0, lastVisit: new Date().toISOString(), lastDoctor: "", services: [],
    totalCharged: 0, totalPaid: 0, pendingCount: 0,
  };
}

const AbrirPacienteCtx = createContext<((ref: RefPaciente) => void) | null>(null);

/**
 * Abre el detalle del paciente (agendar, ficha clínica, cuenta, planes,
 * presupuestos) desde cualquier pantalla del panel. Los doctores llegan a sus
 * pacientes por la agenda, no buscándolos por nombre o RUT.
 *
 * Devuelve null fuera del panel: ahí no se ofrece el botón.
 */
export function useAbrirPaciente() {
  return useContext(AbrirPacienteCtx);
}

/**
 * Una fila (cita del día, próxima cita…) que al tocarla abre al paciente.
 * Sin proveedor o sin nombre queda como fila normal.
 */
export function FilaPaciente({ paciente, className, children }: {
  paciente: RefPaciente; className?: string; children: ReactNode;
}) {
  const abrir = useAbrirPaciente();
  if (!abrir || !paciente.name) return <div className={className}>{children}</div>;
  return (
    <button type="button" onClick={() => abrir(paciente)}
      className={cx(className, "w-full rounded-control text-left transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-brand")}>
      {children}
    </button>
  );
}

export function ProveedorPaciente({ children }: { children: ReactNode }) {
  const [abierto, setAbierto] = useState<Patient | null>(null);

  const abrir = useCallback(async (ref: RefPaciente) => {
    if (!ref.rut && !ref.name) return;
    try {
      const res = await fetch(`${API}/api/patients/uno`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(ref.rut ? { rut: ref.rut } : { nombre: ref.name }),
      });
      setAbierto(res.ok ? await res.json() : pacienteDesdeCita(ref));
    } catch {
      setAbierto(pacienteDesdeCita(ref));
    }
  }, []);

  return (
    <AbrirPacienteCtx.Provider value={abrir}>
      {children}
      {abierto && <PatientDetail key={abierto.key} patient={abierto} onClose={() => setAbierto(null)} />}
    </AbrirPacienteCtx.Provider>
  );
}
