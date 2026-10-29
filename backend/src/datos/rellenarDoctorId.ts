import { idDelProfesional } from "../lib/doctores";
import type { MigracionDeDatos } from "./migracion";

/**
 * Completa el id del profesional (Booking.doctorId) en las citas que ya
 * existían, a partir del nombre guardado y el equipo de cada clínica (MOL-55).
 *
 * Solo agrega el id al lado: el nombre no se toca, porque la cita es historia
 * clínica. Si un nombre no calza con nadie del equipo (alguien que ya no
 * atiende, "Sin asignar") o calza con dos, la cita queda sin id: la agenda la
 * sigue mostrando por el nombre.
 */
export const rellenarDoctorId: MigracionDeDatos = {
  id: "2026-10-rellenar-doctor-id",
  descripcion: "Completa el id del profesional en las citas viejas",
  async correr(prisma, log, aplicar) {
    let conId = 0, sinId = 0;
    for (const c of await prisma.clinic.findMany({ select: { id: true, slug: true, config: true } })) {
      const equipo = (c.config as { doctors?: unknown } | null)?.doctors;
      const nombres = await prisma.booking.groupBy({
        by: ["doctor"], where: { clinicId: c.id, doctorId: null }, _count: true,
      });
      for (const n of nombres) {
        const id = idDelProfesional(equipo, n.doctor);
        if (!id) { sinId += n._count; continue; }
        conId += aplicar
          ? (await prisma.booking.updateMany({ where: { clinicId: c.id, doctorId: null, doctor: n.doctor }, data: { doctorId: id } })).count
          : n._count;
      }
    }
    log(`citas con id: ${conId}; sin calce con el equipo (quedan por nombre): ${sinId}`);
  },
};
