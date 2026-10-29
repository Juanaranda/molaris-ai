import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Prisma } from "@prisma/client";
import type { MigracionDeDatos } from "./migracion";

/**
 * El texto de Juan, el asistente comercial (clínica `molaris-demo`), vive en
 * prisma/seed.ts. Correr el seed completo en beta reescribiría también la
 * configuración de Galana, así que esto copia solo ese texto.
 *
 * El id lleva una huella del texto: cada vez que cambia en el seed, el
 * próximo deploy lo copia una vez. No toca ninguna otra clínica ni campo.
 */
function promptDelSeed(): string {
  // src/datos y dist/datos están a la misma altura de prisma/.
  const seed = readFileSync(join(__dirname, "..", "..", "prisma", "seed.ts"), "utf8");
  const m = seed.match(/const juanPrompt = `([\s\S]*?)`;/);
  if (!m) throw new Error("No encontré juanPrompt en prisma/seed.ts");
  return m[1];
}

export function juanDelSeed(): MigracionDeDatos {
  const prompt = promptDelSeed();
  const huella = createHash("sha256").update(prompt).digest("hex").slice(0, 12);
  return {
    id: `juan-prompt-${huella}`,
    descripcion: "Copia el texto de Juan del seed a molaris-demo",
    async correr(prisma, log, aplicar) {
      const clinica = await prisma.clinic.findUnique({ where: { slug: "molaris-demo" } });
      if (!clinica) { log("no existe molaris-demo en esta base: nada que copiar"); return; }
      if (aplicar) {
        const config = { ...(clinica.config as Record<string, unknown>), customSystemPrompt: prompt };
        await prisma.clinic.update({ where: { id: clinica.id }, data: { config: config as Prisma.InputJsonValue } });
      }
      log(`texto de ${prompt.length} caracteres copiado`);
    },
  };
}
