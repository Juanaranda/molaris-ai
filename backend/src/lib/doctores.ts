import { randomUUID } from "node:crypto";
import { isValidRut, formatRut } from "./rut";

/**
 * Lo que se puede decir de un profesional en una página pública.
 *
 * `GET /book/:slug` no pide sesión y devolvía `config.doctors` entero: el
 * WhatsApp y el correo personal de cada profesional quedaban a la vista de
 * cualquiera que abriera la página de reservas. Con el RUT en la ficha del
 * profesional, también se habría filtrado. Es una lista de campos PERMITIDOS a
 * propósito: lo que se agregue mañana al profesional queda privado por defecto.
 */
export type DoctorPublico = { name: string; specialty: string; schedule: string };

export function doctoresPublicos(doctors: unknown): DoctorPublico[] {
  if (!Array.isArray(doctors)) return [];
  return doctors
    // Sin nombre es una invitación pendiente (MOL-54): todavía no se muestra.
    .filter((d): d is Record<string, unknown> => !!d && typeof d === "object" && typeof (d as { name?: unknown }).name === "string" && !!(d as { name: string }).name.trim())
    .map((d) => ({
      name: String(d.name),
      specialty: typeof d.specialty === "string" ? d.specialty : "",
      schedule: typeof d.schedule === "string" && d.schedule.trim() ? d.schedule : horarioLegible(diasDelDoctor(d)),
    }));
}

// Día JS: 0 = domingo … 6 = sábado.
const ABREVIATURAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DIA_POR_ABREVIATURA: Record<string, number> = Object.fromEntries(ABREVIATURAS.map((a, i) => [a, i]));
const DIA_POR_CLAVE: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};

/** Formato de texto de los primeros profesionales: "Lun-Vie" o "Lun/Mié/Vie". */
export function diasDesdeHorario(schedule: string): number[] {
  if (schedule.includes("-")) {
    const [start, end] = schedule.split("-").map((s) => s.trim());
    const s = DIA_POR_ABREVIATURA[start];
    const e = DIA_POR_ABREVIATURA[end];
    if (s == null || e == null) return [];
    return Array.from({ length: e - s + 1 }, (_, i) => s + i);
  }
  return schedule.split("/").map((d) => DIA_POR_ABREVIATURA[d.trim()]).filter((d) => d != null);
}

/**
 * Días que atiende un profesional. El onboarding los guarda en `days`
 * (["monday", …]) y sin `schedule`; los profesionales sembrados a mano traen
 * solo `schedule`. Se lee `days` primero y, si no dice nada, el texto.
 */
export function diasDelDoctor(doc: { days?: unknown; schedule?: unknown }): number[] {
  if (Array.isArray(doc.days)) {
    const dias = doc.days
      .map((k) => (typeof k === "string" ? DIA_POR_CLAVE[k.trim().toLowerCase()] : undefined))
      .filter((d): d is number => d != null);
    if (dias.length > 0) return [...new Set(dias)].sort((a, b) => a - b);
  }
  return typeof doc.schedule === "string" ? diasDesdeHorario(doc.schedule) : [];
}

/** [1, 3, 5] → "Lun/Mié/Vie", con la semana partiendo el lunes. */
export function horarioLegible(dias: number[]): string {
  const desdeLunes = (d: number) => (d + 6) % 7;
  return [...new Set(dias)]
    .sort((a, b) => desdeLunes(a) - desdeLunes(b))
    .map((d) => ABREVIATURAS[d])
    .join("/");
}

/**
 * Revisa el RUT de cada profesional antes de guardar la configuración. Es
 * opcional, pero si viene tiene que ser válido; se guarda con formato
 * (12.345.678-5) para que se vea igual en todas partes.
 */
export function validarRutsDoctores(doctors: unknown[]):
  | { ok: true; doctors: unknown[] }
  | { ok: false; error: string } {
  const salida: unknown[] = [];
  for (const d of doctors) {
    if (!d || typeof d !== "object") { salida.push(d); continue; }
    const doc = d as Record<string, unknown>;
    const rut = typeof doc.rut === "string" ? doc.rut.trim() : "";
    if (!rut) {
      const { rut: _vacio, ...resto } = doc;
      void _vacio;
      salida.push(resto);
      continue;
    }
    if (!isValidRut(rut)) {
      const quien = typeof doc.name === "string" && doc.name.trim() ? ` de ${doc.name.trim()}` : "";
      return { ok: false, error: `El RUT${quien} no es válido. Revisa el dígito verificador.` };
    }
    salida.push({ ...doc, rut: formatRut(rut) });
  }
  return { ok: true, doctors: salida };
}

/* ── Profesionales invitados (MOL-54) ─────────────────────────────────────── */

type Obj = Record<string, unknown>;
const esObj = (d: unknown): d is Obj => !!d && typeof d === "object" && !Array.isArray(d);

/**
 * Los que el agente, la agenda y las reservas pueden usar: los que tienen
 * nombre. Un profesional sin nombre es una invitación pendiente: el admin lo
 * agregó sin datos y todavía no completa su perfil.
 */
export function doctoresActivos<T>(doctors: T[] | null | undefined): T[] {
  return (doctors ?? []).filter((d) => esObj(d) && typeof d.name === "string" && d.name.trim() !== "");
}

/** Datos que pone el propio profesional, no el admin de la clínica. */
export const CAMPOS_DEL_PROFESIONAL = ["rut", "phone", "userId"] as const;

/**
 * Al guardar la lista de profesionales desde el panel o el onboarding:
 *
 * - Cada profesional queda con un `id` estable (las invitaciones lo usan). Los
 *   guardados antes de existir el id se reconocen por su nombre.
 * - El RUT y el WhatsApp los pone el profesional: el admin no los cambia. De
 *   uno que ya existía se conservan los guardados; a uno nuevo no se le
 *   aceptan. `userId` (la cuenta unida) nunca se cambia por esta vía.
 * - Excepción: en una cuenta "solo" el admin ES el profesional, y quien edita
 *   su propio perfil (userId igual al suyo) también puede.
 */
export function protegerDatosDelProfesional(
  entrantes: unknown[],
  guardados: unknown[] | null | undefined,
  quien: { userId: string; esSolo: boolean },
  nuevoId: () => string = randomUUID,
): Obj[] {
  const previos = (guardados ?? []).filter(esObj);
  const usados = new Set<Obj>();
  return entrantes.filter(esObj).map((d) => {
    const idEntrante = typeof d.id === "string" && d.id ? d.id : undefined;
    const previo = idEntrante
      ? previos.find((p) => p.id === idEntrante)
      : previos.find((p) => !usados.has(p) && !p.id && typeof p.name === "string" && p.name.trim() !== "" && p.name === d.name);
    if (previo) usados.add(previo);

    const id = idEntrante ?? (typeof previo?.id === "string" && previo.id ? previo.id : nuevoId());
    const puedeDatosPersonales = quien.esSolo || (!!previo && previo.userId === quien.userId);
    const salida: Obj = { ...d, id };
    for (const campo of CAMPOS_DEL_PROFESIONAL) {
      if (campo !== "userId" && puedeDatosPersonales) continue;
      if (previo && previo[campo] !== undefined) salida[campo] = previo[campo];
      else delete salida[campo];
    }
    return salida;
  });
}
