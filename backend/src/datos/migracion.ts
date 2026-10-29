import type { PrismaClient } from "@prisma/client";

/**
 * Una corrección de datos que el deploy aplica una sola vez por base
 * (src/datos/correr.ts). El esquema lo cambia `prisma db push`; esto arregla
 * lo que ya estaba guardado, para no tener que entrar a la consola de Railway.
 *
 * Reglas:
 * - Tiene que poder correr dos veces sin dañar nada: si falla a la mitad, el
 *   próximo deploy la vuelve a correr entera.
 * - Nunca borra datos clínicos (Ley 20.584).
 * - Lo que escribe en `log` queda en los logs de Railway y en la base: nada de
 *   RUT, nombres ni datos de pacientes, solo cantidades.
 * - El id no se cambia después de publicada: es lo que marca que ya corrió.
 */
export interface MigracionDeDatos {
  id: string;
  descripcion: string;
  /** Con `aplicar` en false solo cuenta lo que haría, sin escribir. */
  correr(prisma: PrismaClient, log: (linea: string) => void, aplicar: boolean): Promise<void>;
}
