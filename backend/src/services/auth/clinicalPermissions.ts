/**
 * Permisos clínicos granulares — Issue #32.
 *
 * Matriz de permisos por clinicalRole (cuando es null, se usa el role base):
 *
 *                   | Read ficha | Notas | Eventos | Anamnesis | Consents | Equipo |
 *   HYGIENIST       |    ✓       |   —   |  Solo   |    R      |    R     |   —    |
 *                   |            |       | limpieza|           |          |        |
 *   GENERAL_DENTIST |    ✓       |   ✓   |    ✓    |    ✓      |    ✓     |   —    |
 *   SPECIALIST      |    ✓       |   ✓   |    ✓    |    ✓      |    ✓     |   —    |
 *   CLINIC_ADMIN    |    ✓       |   ✓   |    ✓    |    ✓      |    ✓     |   ✓    |
 *   RECEPTION       |    —       |   —   |    —    |    —      |    —     |   —    |
 *   (null)          |  fallback al permiso del PartnerRole (USER/ADMIN/SUPERADMIN) |
 */

import type { ClinicalRole, PartnerRole } from "@prisma/client";

export type ClinicalAction =
  | "read_clinical"      // ver ficha clínica, anamnesis, eventos
  | "write_clinical"     // crear notas, eventos, anamnesis, consents
  | "limpieza_only"      // higienista: solo crea eventos de tipo "limpieza"/"sellante"
  | "manage_team";

/**
 * Resuelve si el usuario tiene permiso para una acción clínica.
 * Si clinicalRole es null, cae al PartnerRole (compat hacia atrás).
 */
export function canPerform(
  role: PartnerRole,
  clinicalRole: ClinicalRole | null,
  action: ClinicalAction,
): boolean {
  // SUPERADMIN siempre puede todo
  if (role === "SUPERADMIN") return true;

  // Si tiene clinicalRole asignado, usa la matriz granular
  if (clinicalRole) {
    switch (action) {
      case "read_clinical":
        return clinicalRole !== "RECEPTION";
      case "write_clinical":
        return clinicalRole === "GENERAL_DENTIST"
            || clinicalRole === "SPECIALIST"
            || clinicalRole === "CLINIC_ADMIN";
      case "limpieza_only":
        // Higienistas SÍ pueden crear eventos limitados; los demás clínicos también pueden
        return clinicalRole !== "RECEPTION";
      case "manage_team":
        return clinicalRole === "CLINIC_ADMIN";
    }
  }

  // Fallback al role base (sin clinicalRole asignado)
  switch (action) {
    case "read_clinical":
    case "write_clinical":
    case "limpieza_only":
      return role !== "USER" || true; // USER también podía antes — preservamos
    case "manage_team":
      return role === "ADMIN";
  }
}

/**
 * Limita los conditionCode que un higienista puede registrar.
 * Otros roles pueden registrar cualquier código del catálogo.
 */
const HYGIENIST_ALLOWED_CODES = new Set(["limpieza", "sellante", "obturacion", "sano"]);

export function isAllowedConditionFor(
  clinicalRole: ClinicalRole | null,
  conditionCode: string,
): boolean {
  if (!clinicalRole) return true; // backwards compat
  if (clinicalRole === "RECEPTION") return false;
  if (clinicalRole === "HYGIENIST") return HYGIENIST_ALLOWED_CODES.has(conditionCode);
  return true;
}

export const CLINICAL_ROLE_LABELS: Record<ClinicalRole, string> = {
  HYGIENIST:       "Higienista",
  GENERAL_DENTIST: "Odontólogo general",
  SPECIALIST:      "Especialista",
  CLINIC_ADMIN:    "Admin clínico",
  RECEPTION:       "Recepción / Admin no-clínico",
};
