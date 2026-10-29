import { rutCanonico } from "../lib/rut";
import type { MigracionDeDatos } from "./migracion";

const TABLAS = [
  "bookings", "treatment_plans", "dental_quotes", "account_entries",
  "waitlist_entries", "recall_events", "movimientos_caja", "consent_signatures",
] as const;

/**
 * Deja todos los RUT de pacientes en un solo formato: "12345678-9" (MOL-60).
 *
 * Desde ahora el backend lo normaliza al guardar y al buscar; esto arregla lo
 * que ya estaba guardado en otro formato ("12.345.678-9", "123456789"), que
 * partía al mismo paciente en dos. Solo cambia cómo está escrito el RUT, no
 * de quién es.
 *
 * Si dos identidades distintas quedan con el mismo RUT, no las junta (unirlas
 * es decidir que dos fichas son la misma persona): las cuenta y las deja como
 * están. El log no muestra RUT, solo cantidades.
 *
 * Corre con un cliente sin la extensión que normaliza (correr.ts): tiene que
 * poder encontrar los RUT escritos en el formato viejo.
 */
export const normalizarRut: MigracionDeDatos = {
  id: "2026-10-normalizar-rut",
  descripcion: "Deja los RUT de pacientes en el formato 12345678-9",
  async correr(prisma, log, aplicar) {
    for (const tabla of TABLAS) {
      const filas = await prisma.$queryRawUnsafe<{ rut: string; n: number }[]>(
        `select "patientRut" as rut, count(*)::int as n from ${tabla} where "patientRut" is not null group by 1`,
      );
      const cambian = filas.filter((f) => rutCanonico(f.rut) !== null && rutCanonico(f.rut) !== f.rut);
      if (cambian.length === 0) continue;
      if (aplicar) {
        for (const f of cambian) {
          await prisma.$executeRawUnsafe(`update ${tabla} set "patientRut" = $1 where "patientRut" = $2`, rutCanonico(f.rut), f.rut);
        }
      }
      log(`${tabla}: ${cambian.reduce((s, f) => s + f.n, 0)} filas en otro formato`);
    }

    // Identidades: el RUT es único, así que antes de cambiarlo se revisa que
    // no choque con otra identidad que ya lo tenga normalizado.
    const identidades = await prisma.identity.findMany({ select: { id: true, rut: true } });
    const porCanonico = new Map<string, { id: string; rut: string }[]>();
    for (const i of identidades) {
      const c = rutCanonico(i.rut) ?? i.rut;
      porCanonico.set(c, [...(porCanonico.get(c) ?? []), i]);
    }
    let cambiadas = 0, chocan = 0;
    for (const [canonico, grupo] of porCanonico) {
      if (grupo.length > 1) { chocan++; continue; }
      const [i] = grupo;
      if (i.rut === canonico) continue;
      cambiadas++;
      if (aplicar) await prisma.identity.update({ where: { id: i.id }, data: { rut: canonico } });
    }
    log(`identidades en otro formato: ${cambiadas}; con RUT repetido, sin tocar (revisar a mano): ${chocan}`);
  },
};
