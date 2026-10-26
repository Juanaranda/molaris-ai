/**
 * Producción de la clínica y de cada profesional en un período (MOL-58, fase 1).
 *
 * Es la base de las liquidaciones: qué atendió cada uno, cuánto se cobró,
 * cuánto se pagó y cuánto falta. No calcula remuneraciones; eso depende de
 * cómo paga cada clínica (MOL-59).
 *
 * De dónde sale la plata, sin contarla dos veces:
 *  - Cada cita trae su monto cobrado y pagado. Los pagos con Mercado Pago ya
 *    se suman ahí al aprobarse.
 *  - Los abonos de la cuenta corriente se registran aparte. Si están ligados a
 *    una cita atendida del período, cuentan para el profesional de esa cita;
 *    si no, quedan como "otros abonos", solo en el total de la clínica.
 *
 * "Sin monto" cuenta las atenciones que no tienen monto registrado (las
 * importadas de otro sistema, por ejemplo): así se ve cuán completos están
 * los totales, en vez de mostrar como cero lo que no se sabe.
 */
import { normalizeDoctorName } from "../../lib/doctorName";

export interface CitaFinanzas {
  id: string;
  doctor: string;
  doctorId: string | null;
  date: Date;
  status: string;
  amountTotal: number | null;
  amountPaid: number | null;
}

export interface AbonoFinanzas {
  amount: number;
  bookingId: string | null;
}

export interface ProfesionalEquipo { id: string; name: string }

export interface Cifras {
  atendidas: number;
  cobrado: number;
  pagado: number;
  porCobrar: number;
  sinMonto: number;
}

export interface FilaProfesional extends Cifras {
  /** Id del equipo; null si ya no atiende o la cita nunca tuvo profesional. */
  id: string | null;
  nombre: string;
  /** false: ya no está en el equipo (sus citas siguen siendo suyas). */
  activo: boolean;
}

export interface Produccion {
  clinica: Cifras & { otrosAbonos: number };
  profesionales: FilaProfesional[];
}

/** Atendida = no cancelada, ya ocurrió y no es una solicitud sin confirmar. */
export function fueAtendida(c: Pick<CitaFinanzas, "status" | "date">, ahora: Date): boolean {
  return c.status !== "cancelled" && c.status !== "pending" && c.date.getTime() <= ahora.getTime();
}

const SIN_PROFESIONAL = "Sin profesional asignado";
const vacia = (): Cifras => ({ atendidas: 0, cobrado: 0, pagado: 0, porCobrar: 0, sinMonto: 0 });

export function calcularProduccion(
  citas: CitaFinanzas[],
  abonos: AbonoFinanzas[],
  equipo: ProfesionalEquipo[],
  ahora: Date,
): Produccion {
  const porId = new Map(equipo.map((p) => [p.id, p]));
  const filas = new Map<string, FilaProfesional>();
  const clinica = { ...vacia(), otrosAbonos: 0 };
  const claveDeCita = new Map<string, string>();

  const filaDe = (c: CitaFinanzas): FilaProfesional => {
    const delEquipo = c.doctorId ? porId.get(c.doctorId) : undefined;
    const sinNadie = !c.doctor?.trim() || /^sin asignar$/i.test(c.doctor.trim());
    const clave = delEquipo ? `id:${delEquipo.id}` : sinNadie ? "sin" : `nombre:${normalizeDoctorName(c.doctor)}`;
    claveDeCita.set(c.id, clave);
    let f = filas.get(clave);
    if (!f) {
      f = {
        ...vacia(),
        id: delEquipo?.id ?? null,
        nombre: delEquipo?.name ?? (sinNadie ? SIN_PROFESIONAL : c.doctor),
        activo: Boolean(delEquipo),
      };
      filas.set(clave, f);
    }
    return f;
  };

  for (const c of citas) {
    if (!fueAtendida(c, ahora)) continue;
    const f = filaDe(c);
    for (const cifras of [f, clinica]) {
      cifras.atendidas++;
      if (c.amountTotal == null) cifras.sinMonto++;
      const cobrado = c.amountTotal ?? 0;
      const pagado = c.amountPaid ?? 0;
      cifras.cobrado += cobrado;
      cifras.pagado += pagado;
      cifras.porCobrar += Math.max(0, cobrado - pagado);
    }
  }

  for (const a of abonos) {
    const clave = a.bookingId ? claveDeCita.get(a.bookingId) : undefined;
    const f = clave ? filas.get(clave) : undefined;
    clinica.pagado += a.amount;
    if (f) {
      f.pagado += a.amount;
      f.porCobrar = Math.max(0, f.porCobrar - a.amount);
    } else {
      clinica.otrosAbonos += a.amount;
    }
  }
  clinica.porCobrar = [...filas.values()].reduce((s, f) => s + f.porCobrar, 0);

  // Activos primero (por lo atendido), después quienes ya no atienden y al
  // final las citas sin profesional.
  const profesionales = [...filas.values()].sort((a, b) =>
    Number(b.activo) - Number(a.activo)
    || Number(a.nombre === SIN_PROFESIONAL) - Number(b.nombre === SIN_PROFESIONAL)
    || b.atendidas - a.atendidas,
  );
  return { clinica, profesionales };
}
