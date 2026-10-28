/**
 * Deja todos los RUT de pacientes en un solo formato: "12345678-9" (MOL-60).
 *
 * Desde ahora el backend lo normaliza al guardar y al buscar; esto arregla lo
 * que ya estaba guardado en otro formato ("12.345.678-9", "123456789"), que
 * partía al mismo paciente en dos. Solo cambia cómo está escrito el RUT, no
 * de quién es.
 *
 * Si dos identidades distintas quedan con el mismo RUT normalizado, no las
 * junta: las lista para revisarlas a mano (unirlas es decidir que dos fichas
 * son la misma persona).
 *
 * Sin argumentos solo muestra lo que haría. Para aplicar, en local o en el
 * shell de Railway (/app):
 *
 *   npx tsx prisma/normalizar-rut.ts            # ver
 *   npx tsx prisma/normalizar-rut.ts --aplicar  # aplicar
 */
import { PrismaClient } from "@prisma/client";
import { rutCanonico } from "../src/lib/rut";

// Cliente sin la extensión que normaliza: tiene que poder encontrar los RUT
// escritos en el formato viejo.
const prisma = new PrismaClient();
const aplicar = process.argv.includes("--aplicar");

const TABLAS = [
  "bookings", "treatment_plans", "dental_quotes", "account_entries",
  "waitlist_entries", "recall_events", "movimientos_caja", "consent_signatures",
] as const;

async function main() {
  console.log(aplicar ? "Aplicando…" : "Modo vista: no se cambia nada. Agrega --aplicar para guardar.");

  for (const tabla of TABLAS) {
    const filas = await prisma.$queryRawUnsafe<{ rut: string; n: number }[]>(
      `select "patientRut" as rut, count(*)::int as n from ${tabla} where "patientRut" is not null group by 1`,
    );
    const cambian = filas.filter((f) => rutCanonico(f.rut) !== f.rut);
    if (cambian.length === 0) continue;
    const total = cambian.reduce((s, f) => s + f.n, 0);
    console.log(`\n${tabla}: ${cambian.length} RUT en otro formato (${total} filas)`);
    for (const f of cambian) {
      console.log(`  "${f.rut}" → "${rutCanonico(f.rut)}" (${f.n})`);
      if (aplicar) {
        await prisma.$executeRawUnsafe(`update ${tabla} set "patientRut" = $1 where "patientRut" = $2`, rutCanonico(f.rut), f.rut);
      }
    }
  }

  // Identidades: el RUT es único, así que antes de cambiarlo se revisa que no
  // choque con otra identidad que ya lo tenga normalizado.
  const identidades = await prisma.identity.findMany({ select: { id: true, rut: true } });
  const porCanonico = new Map<string, { id: string; rut: string }[]>();
  for (const i of identidades) {
    const c = rutCanonico(i.rut) ?? i.rut;
    porCanonico.set(c, [...(porCanonico.get(c) ?? []), i]);
  }
  for (const [canonico, grupo] of porCanonico) {
    if (grupo.length > 1) {
      console.log(`\nREVISAR A MANO: ${grupo.length} identidades con el RUT ${canonico}: ${grupo.map((g) => `"${g.rut}"`).join(", ")}. No se tocan.`);
      continue;
    }
    const [i] = grupo;
    if (i.rut === canonico) continue;
    console.log(`identidad "${i.rut}" → "${canonico}"`);
    if (aplicar) await prisma.identity.update({ where: { id: i.id }, data: { rut: canonico } });
  }

  console.log(aplicar ? "\nListo." : "\nNada cambió (modo vista).");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
