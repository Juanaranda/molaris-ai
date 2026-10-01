import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

/**
 * La subida de source maps solo se activa si están las tres variables. Falta
 * alguna —desarrollo local, CI, el build de un colaborador— y el build sigue
 * igual, sin warnings ni pasos que fallen.
 *
 * SENTRY_AUTH_TOKEN es un secreto de verdad (permite escribir en el proyecto de
 * Sentry): va en Vercel, nunca en el repo ni con prefijo NEXT_PUBLIC_.
 */
const subirSourceMaps = Boolean(
  process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT
);

// Build para la app de teléfono (MOL-40): Capacitor lleva los archivos dentro
// de la app en vez de cargar el sitio desde internet, que su documentación
// desaconseja para producción. Solo cambia este build; el de Vercel sigue igual.
const paraApp = process.env.MOBILE_EXPORT === "1";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // Para que el código sepa si corre dentro de la app (lib/rutasApp.ts).
  env: { NEXT_PUBLIC_APP_MOVIL: paraApp ? "1" : "0" },
  ...(paraApp ? {
    output: "export" as const,
    // Sin servidor no hay quién optimice imágenes: se sirven tal cual.
    images: { unoptimized: true },
    // /login/index.html en vez de /login.html: así Capacitor encuentra cada página.
    trailingSlash: true,
  } : {}),
  // Los source maps se generan SOLO cuando se van a subir a Sentry. Generarlos
  // sin subirlos los dejaría servidos junto al bundle, o sea publicando el
  // código fuente del panel a cualquiera que abra las herramientas del
  // navegador. Con subida activada se generan, se suben y se borran del build.
  productionBrowserSourceMaps: subirSourceMaps,
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  sourcemaps: {
    disable: !subirSourceMaps,
    // Ojo: esto borra los mapas del build aunque la subida esté desactivada,
    // por eso la generación va atada a la misma condición y no al revés.
    deleteSourcemapsAfterUpload: true,
  },
});
