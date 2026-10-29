/**
 * Aplica las correcciones de datos pendientes (MigracionDeDatos), en orden,
 * una vez cada una por base. Lo corre el deploy (`npm run start:prod`) justo
 * después de `prisma db push` y antes de levantar el servidor; en local:
 *
 *   npm run datos           # aplica las pendientes
 *   npm run datos -- --ver  # solo muestra lo que haría
 *
 * Si una falla, se anota en el log y se reintenta en el próximo deploy, pero
 * el servidor igual arranca: una corrección de datos no debe botar la app.
 */
import { PrismaClient } from "@prisma/client";
import type { MigracionDeDatos } from "./migracion";
import { quitarPrefijoDoctores } from "./quitarPrefijoDoctores";
import { rellenarDoctorId } from "./rellenarDoctorId";
import { normalizarRut } from "./normalizarRut";
import { juanDelSeed } from "./juanDelSeed";

/** En orden: el id del profesional se rellena con los nombres ya sin "Dr.". */
function migraciones(): MigracionDeDatos[] {
  const lista = [quitarPrefijoDoctores, rellenarDoctorId, normalizarRut];
  // Si el seed no está o cambió de forma, se salta solo esta, no las demás.
  try { lista.push(juanDelSeed()); }
  catch (e) { console.error("[datos] juan-prompt: no se pudo leer el seed", e); }
  return lista;
}

async function main() {
  const ver = process.argv.includes("--ver");
  // Cliente sin las extensiones de config/prisma: las correcciones tienen que
  // ver los datos tal como están guardados.
  const prisma = new PrismaClient();
  try {
    const hechas = new Set((await prisma.migracionDatos.findMany({ select: { id: true } })).map((m) => m.id));
    const pendientes = migraciones().filter((m) => !hechas.has(m.id));
    console.log(`[datos] ${pendientes.length} pendientes${ver ? " (solo ver, no se escribe nada)" : ""}`);
    for (const m of pendientes) {
      const lineas: string[] = [];
      const log = (linea: string) => { lineas.push(linea); console.log(`[datos] ${m.id}: ${linea}`); };
      try {
        await m.correr(prisma, log, !ver);
        if (!ver) await prisma.migracionDatos.create({ data: { id: m.id, descripcion: m.descripcion, resumen: lineas.join("\n") } });
        console.log(`[datos] ${m.id}: ${ver ? "vista lista" : "aplicada"}`);
      } catch (e) {
        console.error(`[datos] ${m.id}: FALLÓ, se reintenta en el próximo deploy`, e);
      }
    }
  } catch (e) {
    console.error("[datos] No se pudieron revisar las correcciones de datos", e);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
