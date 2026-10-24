/**
 * Le saca el "Dr." / "Dra." a los nombres de profesionales ya guardados, en
 * todas las clínicas. Desde ahora el backend lo quita al guardar; esto limpia
 * lo anterior.
 *
 * Se limpian juntos el equipo (config.doctors) y todo lo que guarda el nombre
 * como texto: citas, planes, presupuestos, lista de espera y cuentas. La agenda
 * y "Mi día" comparan el nombre exacto, así que limpiar solo el equipo dejaría
 * las citas viejas ("Dr. X") fuera del filtro del profesional ("X").
 *
 * Sin argumentos solo muestra lo que cambiaría. Para aplicar, en el shell de
 * Railway (/app) o en local:
 *
 *   npx tsx prisma/quitar-prefijo-doctores.ts            # ver
 *   npx tsx prisma/quitar-prefijo-doctores.ts --aplicar  # aplicar
 *
 * No toca fichas clínicas ni el odontograma: esos enlazan al profesional por id.
 */
import { PrismaClient, Prisma } from "@prisma/client";
import { sinPrefijo } from "../src/lib/doctores";

const prisma = new PrismaClient();
const aplicar = process.argv.includes("--aplicar");
const CON_PREFIJO = /^\s*(dr|dra|doctor|doctora)\.?\s+/i;

/** Cambia un campo de texto en todas las filas que lo tengan con prefijo. */
async function limpiarCampo(
  tabla: string,
  distintos: () => Promise<(string | null)[]>,
  actualizar: (de: string, a: string) => Promise<{ count: number }>,
) {
  for (const valor of await distintos()) {
    if (!valor || !CON_PREFIJO.test(valor)) continue;
    const nuevo = sinPrefijo(valor);
    const { count } = aplicar ? await actualizar(valor, nuevo) : { count: 0 };
    console.log(`  ${tabla}: "${valor}" → "${nuevo}"${aplicar ? ` (${count} filas)` : ""}`);
  }
}

async function main() {
  console.log(aplicar ? "Aplicando cambios…" : "Modo vista: no se cambia nada. Agrega --aplicar para guardar.");

  console.log("Equipo de cada clínica:");
  for (const c of await prisma.clinic.findMany({ select: { id: true, slug: true, config: true } })) {
    const config = (c.config ?? {}) as Record<string, unknown>;
    if (!Array.isArray(config.doctors)) continue;
    let cambio = false;
    const doctors = config.doctors.map((d: unknown) => {
      const doc = d as Record<string, unknown>;
      if (typeof doc?.name !== "string" || !CON_PREFIJO.test(doc.name)) return d;
      cambio = true;
      console.log(`  ${c.slug}: "${doc.name}" → "${sinPrefijo(doc.name)}"`);
      return { ...doc, name: sinPrefijo(doc.name) };
    });
    if (cambio && aplicar) {
      await prisma.clinic.update({ where: { id: c.id }, data: { config: { ...config, doctors } as Prisma.InputJsonValue } });
    }
  }

  console.log("Datos que guardan el nombre como texto:");
  await limpiarCampo("citas",
    async () => (await prisma.booking.groupBy({ by: ["doctor"] })).map((r) => r.doctor),
    (de, a) => prisma.booking.updateMany({ where: { doctor: de }, data: { doctor: a } }));
  await limpiarCampo("planes de tratamiento",
    async () => (await prisma.treatmentPlan.groupBy({ by: ["doctor"] })).map((r) => r.doctor),
    (de, a) => prisma.treatmentPlan.updateMany({ where: { doctor: de }, data: { doctor: a } }));
  await limpiarCampo("presupuestos",
    async () => (await prisma.dentalQuote.groupBy({ by: ["doctor"] })).map((r) => r.doctor),
    (de, a) => prisma.dentalQuote.updateMany({ where: { doctor: de }, data: { doctor: a } }));
  await limpiarCampo("lista de espera",
    async () => (await prisma.waitlistEntry.groupBy({ by: ["preferredDoctor"] })).map((r) => r.preferredDoctor),
    (de, a) => prisma.waitlistEntry.updateMany({ where: { preferredDoctor: de }, data: { preferredDoctor: a } }));
  await limpiarCampo("cuentas",
    async () => (await prisma.partnerUser.groupBy({ by: ["name"] })).map((r) => r.name),
    (de, a) => prisma.partnerUser.updateMany({ where: { name: de }, data: { name: a } }));

  console.log(aplicar ? "Listo." : "Nada cambió (modo vista).");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
