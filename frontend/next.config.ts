import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // Necesario para que Sentry pueda mapear un stack trace minificado a la línea
  // real del código. Sin esto los errores del front llegan ilegibles.
  productionBrowserSourceMaps: true,
};

/**
 * La subida de source maps solo se activa si están las tres variables. Falta
 * alguna —desarrollo local, CI, un build de un colaborador— y el build sigue
 * igual, sin warnings ni pasos que fallen.
 *
 * SENTRY_AUTH_TOKEN es un secreto de verdad (permite escribir en el proyecto de
 * Sentry): va en Vercel, nunca en el repo ni con prefijo NEXT_PUBLIC_.
 */
const subirSourceMaps = Boolean(
  process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT
);

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  sourcemaps: {
    disable: !subirSourceMaps,
    // Se borran después de subirlas: si quedaran publicadas, cualquiera podría
    // leer el código fuente del panel desde el navegador.
    deleteSourcemapsAfterUpload: true,
  },
  // El túnel evita que los bloqueadores de anuncios se coman los reportes, pero
  // agrega una ruta al servidor; se prende cuando haga falta, no por defecto.
  tunnelRoute: undefined,
});
