import * as Sentry from "@sentry/node";
import { config } from "./config/env";

/**
 * Sentry (#58) — reporte de errores de producción.
 *
 * Va importado como PRIMERA línea de index.ts: Sentry instrumenta los módulos
 * al cargarse, así que si se inicializa después de importar Fastify o Prisma
 * esos quedan sin instrumentar y los errores llegan sin contexto.
 *
 * PRIVACIDAD (Ley 21.719 + 20.584): acá corren datos de salud. Se manda lo
 * mínimo para depurar — nunca cuerpos de request, ni queries de Prisma con
 * valores, ni nombres/RUT/teléfonos de pacientes. Si algo no se entiende sin
 * el dato del paciente, se reproduce en local, no se manda a un tercero.
 */

// Lo único que se deja pasar de los headers. Lista blanca y no negra a
// propósito: con lista negra, un header nuevo se filtra solo hasta que alguien
// se acuerde de agregarlo.
const HEADERS_PERMITIDOS = new Set(["content-type", "user-agent", "referer"]);

/**
 * Saca del evento todo lo que pueda identificar a un paciente. Exportada para
 * poder testearla: es la pieza que decide qué sale de la clínica hacia un
 * tercero, y eso no puede depender de leer bien un callback.
 */
export function scrubEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  if (event.request) {
    // El cuerpo puede traer la ficha de un paciente entera.
    delete event.request.data;
    delete event.request.cookies;
    // La query string lleva RUT y filtros de búsqueda de pacientes.
    delete event.request.query_string;

    if (event.request.headers) {
      const limpios: Record<string, string> = {};
      for (const [k, v] of Object.entries(event.request.headers)) {
        if (HEADERS_PERMITIDOS.has(k.toLowerCase())) limpios[k] = String(v);
      }
      event.request.headers = limpios;
    }
    // La URL sí sirve (dice qué ruta falló), pero sin lo que va después del "?".
    if (event.request.url) event.request.url = event.request.url.split("?")[0];
  }

  // El usuario logueado ayuda a saber a quién le pasó; el email no hace falta.
  if (event.user) {
    event.user = { id: event.user.id };
  }

  return event;
}

export function initSentry(): void {
  if (!config.sentry.dsn) return;

  Sentry.init({
    dsn: config.sentry.dsn,
    environment: config.sentry.environment,
    tracesSampleRate: config.sentry.tracesSampleRate,
    // sendDefaultPii mandaría IP, cookies y headers completos. Acá no.
    sendDefaultPii: false,
    beforeSend: scrubEvent,
  });
}

export { Sentry };
