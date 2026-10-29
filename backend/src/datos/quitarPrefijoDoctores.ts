import { Prisma } from "@prisma/client";
import { sinPrefijo } from "../lib/doctores";
import type { MigracionDeDatos } from "./migracion";

const CON_PREFIJO = /^\s*(dr|dra|doctor|doctora)\.?\s+/i;

/**
 * Le saca el "Dr." / "Dra." a los nombres de profesionales ya guardados, en
 * todas las clínicas. Desde ahora el backend lo quita al guardar; esto limpia
 * lo anterior.
 *
 * Se limpian juntos el equipo (config.doctors) y todo lo que guarda el nombre
 * como texto: citas, planes, presupuestos, lista de espera y cuentas. Las
 * fichas y el odontograma no se tocan: enlazan al profesional por id.
 */
export const quitarPrefijoDoctores: MigracionDeDatos = {
  id: "2026-10-quitar-prefijo-doctores",
  descripcion: "Quita Dr./Dra. de los nombres de profesionales",
  async correr(prisma, log, aplicar) {
    let equipos = 0;
    for (const c of await prisma.clinic.findMany({ select: { id: true, config: true } })) {
      const config = (c.config ?? {}) as Record<string, unknown>;
      if (!Array.isArray(config.doctors)) continue;
      let cambio = false;
      const doctors = config.doctors.map((d: unknown) => {
        const doc = d as Record<string, unknown>;
        if (typeof doc?.name !== "string" || !CON_PREFIJO.test(doc.name)) return d;
        cambio = true;
        return { ...doc, name: sinPrefijo(doc.name) };
      });
      if (!cambio) continue;
      equipos++;
      if (aplicar) {
        await prisma.clinic.update({ where: { id: c.id }, data: { config: { ...config, doctors } as Prisma.InputJsonValue } });
      }
    }
    log(`equipos con prefijo: ${equipos}`);

    /** Cambia un campo de texto en todas las filas que lo tengan con prefijo. */
    async function limpiar(
      tabla: string,
      distintos: () => Promise<(string | null)[]>,
      actualizar: (de: string, a: string) => Promise<{ count: number }>,
    ) {
      let filas = 0;
      for (const valor of await distintos()) {
        if (!valor || !CON_PREFIJO.test(valor)) continue;
        filas += aplicar ? (await actualizar(valor, sinPrefijo(valor))).count : 1;
      }
      if (filas) log(`${tabla}: ${filas} ${aplicar ? "filas" : "nombres distintos"}`);
    }

    await limpiar("citas",
      async () => (await prisma.booking.groupBy({ by: ["doctor"] })).map((r) => r.doctor),
      (de, a) => prisma.booking.updateMany({ where: { doctor: de }, data: { doctor: a } }));
    await limpiar("planes de tratamiento",
      async () => (await prisma.treatmentPlan.groupBy({ by: ["doctor"] })).map((r) => r.doctor),
      (de, a) => prisma.treatmentPlan.updateMany({ where: { doctor: de }, data: { doctor: a } }));
    await limpiar("presupuestos",
      async () => (await prisma.dentalQuote.groupBy({ by: ["doctor"] })).map((r) => r.doctor),
      (de, a) => prisma.dentalQuote.updateMany({ where: { doctor: de }, data: { doctor: a } }));
    await limpiar("lista de espera",
      async () => (await prisma.waitlistEntry.groupBy({ by: ["preferredDoctor"] })).map((r) => r.preferredDoctor),
      (de, a) => prisma.waitlistEntry.updateMany({ where: { preferredDoctor: de }, data: { preferredDoctor: a } }));
    await limpiar("cuentas",
      async () => (await prisma.partnerUser.groupBy({ by: ["name"] })).map((r) => r.name),
      (de, a) => prisma.partnerUser.updateMany({ where: { name: de }, data: { name: a } }));
  },
};
