import { PrismaClient } from "@prisma/client";
import { idDelProfesional } from "../lib/doctores";
import { rutCanonico } from "../lib/rut";

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

/* ── RUT en un solo formato (MOL-60) ─────────────────────────────────────────
   Las tablas que guardan el RUT del paciente se unen por ese texto. Venía en
   tres formatos ("12.345.678-9", "123456789", "12345678-9") y el mismo paciente
   quedaba partido. Acá se normaliza al guardar y al buscar, en todas las
   tablas a la vez, para que ningún camino nuevo lo vuelva a romper. */
const CAMPO_RUT: Record<string, string> = {
  Booking: "patientRut", TreatmentPlan: "patientRut", DentalQuote: "patientRut",
  AccountEntry: "patientRut", WaitlistEntry: "patientRut", RecallEvent: "patientRut",
  MovimientoCaja: "patientRut", ConsentSignature: "patientRut", Identity: "rut",
};

type Objeto = Record<string, unknown>;
const esObjeto = (v: unknown): v is Objeto => !!v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date);

/** Normaliza el RUT en datos a guardar (objeto o lista). */
function rutEnDatos(datos: unknown, campo: string): unknown {
  if (Array.isArray(datos)) return datos.map((d) => rutEnDatos(d, campo));
  if (!esObjeto(datos) || !(campo in datos)) return datos;
  const v = datos[campo];
  if (typeof v === "string") return { ...datos, [campo]: rutCanonico(v) };
  if (esObjeto(v) && typeof v.set === "string") return { ...datos, [campo]: { set: rutCanonico(v.set) } };
  return datos;
}

/** Normaliza el RUT en un filtro: igualdad, equals, in, y dentro de OR/AND/NOT. */
function rutEnFiltro(filtro: unknown, campo: string): unknown {
  if (Array.isArray(filtro)) return filtro.map((f) => rutEnFiltro(f, campo));
  if (!esObjeto(filtro)) return filtro;
  const salida: Objeto = { ...filtro };
  for (const op of ["OR", "AND", "NOT"]) if (op in salida) salida[op] = rutEnFiltro(salida[op], campo);
  const v = salida[campo];
  if (typeof v === "string") salida[campo] = rutCanonico(v);
  else if (esObjeto(v)) {
    const c: Objeto = { ...v };
    if (typeof c.equals === "string") c.equals = rutCanonico(c.equals);
    if (Array.isArray(c.in)) c.in = c.in.map((x) => (typeof x === "string" ? rutCanonico(x) : x));
    salida[campo] = c;
  }
  return salida;
}

const conRutCanonico = base.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, args, query }) {
        const campo = CAMPO_RUT[model];
        if (campo && esObjeto(args)) {
          const a = args as Objeto;
          if ("data" in a) a.data = rutEnDatos(a.data, campo);
          if ("create" in a) a.create = rutEnDatos(a.create, campo);
          if ("update" in a) a.update = rutEnDatos(a.update, campo);
          if ("where" in a) a.where = rutEnFiltro(a.where, campo);
        }
        return query(args);
      },
    },
  },
});

const prisma = conRutCanonico.$extends({
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
