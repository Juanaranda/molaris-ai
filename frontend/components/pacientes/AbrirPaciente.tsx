"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getMe, getToken } from "@/lib/auth";
import { ensurePatientId } from "@/lib/clinicalRecord";
import { cx } from "@/lib/cx";
import { rutaPaciente } from "@/lib/rutasApp";
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
 * El nombre del paciente como enlace que abre su detalle. Sin proveedor, o
 * sin nada con qué encontrarlo, queda como texto.
 */
export function NombrePaciente({ paciente, className, children }: {
  paciente: RefPaciente; className?: string; children?: ReactNode;
}) {
  const abrir = useAbrirPaciente();
  const texto = children ?? paciente.name ?? paciente.phone ?? "Paciente";
  if (!abrir || (!paciente.name && !paciente.rut && !paciente.phone)) return <span className={className}>{texto}</span>;
  return (
    <button type="button" onClick={() => abrir(paciente)}
      className={cx(className, "text-left underline-offset-2 hover:text-brand hover:underline focus-visible:outline-2 focus-visible:outline-brand")}>
      {texto}
    </button>
  );
}

/**
 * Abre directo la ficha clínica, sin pasar por el detalle: es lo que busca el
 * doctor cuando el paciente está en el box. La ficha necesita RUT o teléfono.
 */
export function useAbrirFicha() {
  const router = useRouter();
  const [abriendo, setAbriendo] = useState(false);
  const [error, setError] = useState("");
  const abrir = useCallback(async (ref: RefPaciente) => {
    setAbriendo(true); setError("");
    try {
      const me = await getMe();
      if (!me?.clinic?.id) throw new Error("Sin clínica activa");
      const id = await ensurePatientId(me.clinic.id, { rut: ref.rut ?? undefined, phone: ref.phone ?? undefined });
      router.push(rutaPaciente(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos abrir la ficha");
      setAbriendo(false);
    }
  }, [router]);
  return { abrir, abriendo, error, puede: (ref: RefPaciente) => Boolean(ref.rut || ref.phone) };
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
    if (!ref.rut && !ref.name && !ref.phone) return;
    try {
      const res = await fetch(`${API}/api/patients/uno`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        // Sin RUT, el backend lo busca por nombre o teléfono, y solo si calza
        // con una sola persona.
        body: JSON.stringify(ref.rut ? { rut: ref.rut } : { nombre: ref.name ?? undefined, telefono: ref.phone ?? undefined }),
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
