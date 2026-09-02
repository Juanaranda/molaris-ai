/**
 * Cuánto le queda a una hora antes de liberarse sola.
 *
 * El panel ya avisaba que las solicitudes sin responder caducan, pero no decía
 * cuándo. "Se libera sola" sin plazo no mueve a nadie: la diferencia entre
 * responder y no responder es saber que quedan cuarenta minutos.
 *
 * Vive fuera del componente para poder probar los bordes — el minuto, la hora,
 * el vencimiento — sin montar la agenda entera.
 */

export interface Restante {
  /** Listo para mostrar: "en 40 min", "en 3 h", "vencida". */
  texto: string;
  /** Menos de tres horas: se pinta distinto para que salte a la vista. */
  urgente: boolean;
  /** Ya pasó el plazo; el scheduler la va a cerrar en su próxima pasada. */
  vencida: boolean;
}

const MINUTO = 60_000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

/** Bajo este margen la solicitud se muestra en rojo, no en ámbar. */
export const UMBRAL_URGENTE_MS = 3 * HORA;

/**
 * @param deadline ISO del plazo, o null si la solicitud no tiene uno.
 * @param ahora    inyectable para poder probar sin depender del reloj.
 */
export function restanteHasta(deadline: string | null | undefined, ahora: Date = new Date()): Restante | null {
  if (!deadline) return null;
  const fin = new Date(deadline).getTime();
  if (Number.isNaN(fin)) return null;

  const ms = fin - ahora.getTime();
  if (ms <= 0) return { texto: "vencida", urgente: true, vencida: true };

  const urgente = ms < UMBRAL_URGENTE_MS;

  if (ms < HORA) {
    // Se redondea hacia arriba para no decir "en 0 min" durante el último minuto.
    return { texto: `en ${Math.ceil(ms / MINUTO)} min`, urgente, vencida: false };
  }
  if (ms < DIA) {
    // Hacia abajo: prometer menos tiempo del que queda empuja a responder antes,
    // que es el error barato. Al revés se pierde la hora.
    return { texto: `en ${Math.floor(ms / HORA)} h`, urgente, vencida: false };
  }
  const dias = Math.floor(ms / DIA);
  return { texto: `en ${dias} ${dias === 1 ? "día" : "días"}`, urgente: false, vencida: false };
}
