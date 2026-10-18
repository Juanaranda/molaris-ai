/**
 * Un teléfono en formato internacional (E.164, "+56912345678"), o null si no
 * se puede leer como uno.
 *
 * Acepta como lo escribe una persona en Chile: "9 1234 5678", "+56 9 1234
 * 5678", "56912345678", "(+56) 912345678". Un número de 9 dígitos que empieza
 * con 9 es un celular chileno sin prefijo. Uno que ya trae "+" y otro código
 * de país se respeta tal cual (8 a 15 dígitos).
 */
export function telefonoE164(crudo: string | null | undefined): string | null {
  if (!crudo) return null;
  const conMas = crudo.trim().startsWith("+");
  const digitos = crudo.replace(/\D/g, "");
  if (!digitos) return null;

  if (digitos.length === 9 && digitos.startsWith("9")) return `+56${digitos}`;
  if (digitos.length === 11 && digitos.startsWith("569")) return `+${digitos}`;
  if (conMas && digitos.length >= 8 && digitos.length <= 15 && !digitos.startsWith("56")) return `+${digitos}`;
  return null;
}
