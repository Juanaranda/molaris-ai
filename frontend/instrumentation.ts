import * as Sentry from "@sentry/nextjs";
import { scrubEvent } from "@/lib/sentryScrub";

/**
 * Sentry del lado servidor de Next (#58): errores al renderizar páginas y en
 * las rutas server. Distinto del backend Fastify, que tiene su propio Sentry
 * en `backend/src/instrument.ts`.
 *
 * Acá el DSN va SIN NEXT_PUBLIC_: nunca sale al navegador.
 */
export function register() {
  if (!process.env.SENTRY_DSN) return;

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    tracesSampleRate: 0,
    sendDefaultPii: false,
    beforeSend: scrubEvent,
  });
}

export const onRequestError = Sentry.captureRequestError;
