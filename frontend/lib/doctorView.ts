import { getToken, type AuthUser } from "./auth";
import { normalizar } from "./patients";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/**
 * Vista reducida del doctor (rol USER): qué pantalla le toca y qué citas ve.
 *
 * Vive acá y no en el componente porque la vista mostraba siempre la agenda
 * vacía sin que ningún test lo notara (MOL-33): pedía una ruta que no existe
 * (`/api/agenda/bookings?date=`) y leía `startTime`, un campo que la respuesta
 * no trae. Separado de la pantalla, el contrato con `GET /api/agenda` queda
 * probado con datos con la forma real.
 */

/** Lo que usa la vista de cada cita de `GET /api/agenda?date=YYYY-MM-DD`. */
export interface AgendaBooking {
  id: string;
  /** Fecha de la cita (DateTime ISO). */
  date: string;
  /** Hora de inicio, "HH:MM". */
  time: string;
  doctor: string;
  patientName: string | null;
  service: string | null;
  status: string;
  requestedVia: string | null;
}

/** Las citas de un día de la clínica. Lanza si el backend responde con error. */
export async function fetchAgendaDelDia(fecha: string, signal?: AbortSignal): Promise<AgendaBooking[]> {
  const res = await fetch(`${API}/api/agenda?date=${encodeURIComponent(fecha)}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
    signal,
  });
  if (!res.ok) throw new Error("No pudimos cargar la agenda");
  return (await res.json()) as AgendaBooking[];
}

/**
 * "YYYY-MM-DD" del día local. `toISOString()` da el día en UTC, y en Chile
 * desde las 20 o 21 h eso ya es mañana: el doctor vería la agenda de otro día.
 */
export function fechaLocal(d = new Date()): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Minutos desde medianoche de una hora "HH:MM" (o "H:MM"); null si no se entiende. */
export function minutosDeHora(hora: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hora.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * ¿La cita es de este doctor? Se compara por apellido porque la cita guarda
 * el nombre como texto libre ("Dr. Nicolás Rojas", "Nicolas Rojas"), y sin
 * tildes para que "Garces" y "Garcés" sean el mismo profesional.
 */
export function esCitaDelDoctor(cita: Pick<AgendaBooking, "doctor">, nombreDoctor: string): boolean {
  const apellido = normalizar(nombreDoctor).split(/\s+/).pop() ?? "";
  // Sin nombre no hay con qué comparar: mejor no mostrar nada que mostrarle
  // la agenda de toda la clínica.
  if (!apellido) return false;
  return normalizar(cita.doctor ?? "").includes(apellido);
}

/** Citas no canceladas del doctor, ordenadas por hora. */
export function citasActivasDelDoctor(citas: AgendaBooking[], nombreDoctor: string): AgendaBooking[] {
  return citas
    .filter((c) => c.status !== "cancelled" && esCitaDelDoctor(c, nombreDoctor))
    .sort((a, b) => (minutosDeHora(a.time) ?? 0) - (minutosDeHora(b.time) ?? 0));
}

/** La primera cita que todavía no empieza. Supone citas de hoy, ya ordenadas. */
export function proximaCita(citas: AgendaBooking[], ahora = new Date()): AgendaBooking | undefined {
  const minsAhora = ahora.getHours() * 60 + ahora.getMinutes();
  return citas.find((c) => {
    const mins = minutosDeHora(c.time);
    return mins !== null && mins > minsAhora;
  });
}

export type VistaPanel = "cargando" | "doctor" | "completo";

/**
 * Qué pantalla del panel mostrar, y si hay que obligar a cambiar la contraseña
 * temporal. El cambio de contraseña se decide aparte de la vista a propósito:
 * antes se evaluaba después de elegir la vista del doctor, y un doctor con
 * contraseña temporal entraba sin cambiarla.
 */
export function vistaDelPanel(opts: {
  loading: boolean;
  user: Pick<AuthUser, "role" | "mustChangePassword"> | null;
  tieneClinica: boolean;
  forzarPanelCompleto: boolean;
}): { vista: VistaPanel; pedirCambioDeContrasena: boolean } {
  const { loading, user, tieneClinica, forzarPanelCompleto } = opts;
  if (loading) return { vista: "cargando", pedirCambioDeContrasena: false };
  const pedirCambioDeContrasena = Boolean(user?.mustChangePassword);
  const vista: VistaPanel =
    user?.role === "USER" && tieneClinica && !forzarPanelCompleto ? "doctor" : "completo";
  return { vista, pedirCambioDeContrasena };
}
