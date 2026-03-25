export type PricingType = "fixed" | "variable";

export interface Service {
  name: string;
  pricingType: PricingType;
  price?: string;       // solo para servicios con precio fijo
  priceNote?: string;   // nota visible al paciente cuando es variable
}

export const galanaConfig = {
  id: "galana",
  name: "Galana Clínica Dental",
  location: "Santiago, Chile",
  phone: "+56 9 5678 9735",
  whatsapp: "56956789735",
  instagram: "@galanaclinicadental",
  schedule: {
    weekdays: "Lunes a Viernes: 10:00 - 18:00",
    saturday: "Sábado: 10:00 - 14:00",
    sunday: "Domingo: cerrado",
  },
  services: [
    {
      name: "Limpieza dental",
      pricingType: "fixed" as PricingType,
      price: "a consultar",
      priceNote: undefined,
    },
    {
      name: "Blanqueamiento dental",
      pricingType: "variable" as PricingType,
      priceNote: "El valor varía según el tipo de blanqueamiento y el caso de cada paciente.",
    },
    {
      name: "Ortodoncia (brackets / alineadores)",
      pricingType: "variable" as PricingType,
      priceNote: "El costo depende de la complejidad del caso y el tipo de aparato. Se evalúa en consulta.",
    },
    {
      name: "Carillas dentales",
      pricingType: "variable" as PricingType,
      priceNote: "El precio varía según el número de piezas y el material.",
    },
    {
      name: "Implantes dentales",
      pricingType: "variable" as PricingType,
      priceNote: "El costo depende del número de implantes y el estado del hueso. Se evalúa con radiografía.",
    },
    {
      name: "Urgencias dentales",
      pricingType: "fixed" as PricingType,
      price: "a consultar",
      priceNote: undefined,
    },
    {
      name: "Endodoncia (tratamiento de conducto)",
      pricingType: "variable" as PricingType,
      priceNote: "El valor depende del número de conductos del diente afectado.",
    },
    {
      name: "Extracción de muela del juicio",
      pricingType: "variable" as PricingType,
      priceNote: "El costo varía según la posición e impactación de la muela.",
    },
  ] as Service[],
  bookingUrl: process.env.GALANA_BOOKING_URL ?? null, // se configura cuando esté disponible (ej: Reservo)
  tone: "profesional pero cercano, lenguaje chileno natural",
};

export type ClinicConfig = typeof galanaConfig;
