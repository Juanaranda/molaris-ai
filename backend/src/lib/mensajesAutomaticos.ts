/**
 * Validación de la encuesta después de la cita (config.postApptSurvey) y de
 * la campaña a pacientes que no han vuelto (config.recallCampaign).
 *
 * Las escribe Configuración. Hasta ahora no estaban en la allowlist, así que
 * el PATCH las rechazaba con 400 y nunca se guardaron. Por ahora solo se
 * guardan: el envío automático todavía no existe (la campaña se manda a mano
 * con POST /clinics/:id/recall/run).
 *
 * Los rangos son los mismos que ofrece el formulario.
 */
export interface EncuestaPostCita { enabled: boolean; hoursAfter: number; message: string }
export interface CampanaInactivos { enabled: boolean; daysInactive: number; message: string }

type Resultado<T> = { ok: true; valor: T } | { ok: false; error: string };

const MAX_MENSAJE = 1000;
const esObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const entero = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
const mensaje = (v: unknown) => typeof v === "string" && v.trim() !== "" && v.length <= MAX_MENSAJE;

export function validarEncuesta(v: unknown): Resultado<EncuestaPostCita | boolean> {
  // Formato antiguo: solo prendida o apagada. El panel lo sigue leyendo.
  if (typeof v === "boolean") return { ok: true, valor: v };
  if (!esObj(v) || typeof v.enabled !== "boolean") return { ok: false, error: "La encuesta no es válida." };
  if (!entero(v.hoursAfter, 1, 72)) return { ok: false, error: "La encuesta se manda entre 1 y 72 horas después de la cita." };
  if (!mensaje(v.message)) return { ok: false, error: `El mensaje de la encuesta tiene que tener entre 1 y ${MAX_MENSAJE} caracteres.` };
  return { ok: true, valor: { enabled: v.enabled, hoursAfter: v.hoursAfter as number, message: (v.message as string).trim() } };
}

export function validarCampanaInactivos(v: unknown): Resultado<CampanaInactivos> {
  if (!esObj(v) || typeof v.enabled !== "boolean") return { ok: false, error: "La campaña no es válida." };
  if (!entero(v.daysInactive, 30, 365)) return { ok: false, error: "Los días sin atenderse tienen que ir entre 30 y 365." };
  if (!mensaje(v.message)) return { ok: false, error: `El mensaje de la campaña tiene que tener entre 1 y ${MAX_MENSAJE} caracteres.` };
  return { ok: true, valor: { enabled: v.enabled, daysInactive: v.daysInactive as number, message: (v.message as string).trim() } };
}
