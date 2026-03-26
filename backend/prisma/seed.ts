import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const galana = await prisma.clinic.upsert({
    where: { slug: "galana" },
    update: {},
    create: {
      slug: "galana",
      name: "Galana Clínica Dental",
      phone: "+56 9 5678 9735",
      whatsapp: "56956789735",
      instagram: "@galanaclinicadental",
      location: "Santiago, Chile",
      plan: "starter",
      config: {
        tone: "profesional pero cercano, lenguaje chileno natural",
        schedule: {
          weekdays: "Lunes a Viernes: 10:00 - 18:00",
          saturday: "Sábado: 10:00 - 14:00",
          sunday: "Domingo: cerrado",
        },
        services: [
          { name: "Limpieza dental", pricingType: "fixed", price: "a consultar" },
          { name: "Blanqueamiento dental", pricingType: "variable", priceNote: "Varía según tipo y caso del paciente." },
          { name: "Ortodoncia (brackets / alineadores)", pricingType: "variable", priceNote: "Depende de la complejidad. Se evalúa en consulta." },
          { name: "Carillas dentales", pricingType: "variable", priceNote: "Varía según número de piezas y material." },
          { name: "Implantes dentales", pricingType: "variable", priceNote: "Depende del número de implantes y estado del hueso." },
          { name: "Urgencias dentales", pricingType: "fixed", price: "a consultar" },
          { name: "Endodoncia (tratamiento de conducto)", pricingType: "variable", priceNote: "Varía según número de conductos." },
          { name: "Extracción de muela del juicio", pricingType: "variable", priceNote: "Varía según posición e impactación." },
        ],
      },
    },
  });

  console.log(`✅ Clínica creada: ${galana.name} (API key: ${galana.apiKey})`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
