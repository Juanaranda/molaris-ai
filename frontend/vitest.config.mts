import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

/**
 * Tests del frontend. El backend ya tenía suite; acá no había ninguna, y el
 * front es donde trabaja el doctor.
 *
 * No corren contra Next: montan componentes sueltos en jsdom. Es a propósito —
 * lo que se quiere cubrir es la lógica que decide qué ve el usuario (búsquedas,
 * estados de un formulario, reglas de negocio en el cliente), no el framework.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    include: ["**/__tests__/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next"],
  },
  resolve: {
    // Mismo alias que tsconfig: sin esto los imports "@/lib/..." no resuelven.
    alias: { "@": path.resolve(import.meta.dirname, ".") },
  },
});
