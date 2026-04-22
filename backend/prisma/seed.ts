import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const galanaConfig = {
  tone: "profesional pero cercano, lenguaje chileno natural",
  assistantName: "Gala",
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
    where: { email: "superadmin@molaris.ai" },
    update: {},
    create: {
      name: "Super Admin",
      email: "superadmin@molaris.ai",
      passwordHash: await bcrypt.hash("molaris2024!", SALT_ROUNDS),
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
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
