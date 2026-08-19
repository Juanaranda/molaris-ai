/**
 * Ubicación de la hora actual dentro de la grilla de la agenda.
 *
 * Vive acá y no dentro del componente para poder probar los bordes con el
 * reloj congelado: antes de que abra la clínica, después del cierre y justo
 * en el último tramo, que son los casos donde una línea de "ahora" mal puesta
 * hace que el doctor lea la agenda corrida.
 */

/** Minutos transcurridos desde el inicio de la grilla, o null si está fuera. */
export function minutosDesdeInicioDeGrilla(slots: string[], ahora = new Date()): number | null {
  if (slots.length === 0) return null;
  const [hIni, mIni] = slots[0].split(":").map(Number);
  const [hFin, mFin] = slots[slots.length - 1].split(":").map(Number);
  const inicio = hIni * 60 + mIni;
  // El último tramo dura media hora más que su etiqueta.
  const fin = hFin * 60 + mFin + 30;
  const mins = ahora.getHours() * 60 + ahora.getMinutes();
  if (mins < inicio || mins >= fin) return null;
  return mins - inicio;
}

/** ¿"Ahora" cae dentro de la media hora que empieza en `slot`? */
export function esElTramoDeAhora(slot: string, slots: string[], ahora = new Date()): boolean {
  const desdeInicio = minutosDesdeInicioDeGrilla(slots, ahora);
  if (desdeInicio === null) return false;
  const [h0, m0] = slots[0].split(":").map(Number);
  const [sh, sm] = slot.split(":").map(Number);
  const inicioSlot = sh * 60 + sm;
  const minsAhora = h0 * 60 + m0 + desdeInicio;
  return minsAhora >= inicioSlot && minsAhora < inicioSlot + 30;
}
