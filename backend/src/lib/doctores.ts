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
    .filter((d): d is Record<string, unknown> => !!d && typeof d === "object" && typeof (d as { name?: unknown }).name === "string")
    .map((d) => ({
      name: String(d.name),
      specialty: typeof d.specialty === "string" ? d.specialty : "",
      schedule: typeof d.schedule === "string" ? d.schedule : "",
    }));
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
