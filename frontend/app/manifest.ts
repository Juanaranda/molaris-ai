import type { MetadataRoute } from "next";

// No cambia entre requests; además el build de la app (export estático) lo exige.
export const dynamic = "force-static";

/**
 * Lo que hace instalable a molari en el celular (PWA): en Android, Chrome
 * ofrece "Instalar app"; en iPhone, Safari → Compartir → "Agregar a pantalla
 * de inicio". Es también la base de la app de tiendas (Capacitor).
 *
 * Abre directo en el panel: quien la instala es el equipo de la clínica, no
 * un paciente. Sin sesión, el panel pide entrar.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "molari.ai",
    short_name: "molari",
    description: "Agenda, fichas y pacientes de tu clínica dental.",
    lang: "es-CL",
    start_url: "/partners/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FDFCFB",
    theme_color: "#FDFCFB",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
