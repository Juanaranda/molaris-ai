/**
 * Teléfonos con el código de país fijo.
 *
 * molari opera solo en Chile: el +56 va fijo al lado del campo y la persona
 * escribe solo sus 9 dígitos. Se guarda completo (+56912345678), que es lo que
 * necesitan WhatsApp y el backend. Si mañana se suma otro país, se agrega a
 * PAISES y el campo ofrece elegirlo; las pantallas no cambian.
 */

export type Pais = { codigo: string; nombre: string; prefijo: string; digitos: number };

export const PAISES: Pais[] = [
  { codigo: "CL", nombre: "Chile", prefijo: "56", digitos: 9 },
];

export const PAIS_POR_DEFECTO = PAISES[0];

/** De lo que haya guardado o pegado ("+56 9 1234 5678", "56912345678", "912345678") a los dígitos locales. */
export function digitosLocales(valor: string, pais: Pais = PAIS_POR_DEFECTO): string {
  let d = (valor ?? "").replace(/\D/g, "");
  if (d.startsWith(pais.prefijo) && d.length > pais.digitos) d = d.slice(pais.prefijo.length);
  return d.slice(0, pais.digitos);
}

/** Lo que se guarda: "+56912345678", o vacío si no hay número. */
export function telefonoCompleto(local: string, pais: Pais = PAIS_POR_DEFECTO): string {
  const d = digitosLocales(local, pais);
  return d ? `+${pais.prefijo}${d}` : "";
}

/** Cómo se ve mientras se escribe: "9 1234 5678" (celular) o "2 2345 6789" (fijo). */
export function formatearLocal(local: string): string {
  const d = local.replace(/\D/g, "");
  if (d.length <= 1) return d;
  if (d.length <= 5) return `${d[0]} ${d.slice(1)}`;
  return `${d[0]} ${d.slice(1, 5)} ${d.slice(5)}`;
}

/** ¿Está completo? (9 dígitos en Chile). */
export function telefonoCompletoValido(valor: string, pais: Pais = PAIS_POR_DEFECTO): boolean {
  return digitosLocales(valor, pais).length === pais.digitos;
}

/** Para mostrarlo (no editar): "+56 9 1234 5678". Si no es un número completo, lo deja como está. */
export function mostrarTelefono(valor: string | null | undefined, pais: Pais = PAIS_POR_DEFECTO): string {
  if (!valor) return "";
  const d = digitosLocales(valor, pais);
  return d.length === pais.digitos ? `+${pais.prefijo} ${formatearLocal(d)}` : valor;
}
