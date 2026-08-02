/**
 * Unifica las variantes del nombre de un mismo profesional en las citas.
 *
 * Uso:
 *   npx tsx scripts/unifyDoctorNames.ts            → informe, no escribe nada
 *   npx tsx scripts/unifyDoctorNames.ts --apply    → aplica los cambios
 *
 * Solo agrupa lo inequívoco: nombres idénticos que difieren en el tratamiento
 * ("Dr."/"Dra.") o en las tildes. Dos apellidos distintos NO se juntan aunque
 * se parezcan — fusionar a dos personas distintas atribuiría la atención de
 * una a la otra, y eso en una ficha clínica no se puede deshacer a ojo.
 *
 * Canónico = como la clínica escribe a ese profesional en su equipo. Si ya no
 * está en el equipo (historial de alguien que dejó de atender), gana la
 * variante con más citas.
 */

import prisma from "../src/config/prisma";
import { normalizeDoctorName, canonicalDoctorName } from "../src/lib/doctorName";

async function main() {
  const apply = process.argv.includes("--apply");

  const clinics = await prisma.clinic.findMany({ select: { id: true, name: true, config: true } });
  let totalCambios = 0;

  for (const clinic of clinics) {
    const equipo = (clinic.config as { doctors?: { name: string }[] } | null)?.doctors?.map((d) => d.name) ?? [];

    const variantes = await prisma.booking.groupBy({
      by: ["doctor"],
      where: { clinicId: clinic.id },
      _count: { doctor: true },
    });

    // Agrupa por nombre normalizado
    const grupos = new Map<string, { nombre: string; n: number }[]>();
    for (const v of variantes) {
      if (!v.doctor || v.doctor === "Sin asignar") continue;
      const key = normalizeDoctorName(v.doctor);
      if (!grupos.has(key)) grupos.set(key, []);
      grupos.get(key)!.push({ nombre: v.doctor, n: v._count.doctor });
    }

    for (const [, vs] of grupos) {
      if (vs.length < 2) continue; // sin variantes, nada que unificar

      // Canónico: la forma del equipo; si no está, la más usada.
      const desdeEquipo = canonicalDoctorName(vs[0].nombre, equipo);
      const canonico = equipo.some((d) => normalizeDoctorName(d) === normalizeDoctorName(vs[0].nombre))
        ? desdeEquipo
        : [...vs].sort((a, b) => b.n - a.n)[0].nombre;

      const aCambiar = vs.filter((v) => v.nombre !== canonico);
      if (aCambiar.length === 0) continue;

      const detalle = aCambiar.map((v) => `"${v.nombre}"(${v.n})`).join(" + ");
      console.log(`${clinic.name}: ${detalle} → "${canonico}"`);

      if (apply) {
        for (const v of aCambiar) {
          const r = await prisma.booking.updateMany({
            where: { clinicId: clinic.id, doctor: v.nombre },
            data: { doctor: canonico },
          });
          totalCambios += r.count;
        }
      } else {
        totalCambios += aCambiar.reduce((s, v) => s + v.n, 0);
      }
    }
  }

  console.log(
    apply
      ? `\n✅ ${totalCambios} citas actualizadas.`
      : `\n(informe) ${totalCambios} citas se actualizarían. Correr con --apply para aplicar.`
  );
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
