import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../../config/env";

/**
 * Piezas del segundo factor que no tocan HTTP (#68).
 *
 * Están acá y no en la ruta para poder probarlas: lo que se juega es que un
 * token intermedio no sirva como sesión y que un código de respaldo no se pueda
 * usar dos veces. Ninguna de las dos cosas se ve mirando el endpoint.
 */

/** Minutos que dura el paso intermedio del login. */
export const MINUTOS_TOKEN_PENDIENTE = 5;

/**
 * Clave propia para el token intermedio, derivada del secreto de sesión.
 *
 * Es lo que impide que ese token pase por `verifyToken` y funcione como sesión
 * completa: verifyToken solo comprueba la firma, así que si se firmara con el
 * mismo secreto, quien pasó la contraseña entraría sin dar nunca el código.
 */
function claveIntermedia(): string {
  return crypto.createHmac("sha256", config.jwtSecret).update("2fa-pending-v1").digest("hex");
}

export interface TokenPendiente { userId: string; stage: "2fa" }

/** Token de "ya dio la contraseña, falta el código". */
export function emitirTokenPendiente(userId: string): string {
  return jwt.sign({ userId, stage: "2fa" }, claveIntermedia(), {
    expiresIn: `${MINUTOS_TOKEN_PENDIENTE}m`,
  });
}

/** Devuelve el userId, o null si el token no sirve o venció. */
export function validarTokenPendiente(token: string | undefined): string | null {
  if (!token) return null;
  try {
    const p = jwt.verify(token, claveIntermedia()) as TokenPendiente;
    return p.stage === "2fa" && p.userId ? p.userId : null;
  } catch {
    return null;
  }
}

/** Los de respaldo se guardan como contraseñas: hasheados y de un solo uso. */
export async function hashearCodigosRespaldo(codigos: string[]): Promise<string[]> {
  return Promise.all(codigos.map((c) => bcrypt.hash(normalizarRespaldo(c), 10)));
}

/** Se acepta con o sin guion, en cualquier caja: se copian a mano. */
export function normalizarRespaldo(codigo: string): string {
  return (codigo ?? "").replace(/[\s-]/g, "").toUpperCase();
}

/**
 * Busca el código entre los hashes y devuelve la lista sin él.
 *
 * Devolver la lista restante y no un booleano obliga a quien llama a guardar el
 * consumo: un código de respaldo que sigue sirviendo después de usarlo no es un
 * código de respaldo.
 */
export async function consumirCodigoRespaldo(
  codigo: string,
  hashes: string[],
): Promise<{ valido: boolean; restantes: string[] }> {
  const limpio = normalizarRespaldo(codigo);
  if (!limpio) return { valido: false, restantes: hashes };

  for (let i = 0; i < hashes.length; i++) {
    if (await bcrypt.compare(limpio, hashes[i])) {
      return { valido: true, restantes: hashes.filter((_, j) => j !== i) };
    }
  }
  return { valido: false, restantes: hashes };
}
