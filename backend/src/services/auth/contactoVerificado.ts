import prisma from "../../config/prisma";

/**
 * ¿La clínica comprobó que quien la registró controla su correo o su teléfono?
 * (MOL-52)
 *
 * Para asegurar que quien se registra es quien dice ser, basta con UNO de los
 * dos: correo o WhatsApp, a elección. Que la clínica exista y tenga un
 * profesional habilitado lo cubre otra capa (RUT, RNPI y la aprobación manual).
 *
 * Hasta verificar, la clínica puede mirar y configurar, pero no cargar
 * pacientes ni conectar WhatsApp: así no entran datos reales a una cuenta de
 * dueño desconocido.
 *
 * Las clínicas creadas antes de la regla no se bloquean: no se tocan sus
 * datos (Galana incluida) y siguen trabajando como siempre.
 */
export const REGLA_DESDE = new Date("2026-10-18T03:00:00Z"); // 18 oct 2026, 00:00 en Chile

export function clinicaPuedeCargarDatos(clinica: { contactoVerificadoAt: Date | null; createdAt: Date }): boolean {
  return clinica.contactoVerificadoAt !== null || clinica.createdAt < REGLA_DESDE;
}

export const MENSAJE_VERIFICACION_PENDIENTE =
  "Antes de cargar pacientes o conectar WhatsApp, verifica tu cuenta con un código por correo o por WhatsApp.";

/** Respuesta 403 cuando la clínica todavía no verifica: el front la reconoce por `motivo`. */
export const RESPUESTA_VERIFICACION_PENDIENTE = {
  error: MENSAJE_VERIFICACION_PENDIENTE,
  motivo: "verificacion_pendiente",
} as const;

/** ¿Esta clínica todavía no puede cargar datos? Una clínica que no existe tampoco puede. */
export async function verificacionPendiente(clinicId: string): Promise<boolean> {
  const clinica = await prisma.clinic.findUnique({
    where: { id: clinicId },
    select: { contactoVerificadoAt: true, createdAt: true },
  });
  return !clinica || !clinicaPuedeCargarDatos(clinica);
}

/**
 * Tras verificar correo o teléfono: si quien verificó administra una clínica,
 * la clínica queda verificada. Un usuario invitado por el admin no cuenta (el
 * admin ya respondió por él), pero tampoco hace daño que verifique.
 */
export async function marcarContactoVerificado(userId: string): Promise<void> {
  const u = await prisma.partnerUser.findUnique({ where: { id: userId }, select: { role: true, clinicId: true } });
  if (!u?.clinicId || (u.role !== "ADMIN" && u.role !== "SUPERADMIN")) return;
  await prisma.clinic.updateMany({
    where: { id: u.clinicId, contactoVerificadoAt: null },
    data: { contactoVerificadoAt: new Date() },
  });
}
