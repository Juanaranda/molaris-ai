import prisma from "../../config/prisma";
import { config } from "../../config/env";
import { sendWhatsAppMessage } from "../notifications/whatsappService";
import { sendEmail } from "../email/emailService";
import { emitirTokenConfirmacion } from "./confirmation";

/**
 * Avisa al profesional que hay una hora esperando su visto bueno.
 *
 * Va con un link que abre sin iniciar sesión, porque el escenario real es un
 * sábado en la tarde con el celular en la mano — si hay que recordar una
 * contraseña, la hora se queda sin confirmar y el paciente se pierde.
 *
 * Prefiere WhatsApp y cae a correo. Si el profesional no tiene ninguno de los
 * dos configurados, lo dice fuerte en el log: es una hora que va a caducar
 * sola por un dato que falta en la configuración del equipo.
 */

interface DoctorConfig { name?: string; phone?: string; email?: string }

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function contactoDelProfesional(clinicConfig: unknown, nombreDoctor: string): DoctorConfig | null {
  const doctores = (clinicConfig as { doctors?: DoctorConfig[] })?.doctors;
  if (!Array.isArray(doctores)) return null;
  const normal = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
  return doctores.find((d) => d.name && normal(d.name) === normal(nombreDoctor)) ?? null;
}

export interface AvisoConfirmacion {
  bookingId: string;
  /** true = recordatorio, no el primer aviso. Cambia el tono del mensaje. */
  esRecordatorio?: boolean;
}

export async function avisarProfesional({ bookingId, esRecordatorio = false }: AvisoConfirmacion): Promise<
  { enviado: true; via: "whatsapp" | "email" } | { enviado: false; motivo: "sin_contacto" | "no_pendiente" | "fallo_envio" }
> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { clinic: { select: { name: true, config: true, waPhoneId: true, waToken: true, waVerified: true } } },
  });
  if (!booking || booking.status !== "pending") return { enviado: false, motivo: "no_pendiente" };

  const doc = contactoDelProfesional(booking.clinic.config, booking.doctor);
  if (!doc?.phone && !doc?.email) {
    console.warn(
      `[confirmación] ${booking.doctor} no tiene WhatsApp ni correo en la configuración del equipo. ` +
      `La solicitud ${booking.id} va a caducar sin que nadie la vea.`
    );
    return { enviado: false, motivo: "sin_contacto" };
  }

  const token = emitirTokenConfirmacion(booking);
  const link = `${config.frontendUrl}/confirmar/${token}`;
  const dia = DIAS[booking.date.getDay()];
  const fecha = booking.date.toLocaleDateString("es-CL", { day: "numeric", month: "long" });
  const servicio = booking.service ?? "consulta";

  const encabezado = esRecordatorio
    ? `Recordatorio: sigue pendiente una hora por confirmar.`
    : `Un paciente pidió hora contigo.`;

  const texto =
    `${encabezado}\n\n` +
    `${booking.patientName ?? "Paciente"} — ${servicio}\n` +
    `${dia} ${fecha} a las ${booking.time}\n\n` +
    `Confirma o propone otro horario acá:\n${link}`;

  if (doc.phone) {
    try {
      const meta = booking.clinic.waVerified && booking.clinic.waPhoneId && booking.clinic.waToken
        ? { phoneId: booking.clinic.waPhoneId, token: booking.clinic.waToken }
        : undefined;
      await sendWhatsAppMessage(doc.phone, texto, meta);
      return { enviado: true, via: "whatsapp" };
    } catch (err) {
      // Se cae a correo en vez de rendirse: el punto de todo esto es que la
      // solicitud llegue a alguien.
      console.error("[confirmación] WhatsApp falló, se intenta correo:",
        err instanceof Error ? err.message : err);
    }
  }

  if (doc.email) {
    const res = await sendEmail({
      to: doc.email,
      subject: `${esRecordatorio ? "Recordatorio · " : ""}Hora por confirmar — ${booking.patientName ?? "paciente"} el ${dia} ${booking.time}`,
      html:
        `<p>${encabezado}</p>` +
        `<p><strong>${booking.patientName ?? "Paciente"}</strong> — ${servicio}<br>` +
        `${dia} ${fecha} a las ${booking.time}</p>` +
        `<p><a href="${link}" style="background:#1A5C7A;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none;font-weight:bold">Confirmar o proponer otro horario</a></p>` +
        `<p style="color:#888">O copia este enlace:<br>${link}</p>`,
      text: texto,
    });
    if (res.ok) return { enviado: true, via: "email" };
  }

  return { enviado: false, motivo: "fallo_envio" };
}
