/**
 * Actualiza SOLO el texto de Juan, el asistente comercial (clínica
 * `molaris-demo`), con el que está en prisma/seed.ts.
 *
 * Existe porque correr el seed completo en beta también reescribe la
 * configuración de Galana. Se corre a mano en el shell de Railway (/app):
 *
 *   npx tsx prisma/actualizar-juan.ts
 *
 * No toca ninguna otra clínica ni otro campo de la configuración.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const seed = readFileSync(join(__dirname, "seed.ts"), "utf8");
  const m = seed.match(/const juanPrompt = `([\s\S]*?)`;/);
  if (!m) throw new Error("No encontré juanPrompt en prisma/seed.ts");

  const clinica = await prisma.clinic.findUnique({ where: { slug: "molaris-demo" } });
  if (!clinica) {
    console.log("No existe la clínica molaris-demo en esta base: no hay nada que actualizar.");
    return;
  }
  const config = { ...(clinica.config as Record<string, unknown>), customSystemPrompt: m[1] };
  await prisma.clinic.update({ where: { id: clinica.id }, data: { config: config as Prisma.InputJsonValue } });
  console.log(`Juan actualizado en molaris-demo (${m[1].length} caracteres). Ninguna otra clínica se tocó.`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
