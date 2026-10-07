/**
 * Desde qué orígenes se puede llamar a la API en producción (CORS).
 *
 * Además de la web, la app de teléfono (MOL-40): Capacitor sirve el panel
 * desde capacitor://localhost en iPhone y https://localhost en Android.
 *
 * Abrirlos no expone sesiones ajenas: la API no usa cookies (credentials:
 * false), la autenticación es un token que guarda la propia app, así que otra
 * página en esos orígenes no puede actuar en nombre de nadie.
 */
export const ORIGENES_APP = ["capacitor://localhost", "https://localhost"] as const;

export function origenesPermitidos(frontendUrl: string): (string | RegExp)[] {
  return [frontendUrl, /\.molari\.ai$/, /\.vercel\.app$/, ...ORIGENES_APP];
}
