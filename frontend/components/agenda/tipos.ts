/** Cita tal como la entrega `GET /api/agenda/week`. */
export interface Booking {
  id: string; doctor: string; time: string; date: string; box: string | null;
  /** Id del profesional en el equipo (MOL-55); null en citas antiguas. */
  doctorId: string | null;
  sede: string | null;
  patientName: string | null; patientRut: string | null;
  patientPhone: string | null; patientEmail: string | null;
  service: string | null; status: string; notes: string | null;
  /** "agent" = la pidió el agente y espera confirmación humana. */
  requestedVia: string | null;
  confirmDeadline: string | null;
  confirmedByName: string | null;
  paymentStatus: string | null; amountTotal: number | null;
  amountPaid: number | null; paymentMethod: string | null; paidAt: string | null;
  createdAt: string;
}

export interface DayData { date: string; bookings: Booking[]; }

/** Cita con el día ya resuelto ("YYYY-MM-DD"), para listas que cruzan días. */
export type BookingConDia = Booking & { dateStr: string };

/** La hora de ahora, leída una vez por minuto para todo lo que la muestra. */
export interface Ahora { mins: number | null; label: string; fecha: Date }
