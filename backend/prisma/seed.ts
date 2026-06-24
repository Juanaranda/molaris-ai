import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const galanaConfig = {
  tone: "profesional pero cercano, lenguaje chileno natural",
  assistantName: "Anita",
  schedule: {
    weekdays: "Lunes a Viernes: 10:00 - 18:00",
    saturday: "Sábado: 10:00 - 14:00",
    sunday: "Domingo: cerrado",
  },
  doctors: [
    {
      name: "Dra. Ana Aranda",
      specialty: "General",
      schedule: "Lun-Vie",
      services: ["Limpieza dental", "Urgencias dentales", "Consulta general"],
    },
    {
      name: "Dra. Ivonne Poblete",
      specialty: "General",
      schedule: "Lun/Mié/Vie/Sáb",
      services: ["Limpieza dental", "Blanqueamiento dental", "Carillas dentales"],
    },
    {
      name: "Dr. Pedro Engel",
      specialty: "General",
      schedule: "Mar/Jue/Sáb",
      services: ["Limpieza dental", "Extracción de muela del juicio", "Urgencias dentales"],
    },
    {
      name: "Dr. Juan Garcés",
      specialty: "Endodoncia",
      schedule: "Mar/Jue",
      services: ["Endodoncia (tratamiento de conducto)"],
    },
    {
      name: "Dra. Jacqueline Pérez",
      specialty: "Ortodoncia",
      schedule: "Lun/Mié/Vie",
      services: ["Ortodoncia (brackets / alineadores)"],
    },
  ],
  boxes: 2,
  services: [
    { name: "Limpieza dental",                    pricingType: "fixed",    price: "$25.000 - $40.000" },
    { name: "Blanqueamiento dental",               pricingType: "variable", priceNote: "Varía según tipo y caso del paciente." },
    { name: "Ortodoncia (brackets / alineadores)", pricingType: "variable", priceNote: "Depende de la complejidad. Se evalúa en consulta." },
    { name: "Carillas dentales",                   pricingType: "variable", priceNote: "Varía según número de piezas y material." },
    { name: "Implantes dentales",                  pricingType: "variable", priceNote: "Depende del número de implantes y estado del hueso." },
    { name: "Urgencias dentales",                  pricingType: "fixed",    price: "$35.000" },
    { name: "Endodoncia (tratamiento de conducto)",pricingType: "variable", priceNote: "Varía según número de conductos." },
    { name: "Extracción de muela del juicio",      pricingType: "variable", priceNote: "Varía según posición e impactación." },
  ],
};

async function main() {
  // ─── Clínica Galana ──────────────────────────────────────────────────────────
  const galana = await prisma.clinic.upsert({
    where: { slug: "galana" },
    update: { config: galanaConfig },
    create: {
      slug: "galana",
      name: "Galana Clínica Dental",
      phone: "+56 9 5678 9735",
      whatsapp: "56956789735",
      instagram: "@galanaclinicadental",
      location: "Santiago, Chile",
      plan: "starter",
      config: galanaConfig,
    },
  });

  console.log(`✅ Clínica creada/actualizada: ${galana.name} (API key: ${galana.apiKey})`);

  // ─── Usuarios partner ────────────────────────────────────────────────────────
  const SALT_ROUNDS = 12;

  const superAdmin = await prisma.partnerUser.upsert({
    where: { email: "superadmin@molari.ai" },
    update: {},
    create: {
      name: "Super Admin",
      email: "superadmin@molari.ai",
      passwordHash: await bcrypt.hash("molari2024!", SALT_ROUNDS),
      role: "SUPERADMIN",
    },
  });
  console.log(`✅ Usuario: ${superAdmin.email} (${superAdmin.role})`);

  const adminGalana = await prisma.partnerUser.upsert({
    where: { email: "admin@galana.cl" },
    update: {},
    create: {
      name: "Admin Galana",
      email: "admin@galana.cl",
      passwordHash: await bcrypt.hash("galana2024!", SALT_ROUNDS),
      role: "ADMIN",
      clinicId: galana.id,
    },
  });
  console.log(`✅ Usuario: ${adminGalana.email} (${adminGalana.role})`);

  const recepcion = await prisma.partnerUser.upsert({
    where: { email: "recepcion@galana.cl" },
    update: {},
    create: {
      name: "Recepción Galana",
      email: "recepcion@galana.cl",
      passwordHash: await bcrypt.hash("galana2024!", SALT_ROUNDS),
      role: "USER",
      clinicId: galana.id,
    },
  });
  console.log(`✅ Usuario: ${recepcion.email} (${recepcion.role})`);

  // ─── Base legal de tratamiento de datos (Issue #38, Ley 21.719) ───────────────
  const PURPOSES = [
    {
      key: "appointments", legalBasis: "contrato", required: true, displayOrder: 1,
      label: "Gestión de citas y atención",
      description: "Usamos tu nombre, RUT y contacto para agendar, confirmar y atender tus citas. Es necesario para prestarte el servicio.",
    },
    {
      key: "clinical_record", legalBasis: "obligacion_legal", required: true, displayOrder: 2,
      label: "Ficha clínica",
      description: "Mantenemos tu historial clínico, odontograma y tratamientos. La ley nos obliga a conservarlo (Ley 20.584).",
    },
    {
      key: "reminders", legalBasis: "consentimiento", required: false, displayOrder: 3,
      label: "Recordatorios por WhatsApp / email",
      description: "Te enviamos recordatorios de tus citas y avisos de controles periódicos por WhatsApp o email.",
    },
    {
      key: "ai_chat", legalBasis: "consentimiento", required: false, displayOrder: 4,
      label: "Asistente con IA",
      description: "Procesamos tus mensajes con un asistente de IA para responder consultas y ayudarte a agendar.",
    },
    {
      key: "marketing", legalBasis: "consentimiento", required: false, displayOrder: 5,
      label: "Comunicaciones de marketing",
      description: "Te enviamos promociones y novedades de la clínica. Puedes revocarlo cuando quieras.",
    },
  ];
  for (const p of PURPOSES) {
    await prisma.dataProcessingPurpose.upsert({
      where: { key: p.key },
      update: { label: p.label, description: p.description, legalBasis: p.legalBasis, required: p.required, displayOrder: p.displayOrder, active: true },
      create: p,
    });
  }
  console.log(`✅ Propósitos de tratamiento de datos: ${PURPOSES.length} seedeados`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
