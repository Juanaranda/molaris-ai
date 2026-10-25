/**
 * Portada de "Mi clínica": una predefinida o un color propio "#RRGGBB"
 * (config.portada). El backend valida lo mismo en backend/src/lib/portada.ts;
 * las dos listas tienen que coincidir.
 *
 * Cada portada es un degradé de un solo tono, de oscuro a claro, como la
 * original en azul petróleo: el nombre va debajo, así que no hay texto encima
 * que pierda contraste.
 */
export const PORTADAS = [
  { id: "petroleo", nombre: "Petróleo", colores: ["#0B2F42", "#1A5C7A", "#2B87A8"] },
  { id: "coral",    nombre: "Coral",    colores: ["#7A2E1C", "#C4553B", "#E8907A"] },
  { id: "bosque",   nombre: "Bosque",   colores: ["#173528", "#2F6B4F", "#5E9C7A"] },
  { id: "arena",    nombre: "Arena",    colores: ["#5C4A33", "#9C7F58", "#CDB792"] },
  { id: "grafito",  nombre: "Grafito",  colores: ["#1A2026", "#3A4550", "#66737F"] },
  { id: "noche",    nombre: "Noche",    colores: ["#121937", "#26336A", "#4A5DA8"] },
] as const;

export type IdPortada = (typeof PORTADAS)[number]["id"];

const HEX = /^#[0-9a-fA-F]{6}$/;

export function esColorPropio(valor: string | undefined): valor is string {
  return !!valor && HEX.test(valor);
}

/** El fondo CSS de la portada guardada; sin valor (o uno raro), la de petróleo. */
export function fondoPortada(valor: string | undefined): string {
  if (esColorPropio(valor)) {
    return `linear-gradient(130deg, color-mix(in srgb, ${valor} 55%, black) 0%, ${valor} 55%, color-mix(in srgb, ${valor} 70%, white) 100%)`;
  }
  const p = PORTADAS.find((x) => x.id === valor) ?? PORTADAS[0];
  return `linear-gradient(130deg, ${p.colores[0]} 0%, ${p.colores[1]} 55%, ${p.colores[2]} 100%)`;
}
