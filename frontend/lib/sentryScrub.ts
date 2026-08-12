import type { ErrorEvent } from "@sentry/nextjs";

/**
 * Mismo criterio que el scrub del backend (`backend/src/instrument.ts`): lo que
 * se manda a Sentry sale de la clínica hacia un tercero, y bajo la Ley 21.719
 * no puede llevar datos del paciente.
 *
 * En el front hay una fuente extra que el backend no tiene: la URL del
 * navegador. Rutas como /partners/pacientes/<id> y los filtros de búsqueda
 * (?rut=, ?q=) van en la barra de direcciones y Sentry los adjunta solo.
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.query_string;
    delete event.request.headers;
    if (event.request.url) event.request.url = event.request.url.split("?")[0];
  }

  if (event.user) {
    event.user = { id: event.user.id };
  }

  // Los breadcrumbs guardan cada navegación y cada fetch: ahí también viajan
  // los parámetros de búsqueda de pacientes.
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((b) => {
      if (!b.data) return b;
      const data = { ...b.data };
      if (typeof data.url === "string") data.url = data.url.split("?")[0];
      if (typeof data.to === "string") data.to = data.to.split("?")[0];
      if (typeof data.from === "string") data.from = data.from.split("?")[0];
      return { ...b, data };
    });
  }

  return event;
}
