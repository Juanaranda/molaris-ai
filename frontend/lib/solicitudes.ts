/**
 * Cuándo una hora está esperando el visto bueno del profesional.
 *
 * El backend marca `requestedVia` según por dónde la pidió el paciente:
 * "agent" si la negoció el asistente, "web" si la eligió en la página pública.
 * Las creadas por la clínica desde el panel no llevan marca y no necesitan
 * confirmación — ya las hizo un humano.
 *
 * Vive acá y no comparado a mano en cada pantalla porque se pregunta en seis
 * lugares del panel: cuando se sumó la página pública, cambiar solo algunos
 * habría dejado esas horas sin el aviso "por confirmar" en las otras vistas.
 * Es la misma forma en que se separaron las dos versiones del odontograma.
 */
export interface ConEstado {
  status: string;
  requestedVia?: string | null;
}

export function esperaConfirmacion(b: ConEstado): boolean {
  return b.status === "pending" && Boolean(b.requestedVia);
}
