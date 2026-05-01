/**
 * TEMPLATE DE CONFIGURACIÓN — molari.ai
 *
 * Copia este archivo, renómbralo con el slug de la clínica (ej: clinica-norte.ts)
 * y rellena cada campo. Luego agrégalo al seed de Prisma con /add-clinic.
 *
 * MODOS DE BOXES:
 *   A) Sin boxes:        boxes: []          → el picker no muestra box
 *   B) Pool compartido:  boxes: ["Box 1"]   → todos los doctores sin box asignado rotan aquí
 *   C) Box por doctor:   doctor.box = "Box 2" → ese doctor siempre usa ese box
 *   D) Mixto (Galana):   especialistas con box fijo + pool para generales
 */

import type { Doctor, Service } from "./galana"; // reutilizar tipos

export const templateConfig = {
  id: "slug-clinica",          // único, sin espacios ni tildes
  name: "Nombre Clínica Dental",
  location: "Ciudad, País",
  phone: "+569XXXXXXXX",
  whatsapp: "569XXXXXXXX",     // sin + ni espacios
  instagram: "@handle",

  schedule: {
    weekdays: "Lunes a Viernes: HH:MM - HH:MM",
    saturday: "Sábado: HH:MM - HH:MM",   // o "cerrado"
    sunday:   "Domingo: cerrado",
  },

  slotDurationMin: 45,         // duración de cada cita en minutos

  // ── BOXES ──────────────────────────────────────────────────────────
  // [] = sin sistema de boxes
  // ["Box 1", "Box 2"] = pool compartido
  boxes: ["Box 1", "Box 2"],

  // ── DOCTORES ───────────────────────────────────────────────────────
  doctors: [
    {
      name: "Dr. Nombre Apellido",
      specialty: "Odontología General",
      // workDays: 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb
      workDays: [1, 2, 3, 4, 5],
      box: null,               // null = usa el pool; "Box 1" = box fijo
      services: [
        "Limpieza dental",
        "Urgencias dentales",
      ],
    },
    {
      name: "Dra. Nombre Apellido",
      specialty: "Ortodoncia",
      workDays: [1, 3, 5],
      box: "Box 2",
      services: [
        "Ortodoncia (brackets / alineadores)",
      ],
    },
  ] as Doctor[],

  // ── SERVICIOS ──────────────────────────────────────────────────────
  services: [
    {
      name: "Limpieza dental",
      pricingType: "fixed" as const,
      price: "a consultar",
    },
    {
      name: "Ortodoncia (brackets / alineadores)",
      pricingType: "variable" as const,
      priceNote: "El valor varía según complejidad del caso.",
    },
    // Agregar más servicios según la clínica...
  ] as Service[],

  // ── AGENDAMIENTO ───────────────────────────────────────────────────
  bookingUrl: process.env.CLINIC_BOOKING_URL ?? null, // URL de Reservo u otro sistema

  // ── TONO DEL AGENTE ────────────────────────────────────────────────
  // Define la personalidad del chatbot para esta clínica
  tone: "profesional y cercano, lenguaje chileno natural",
};

export type ClinicConfig = typeof templateConfig;
