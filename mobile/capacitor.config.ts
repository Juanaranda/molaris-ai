import type { CapacitorConfig } from "@capacitor/cli";

/**
 * App de teléfono de molari (MOL-40).
 *
 * Lleva dentro el panel exportado como archivos estáticos (frontend con
 * MOBILE_EXPORT=1, ver frontend/next.config.ts) y habla con el backend por la
 * API, igual que la web. No usa server.url: la documentación de Capacitor lo
 * desaconseja en producción y la app quedaría en blanco sin señal.
 *
 * El backend al que apunta se fija al exportar, con NEXT_PUBLIC_API_URL.
 */
const config: CapacitorConfig = {
  // Identificador en las tiendas. OJO: una vez publicada la app no se puede
  // cambiar. Sigue el dominio molari.ai al revés, como es la convención.
  appId: "ai.molari.app",
  appName: "molari",
  webDir: "../frontend/out",
  backgroundColor: "#FDFCFB",
};

export default config;
