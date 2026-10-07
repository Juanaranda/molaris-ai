import type { FastifyReply, FastifyRequest } from "fastify";

/**
 * Lo que ve la persona cuando algo se rompe de nuestro lado.
 *
 * Sin esto, Fastify responde {"error":"Internal Server Error","message":...}:
 * el panel mostraba "Internal Server Error" en inglés (visto en el registro de
 * beta con la base caída, 29/9), y el `message` llevaba el error original al
 * navegador — con Prisma, eso incluye el host de la base de datos.
 */
export const MENSAJE_ERROR_INTERNO =
  "Tuvimos un problema de nuestro lado. Intenta de nuevo en unos minutos.";

/**
 * Reescribe solo la respuesta por defecto de Fastify para errores 5xx no
 * atrapados. Las que arma una ruta o un plugin (p.ej. un 503 con su propio
 * mensaje) no traen `statusCode` en el cuerpo y pasan tal cual.
 */
export function reescribirErrorInterno(status: number, payload: unknown): unknown {
  if (status < 500 || typeof payload !== "string") return payload;
  let cuerpo: unknown;
  try { cuerpo = JSON.parse(payload); } catch { return payload; }
  if (
    cuerpo && typeof cuerpo === "object" &&
    typeof (cuerpo as Record<string, unknown>).statusCode === "number" &&
    "message" in cuerpo
  ) {
    return JSON.stringify({ error: MENSAJE_ERROR_INTERNO });
  }
  return payload;
}

/** Hook onSend: el detalle del error ya quedó en Sentry y en el log (onError). */
export async function hookErrorInterno(_req: FastifyRequest, reply: FastifyReply, payload: unknown) {
  return reescribirErrorInterno(reply.statusCode, payload);
}
