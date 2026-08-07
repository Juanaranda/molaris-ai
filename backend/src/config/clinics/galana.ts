export type PricingType = "fixed" | "variable";

export interface Service {
  name: string;
  pricingType: PricingType;
  price?: string;
  priceNote?: string;
}

export interface Doctor {
  name: string;
  specialty: string;
  services: string[];       // nombres de servicios que atiende
  workDays: number[];       // días que trabaja: 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb
  box?: string | null;      // box asignado (null = sin asignación fija, usa pool de la clínica)
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
      name: "Resina / tapadura",
      pricingType: "fixed" as PricingType,
      price: "$25.000 - $60.000",
      priceNote: "El precio varía según el tamaño y ubicación de la caries.",
    },
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
  bookingUrl: process.env.GALANA_BOOKING_URL ?? null,
  slotDurationMin: 45,
  // Equipo real de Galana, confirmado por la clínica (jul 2026). Los nombres y
  // especialidades vienen de la clínica; los workDays son un supuesto inicial
  // — la clínica los ajusta desde el editor de equipo.
  // El prefijo va "Dr." parejo para no deducir el género desde el nombre.
  // Cuando la clínica confirme quién lleva "Dra.", se corrige acá.
  doctors: [
    {
      name: "Dr. Ivonne Poblete",
      specialty: "Odontología General",
      workDays: [1, 3, 5, 6], // Lun, Mié, Vie, Sáb
      box: null,
      services: [
        "Resina / tapadura",
        "Limpieza dental",
        "Blanqueamiento dental",
        "Urgencias dentales",
      ],
    },
    {
      name: "Dr. Juan Garcés",
      specialty: "Endodoncia",
      workDays: [2, 4], // Mar, Jue
      box: null,
      services: [
        "Endodoncia (tratamiento de conducto)",
        "Urgencias dentales",
      ],
    },
    {
      name: "Dr. Javiera Paimilla",
      specialty: "Odontología General",
      workDays: [1, 2, 3, 4, 5], // Lun-Vie
      box: null,
      services: [
        "Resina / tapadura",
        "Limpieza dental",
        "Blanqueamiento dental",
        "Carillas dentales",
        "Urgencias dentales",
      ],
    },
    {
      name: "Dr. Nicolás Rojas",
      specialty: "Odontología General",
      workDays: [1, 2, 3, 4, 5], // Lun-Vie
      box: null,
      services: [
        "Resina / tapadura",
        "Limpieza dental",
        "Extracción de muela del juicio",
        "Urgencias dentales",
      ],
    },
    {
      name: "Dr. Yamileth Zerpa",
      specialty: "Ortodoncia",
      workDays: [1, 3, 5], // Lun, Mié, Vie
      box: null,
      services: [
        "Ortodoncia (brackets / alineadores)",
      ],
    },
  ] as Doctor[],
  // Galana tiene 2 boxes. Todos los doctores rotan — ninguno tiene box fijo.
  boxes: ["Box 1", "Box 2"],
  tone: "profesional pero cercano, lenguaje chileno natural",
};

export type ClinicConfig = typeof galanaConfig;
