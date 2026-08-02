/**
 * Normalización de nombres de profesionales.
 *
 * Las citas guardan el nombre del doctor como texto libre, y con el tiempo el
 * mismo profesional termina escrito de varias formas: "Nicolas Rojas",
 * "Dr. Nicolás Rojas". Como la agenda y los filtros de pacientes comparan por
 * igualdad exacta contra el equipo configurado, cada variante queda invisible
 * para el filtro del otro — el doctor filtra por su nombre y le faltan citas
 * suyas, sin ningún error a la vista.
 *
 * La clave normalizada solo sirve para COMPARAR. Lo que se guarda y se muestra
 * es la forma canónica: la que la clínica tiene en su equipo.
 */

/** Clave de comparación: sin tratamiento, sin tildes, sin dobles espacios. */
export function normalizeDoctorName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")   // quita tildes
    .replace(/^\s*(dra?|dr)\.?\s+/i, "") // quita "Dr." / "Dra."
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Devuelve la forma con que la clínica escribe a ese profesional en su equipo.
 * Si no está en el equipo (ej. alguien que ya no atiende pero tiene historial),
 * se respeta el nombre tal cual vino: inventarle un tratamiento sería peor.
 */
export function canonicalDoctorName(name: string, equipo: string[]): string {
  if (!name) return name;
  const key = normalizeDoctorName(name);
  const match = equipo.find((d) => normalizeDoctorName(d) === key);
  return match ?? name;
}
