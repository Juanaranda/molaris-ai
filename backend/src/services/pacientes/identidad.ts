/**
 * La Identity de un paciente (RUT, nombre, contacto) es una sola para todas
 * las clínicas que lo atienden. Mientras no esté decidido quién puede editarla
 * (MOL-37, arista de Ley 21.719 que va al abogado), una clínica solo la cambia
 * si nadie más la usa: si no, editaría datos que ve otra clínica.
 *
 * Es una mitigación reversible, como la de MOL-17: no decide el modelo, solo
 * evita el daño mientras se decide.
 */

type Db = {
  patient:     { count: (args: { where: { identityId: string; clinicId: { not: string } } }) => Promise<number> };
  patientUser: { count: (args: { where: { identityId: string; clinicId: { not: string } } }) => Promise<number> };
};

/** ¿Otra clínica tiene a esta persona como paciente o con cuenta en su portal? */
export async function otraClinicaUsaIdentidad(db: Db, identityId: string, clinicId: string): Promise<boolean> {
  const where = { identityId, clinicId: { not: clinicId } };
  const [pacientes, cuentas] = await Promise.all([db.patient.count({ where }), db.patientUser.count({ where })]);
  return pacientes + cuentas > 0;
}

export const ERROR_IDENTIDAD_COMPARTIDA =
  "Esta persona también se atiende en otra clínica de molari, que ve estos mismos datos. " +
  "Por ahora no se pueden cambiar desde aquí; escríbenos y lo revisamos.";

/** Para comparar nombres: sin tildes, mayúsculas ni dobles espacios. */
const nombreComparable = (n: string | null | undefined) =>
  (n ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Entre las fichas que comparten un teléfono, cuál es la de esta persona
 * (MOL-60). Un teléfono no identifica a alguien: una mamá agenda a sus hijos
 * con el suyo. Por eso, si se sabe el nombre, tiene que calzar; y si calzan
 * dos, no se adivina ("ambigua"): abrir la ficha de otro paciente y escribir
 * en ella es peor que no abrir ninguna.
 */
export function elegirFicha<T extends { name: string | null }>(
  candidatas: T[], nombre: string | null | undefined,
): T | "ambigua" | null {
  const buscado = nombreComparable(nombre);
  const calzan = buscado ? candidatas.filter((c) => nombreComparable(c.name) === buscado) : candidatas;
  if (calzan.length === 1) return calzan[0];
  return calzan.length > 1 ? "ambigua" : null;
}
