import { PrismaClient } from "@prisma/client";
import { idDelProfesional } from "../lib/doctores";

const base = new PrismaClient();

type DatosCita = { clinicId?: unknown; doctor?: unknown; doctorId?: unknown };

/**
 * Cada cita guarda el id del profesional además del nombre (MOL-55). Las citas
 * se crean en ocho lugares (agenda, agente, reservas, WhatsApp, importación…);
 * completarlo acá evita que se escape alguno, o uno nuevo.
 */
async function conDoctorId<T extends DatosCita>(datos: T[]): Promise<T[]> {
  const faltan = datos.filter((d) => !d.doctorId && typeof d.doctor === "string" && typeof d.clinicId === "string");
  if (faltan.length === 0) return datos;
  const clinicas = [...new Set(faltan.map((d) => d.clinicId as string))];
  const configs = await base.clinic.findMany({ where: { id: { in: clinicas } }, select: { id: true, config: true } });
  const equipo = new Map(configs.map((c) => [c.id, (c.config as { doctors?: unknown } | null)?.doctors]));
  return datos.map((d) => {
    if (d.doctorId || typeof d.doctor !== "string" || typeof d.clinicId !== "string") return d;
    const id = idDelProfesional(equipo.get(d.clinicId), d.doctor);
    return id ? { ...d, doctorId: id } : d;
  });
}

const prisma = base.$extends({
  query: {
    booking: {
      async create({ args, query }) {
        const [datos] = await conDoctorId([args.data as DatosCita]);
        args.data = datos as typeof args.data;
        return query(args);
      },
      async createMany({ args, query }) {
        const lista = Array.isArray(args.data) ? args.data : [args.data];
        const datos = await conDoctorId(lista as DatosCita[]);
        args.data = (Array.isArray(args.data) ? datos : datos[0]) as typeof args.data;
        return query(args);
      },
    },
  },
});

export default prisma;
