/**
 * Color de la portada de "Mi clínica" (config.portada).
 *
 * Es una de las portadas predefinidas o un color propio "#RRGGBB". Se valida
 * acá porque va a un style del panel: sin esto, cualquiera con un PATCH podría
 * guardar CSS arbitrario en la config de la clínica.
 *
 * La lista tiene que coincidir con frontend/lib/portada.ts.
 */
export const PORTADAS = ["petroleo", "coral", "bosque", "arena", "grafito", "noche"] as const;

const HEX = /^#[0-9a-fA-F]{6}$/;

export function validarPortada(valor: unknown):
  | { ok: true; valor: string | undefined }
  | { ok: false; error: string } {
  if (valor === undefined || valor === null || valor === "") return { ok: true, valor: undefined };
  if (typeof valor !== "string") return { ok: false, error: "El color de portada no es válido." };
  if ((PORTADAS as readonly string[]).includes(valor)) return { ok: true, valor };
  if (HEX.test(valor)) return { ok: true, valor: valor.toUpperCase() };
  return { ok: false, error: "El color de portada no es válido." };
}
