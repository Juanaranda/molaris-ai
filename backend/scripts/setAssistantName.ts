import prisma from "../src/config/prisma";

async function main() {
  const clinic = await prisma.clinic.findUnique({ where: { slug: "galana" }, select: { id: true, config: true } });
  if (!clinic) { console.error("Clínica galana no encontrada"); return; }

  const updated = await prisma.clinic.update({
    where: { slug: "galana" },
    data: { config: { ...(clinic.config as object), assistantName: "Anita" } },
    select: { name: true, config: true },
  });

  const cfg = updated.config as Record<string, unknown>;
  console.log(`✓ ${updated.name} → assistantName: "${cfg.assistantName}"`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
