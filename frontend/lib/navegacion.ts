import type { Tab } from "@/components/dashboard/types";

/**
 * Las secciones del panel y cuáles van en la barra inferior del celular (MOL-46).
 *
 * En el celular, once pestañas en una fila obligaban a deslizar de lado para
 * encontrar Pacientes. Ahora las cuatro de todos los días van en una barra
 * inferior, como en cualquier app, y el resto queda en "Más". En escritorio se
 * muestran todas, como antes.
 *
 * Estas cuatro son las mismas en las dos direcciones visuales (A y B) que se
 * están evaluando: la decisión pendiente no las cambia.
 */
export interface Seccion {
  id: Tab;
  label: string;
  /** Nombre corto para la barra inferior (cabe en ~70px). */
  corto?: string;
}

export const PRINCIPALES: Tab[] = ["inicio", "agenda", "patients", "conversaciones"];

export function seccionesDelPanel({ rol, tipoCuenta }: {
  rol: string | undefined;
  tipoCuenta: string | undefined;
}): Seccion[] {
  const solo = tipoCuenta === "solo";
  return [
    { id: "inicio", label: "Inicio", corto: "Hoy" },
    { id: "conversaciones", label: "Conversaciones", corto: "Mensajes" },
    { id: "agenda", label: "Agenda" },
    { id: "analytics", label: "Analítica" },
    { id: "patients", label: "Pacientes" },
    { id: "bookings", label: "Citas" },
    { id: "perfil", label: "Mi Perfil" },
    // Modo solo (#69): un doctor independiente no tiene equipo ni inventario de clínica.
    ...(rol && rol !== "USER" && !solo ? [{ id: "equipo" as Tab, label: "Equipo" }] : []),
    ...(!solo ? [{ id: "inventario" as Tab, label: "Inventario" }] : []),
    { id: "clinica", label: solo ? "Mi consulta" : "Mi Clínica" },
    { id: "config", label: "Configuración" },
  ];
}

/** Separa las secciones entre la barra inferior (en su orden) y "Más". */
export function repartirParaCelular(secciones: Seccion[]): { barra: Seccion[]; mas: Seccion[] } {
  const barra = PRINCIPALES
    .map((id) => secciones.find((s) => s.id === id))
    .filter((s): s is Seccion => Boolean(s));
  const mas = secciones.filter((s) => !PRINCIPALES.includes(s.id));
  return { barra, mas };
}
