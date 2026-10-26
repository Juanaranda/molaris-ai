/**
 * Completa el id del profesional (Booking.doctorId) en las citas que ya
 * existían, a partir del nombre guardado y el equipo de cada clínica (MOL-55).
 *
 * Solo agrega el id al lado: el nombre guardado no se toca, porque la cita es
 * historia clínica. Si un nombre no calza con nadie del equipo (alguien que ya
 * no atiende, "Sin asignar") o calza con dos, la cita queda sin id y se lista
 * para revisarla a mano.
 *
 * Sin argumentos solo muestra lo que haría. Para aplicar, en local o en el
 * shell de Railway (/app):
 *
 *   npx tsx prisma/rellenar-doctor-id.ts            # ver
 *   npx tsx prisma/rellenar-doctor-id.ts --aplicar  # aplicar
 */
import { PrismaClient } from "@prisma/client";
import { idDelProfesional } from "../src/lib/doctores";

const prisma = new PrismaClient();
const aplicar = process.argv.includes("--aplicar");

async function main() {
  console.log(aplicar ? "Aplicando…" : "Modo vista: no se cambia nada. Agrega --aplicar para guardar.");
  for (const c of await prisma.clinic.findMany({ select: { id: true, slug: true, config: true } })) {
    const equipo = (c.config as { doctors?: unknown } | null)?.doctors;
    const nombres = await prisma.booking.groupBy({
      by: ["doctor"], where: { clinicId: c.id, doctorId: null }, _count: true,
    });
    if (nombres.length === 0) continue;
    console.log(`\n${c.slug}:`);
    for (const n of nombres.sort((a, b) => b._count - a._count)) {
      const id = idDelProfesional(equipo, n.doctor);
      if (!id) {
        console.log(`  sin id   "${n.doctor}" (${n._count} citas): no calza con nadie del equipo`);
        continue;
      }
      const { count } = aplicar
        ? await prisma.booking.updateMany({ where: { clinicId: c.id, doctorId: null, doctor: n.doctor }, data: { doctorId: id } })
        : { count: n._count };
      console.log(`  con id   "${n.doctor}" → ${id} (${count} citas)`);
    }
  }
  console.log(aplicar ? "\nListo." : "\nNada cambió (modo vista).");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
