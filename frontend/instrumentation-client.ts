import * as Sentry from "@sentry/nextjs";
import { scrubEvent } from "@/lib/sentryScrub";

/**
 * Sentry en el navegador (#58) — acá caen los errores que ve el doctor: una
 * pantalla en blanco, un botón que no responde. Next 16 corre este archivo
 * antes de que la app sea interactiva.
 *
 * Sin NEXT_PUBLIC_SENTRY_DSN queda apagado. La variable va con NEXT_PUBLIC_
 * porque se necesita en el cliente; un DSN no es un secreto (solo permite
 * mandar eventos al proyecto), a diferencia del auth token de source maps.
 */
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    tracesSampleRate: 0,
    sendDefaultPii: false,
    // Replay grabaría la pantalla con la ficha del paciente adentro. No va.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    beforeSend: scrubEvent,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
