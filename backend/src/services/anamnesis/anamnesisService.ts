/**
 * Anamnesis estructurada y versionada — Issue #35.
 *
 * Cada clínica tiene un template "activo" (versión más alta).
 * Las respuestas guardan la versión con la que fueron contestadas para
 * auditoría médico-legal (Ley 20.584).
 */

import prisma from "../../config/prisma";
import type { Prisma } from "@prisma/client";

export type AnamnesisQuestionType = "boolean" | "text" | "number" | "multiselect";
export type AnamnesisSection = "medical" | "allergies" | "medications" | "lifestyle" | "dental";

export interface AnamnesisQuestion {
  code:     string;
  label:    string;
  type:     AnamnesisQuestionType;
  section:  AnamnesisSection;
  redFlag?: boolean;
  options?: string[]; // para multiselect
}

/**
 * Template estándar v1 — basado en discovery #12 con el dentista.
 * Banderas rojas críticas en odontología (Ley 20.584 — defensa médico-legal):
 *   - Alergias: anestésicos, penicilina, látex, AINEs
 *   - Medicamentos: anticoagulantes, bifosfonatos
 *   - Condiciones: diabetes, hipertensión, cardiopatías, coagulación, embarazo
 */
export const STANDARD_QUESTIONS_V1: AnamnesisQuestion[] = [
  // ── Médicos ──
  { code: "diabetes",          label: "¿Tiene diabetes?",                             type: "boolean", section: "medical", redFlag: true },
  { code: "hypertension",      label: "¿Tiene hipertensión arterial?",                type: "boolean", section: "medical", redFlag: true },
  { code: "cardiopathy",       label: "¿Tiene alguna cardiopatía?",                   type: "boolean", section: "medical", redFlag: true },
  { code: "coagulation",       label: "¿Tiene problemas de coagulación?",             type: "boolean", section: "medical", redFlag: true },
  { code: "pregnancy",         label: "¿Embarazo o lactancia actualmente?",           type: "boolean", section: "medical", redFlag: true },
  { code: "pacemaker",         label: "¿Tiene marcapasos?",                           type: "boolean", section: "medical", redFlag: true },
  { code: "other_conditions",  label: "¿Otras enfermedades sistémicas relevantes?",   type: "text",    section: "medical" },

  // ── Alergias críticas ──
  { code: "allergy_anesthetic", label: "¿Alergia a anestésicos locales?",             type: "boolean", section: "allergies", redFlag: true },
  { code: "allergy_penicillin", label: "¿Alergia a penicilina u otros antibióticos?", type: "boolean", section: "allergies", redFlag: true },
  { code: "allergy_latex",      label: "¿Alergia al látex?",                          type: "boolean", section: "allergies", redFlag: true },
  { code: "allergy_aines",      label: "¿Alergia a AINEs (ibuprofeno, etc.)?",        type: "boolean", section: "allergies", redFlag: true },
  { code: "allergy_other",      label: "Otras alergias",                              type: "text",    section: "allergies" },

  // ── Medicamentos (banderas rojas en odonto) ──
  { code: "anticoagulants",     label: "¿Toma anticoagulantes (warfarina, rivaroxabán, etc.)?", type: "boolean", section: "medications", redFlag: true },
  { code: "bisphosphonates",    label: "¿Toma bifosfonatos (alendronato, zoledronato, etc.)?", type: "boolean", section: "medications", redFlag: true },
  { code: "medications_other",  label: "Otros medicamentos actuales",                          type: "text",    section: "medications" },

  // ── Hábitos ──
  { code: "smoking",            label: "¿Fuma?",                                      type: "boolean", section: "lifestyle" },
  { code: "bruxism",            label: "¿Sufre de bruxismo (rechina los dientes)?",   type: "boolean", section: "lifestyle" },

  // ── Antecedentes odontológicos ──
  { code: "previous_experiences", label: "Experiencias odontológicas previas relevantes", type: "text",    section: "dental" },
  { code: "dental_anxiety",       label: "¿Ansiedad o miedo dental?",                    type: "boolean", section: "dental" },
  { code: "last_visit",           label: "¿Cuándo fue su última visita al dentista?",    type: "text",    section: "dental" },
];

/**
 * Devuelve el template activo de la clínica. Si no hay ninguno, crea v1 estándar.
 */
export async function ensureActiveTemplate(clinicId: string) {
  const active = await prisma.anamnesisTemplate.findFirst({
    where: { clinicId, active: true },
    orderBy: { version: "desc" },
  });
  if (active) return active;

  return prisma.anamnesisTemplate.create({
    data: {
      clinicId,
      version:   1,
      questions: STANDARD_QUESTIONS_V1 as unknown as Prisma.InputJsonValue,
      active:    true,
    },
  });
}

/**
 * Calcula qué red flags se activaron a partir de las respuestas.
 * Una pregunta con redFlag=true cuyo answer es truthy → entra al array.
 */
export function computeRedFlags(
  questions: AnamnesisQuestion[],
  answers: Record<string, unknown>,
): string[] {
  const flags: string[] = [];
  for (const q of questions) {
    if (!q.redFlag) continue;
    const v = answers[q.code];
    if (v === true || (typeof v === "string" && v.trim() !== "") || (typeof v === "number" && v > 0)) {
      flags.push(q.code);
    }
  }
  return flags;
}

/**
 * Convierte códigos de red flags a labels humanos para mostrar en alertas.
 */
export function redFlagsToAlerts(
  questions: AnamnesisQuestion[],
  redFlagCodes: string[],
): string[] {
  const byCode = new Map(questions.map((q) => [q.code, q]));
  const out: string[] = [];
  for (const code of redFlagCodes) {
    const q = byCode.get(code);
    if (!q) continue;
    const icon = q.section === "allergies"   ? "⚠️"
              : q.section === "medications" ? "💊"
              : q.section === "medical"     ? "🩺"
              : "•";
    out.push(`${icon} ${q.label.replace(/^¿/, "").replace(/\?$/, "")}`);
  }
  return out;
}
