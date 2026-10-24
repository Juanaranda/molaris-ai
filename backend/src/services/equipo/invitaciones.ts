import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import prisma from "../../config/prisma";
import { config } from "../../config/env";
import { isValidRut, formatRut } from "../../lib/rut";
import { telefonoE164 } from "../../lib/telefono";
import { sinPrefijo } from "../../lib/doctores";
import { sendMolariEmail } from "../email/molariEmails";

/**
 * Invitar a un profesional para que complete su perfil y cree su cuenta (MOL-54).
 *
 * El admin de la clínica pone lo que sepa (todo opcional) y le manda un link.
 * El profesional pone lo suyo: nombres, RUT, WhatsApp y su contraseña; también
 * puede ajustar especialidad y días. Su cuenta queda unida a su perfil
 * (`userId` en config.doctors) y desde ahí lo sigue editando él.
 *
 * El token viaja solo en el link: se guarda su hash, dura 7 días y sirve una
 * vez. Generar uno nuevo invalida los anteriores de ese profesional.
 */

export const DIAS_VIGENCIA = 7;
const DIAS_SEMANA = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

type Obj = Record<string, unknown>;
const esObj = (d: unknown): d is Obj => !!d && typeof d === "object" && !Array.isArray(d);

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generarToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function linkInvitacion(token: string): string {
  return `${config.frontendUrl}/invitacion/${token}`;
}

/* ── Lo que escribe el profesional ───────────────────────────────────────── */

export type PerfilProfesional = {
  nombres: string;
  apellidos: string;
  rut?: string;
  phone?: string;
  email: string;
  password: string;
  specialty?: string;
  days?: string[];
};


export function validarPerfil(body: unknown): { ok: true; perfil: PerfilProfesional } | { ok: false; error: string } {
  const b = esObj(body) ? body : {};
  const texto = (v: unknown, max = 80) => (typeof v === "string" ? v.trim().slice(0, max) : "");

  const nombres = sinPrefijo(texto(b.nombres, 60));
  const apellidos = texto(b.apellidos, 60);
  if (!nombres || !apellidos) return { ok: false, error: "Escribe tus nombres y tus apellidos." };

  const email = texto(b.email, 120).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Escribe un correo válido." };

  const password = typeof b.password === "string" ? b.password : "";
  if (password.length < 8) return { ok: false, error: "La contraseña debe tener al menos 8 caracteres." };

  if (b.aceptaTerminos !== true) return { ok: false, error: "Para crear tu cuenta tienes que aceptar los términos." };

  const perfil: PerfilProfesional = { nombres, apellidos, email, password };

  const rut = texto(b.rut, 20);
  if (rut) {
    if (!isValidRut(rut)) return { ok: false, error: "El RUT no es válido. Revisa el dígito verificador." };
    perfil.rut = formatRut(rut);
  }

  const telefono = texto(b.phone, 30);
  if (telefono) {
    const e164 = telefonoE164(telefono);
    if (!e164) return { ok: false, error: "Escribe un celular válido, por ejemplo 9 1234 5678." };
    perfil.phone = e164;
  }

  const specialty = texto(b.specialty);
  if (specialty) perfil.specialty = specialty;

  if (Array.isArray(b.days)) {
    const days = [...new Set(b.days.filter((d): d is string => typeof d === "string" && DIAS_SEMANA.includes(d)))];
    if (days.length === 0) return { ok: false, error: "Marca al menos un día de atención." };
    perfil.days = days;
  }

  return { ok: true, perfil };
}

/** Escribe el perfil en el profesional de la lista. null si ya no está en la clínica. */
export function aplicarPerfil(doctors: unknown, doctorId: string, perfil: PerfilProfesional, userId: string): Obj[] | null {
  if (!Array.isArray(doctors)) return null;
  let encontrado = false;
  const salida = doctors.filter(esObj).map((d) => {
    if (d.id !== doctorId) return d;
    encontrado = true;
    const { password: _p, ...datos } = perfil;
    void _p;
    return {
      ...d,
      ...datos,
      name: `${perfil.nombres} ${perfil.apellidos}`,
      userId,
    };
  });
  return encontrado ? salida : null;
}

/* ── Crear, leer y aceptar ───────────────────────────────────────────────── */

export async function crearInvitacion(opts: { clinicId: string; doctorId: string; creadaPor: string }):
  Promise<
    | { ok: true; link: string; expiresAt: Date; enviadaA?: string; redirigidaA?: string }
    | { ok: false; motivo: "no_existe" | "ya_tiene_cuenta" }
  > {
  const clinica = await prisma.clinic.findUnique({ where: { id: opts.clinicId }, select: { name: true, config: true } });
  const doctores = (clinica?.config as Obj | null)?.doctors;
  const doctor = Array.isArray(doctores) ? doctores.filter(esObj).find((d) => d.id === opts.doctorId) : undefined;
  if (!clinica || !doctor) return { ok: false, motivo: "no_existe" };
  if (doctor.userId) return { ok: false, motivo: "ya_tiene_cuenta" };

  const email = typeof doctor.email === "string" && doctor.email.trim() ? doctor.email.trim().toLowerCase() : undefined;
  const { token, hash } = generarToken();
  const expiresAt = new Date(Date.now() + DIAS_VIGENCIA * 86_400_000);
  const link = linkInvitacion(token);

  // Un link nuevo deja sin efecto los anteriores de este profesional.
  await prisma.invitacionProfesional.deleteMany({ where: { clinicId: opts.clinicId, doctorId: opts.doctorId, usadaAt: null } });
  const inv = await prisma.invitacionProfesional.create({
    data: { clinicId: opts.clinicId, doctorId: opts.doctorId, email, tokenHash: hash, expiresAt, creadaPor: opts.creadaPor },
  });

  if (!email) return { ok: true, link, expiresAt };

  const envio = await sendMolariEmail({
    to: email,
    toName: typeof doctor.nombres === "string" ? doctor.nombres : "",
    message: { type: "invitacion_profesional", clinicName: clinica.name, link, dias: DIAS_VIGENCIA },
  });
  // Solo cuenta como enviado al profesional si le llegó a él (no redirigido).
  if (envio.delivered && !envio.redirectedTo) {
    await prisma.invitacionProfesional.update({ where: { id: inv.id }, data: { enviadaPorCorreo: true } });
  }
  return {
    ok: true, link, expiresAt,
    enviadaA: envio.delivered ? email : undefined,
    redirigidaA: envio.redirectedTo,
  };
}

type EstadoInvitacion = "no_existe" | "vencida" | "usada";

async function buscarVigente(token: string) {
  if (typeof token !== "string" || token.length < 20 || token.length > 100) return { ok: false as const, motivo: "no_existe" as EstadoInvitacion };
  const inv = await prisma.invitacionProfesional.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { clinic: { select: { id: true, name: true, active: true, config: true } } },
  });
  if (!inv || !inv.clinic.active) return { ok: false as const, motivo: "no_existe" as EstadoInvitacion };
  if (inv.usadaAt) return { ok: false as const, motivo: "usada" as EstadoInvitacion };
  if (inv.expiresAt.getTime() < Date.now()) return { ok: false as const, motivo: "vencida" as EstadoInvitacion };
  const doctores = (inv.clinic.config as Obj | null)?.doctors;
  const doctor = Array.isArray(doctores) ? doctores.filter(esObj).find((d) => d.id === inv.doctorId) : undefined;
  if (!doctor) return { ok: false as const, motivo: "no_existe" as EstadoInvitacion };
  return { ok: true as const, inv, doctor };
}

/** Lo que ve el profesional al abrir el link: solo lo que el admin ya puso de él. */
export async function leerInvitacion(token: string) {
  const r = await buscarVigente(token);
  if (!r.ok) return r;
  const d = r.doctor;
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    ok: true as const,
    clinica: r.inv.clinic.name,
    profesional: {
      nombres: s(d.nombres) || (d.nombres === undefined ? s(d.name) : ""),
      apellidos: s(d.apellidos),
      specialty: s(d.specialty),
      days: Array.isArray(d.days) ? d.days.filter((x): x is string => typeof x === "string") : [],
      email: s(d.email) || s(r.inv.email),
    },
  };
}

export async function aceptarInvitacion(token: string, body: unknown):
  Promise<
    | { ok: true; userId: string }
    | { ok: false; motivo: EstadoInvitacion | "correo_en_uso" | "datos"; error?: string }
  > {
  const r = await buscarVigente(token);
  if (!r.ok) return r;
  const v = validarPerfil(body);
  if (!v.ok) return { ok: false, motivo: "datos", error: v.error };
  const perfil = v.perfil;

  if (await prisma.partnerUser.findUnique({ where: { email: perfil.email }, select: { id: true } })) {
    return { ok: false, motivo: "correo_en_uso" };
  }

  const passwordHash = await bcrypt.hash(perfil.password, 12);
  const especialista = !!perfil.specialty && !/general/i.test(perfil.specialty);
  const correoVerificado = r.inv.enviadaPorCorreo && r.inv.email === perfil.email;

  try {
    const userId = await prisma.$transaction(async (tx) => {
      // Se relee la clínica dentro de la transacción: si el admin guardó cambios
      // mientras el profesional llenaba el formulario, no se pisan.
      const clinica = await tx.clinic.findUniqueOrThrow({ where: { id: r.inv.clinicId }, select: { config: true } });
      const user = await tx.partnerUser.create({
        data: {
          clinicId: r.inv.clinicId,
          name: `${perfil.nombres} ${perfil.apellidos}`,
          email: perfil.email,
          passwordHash,
          role: "USER",
          clinicalRole: especialista ? "SPECIALIST" : "GENERAL_DENTIST",
          occupation: perfil.specialty ?? null,
          phone: perfil.phone ?? null,
          acceptedTermsAt: new Date(),
          emailVerifiedAt: correoVerificado ? new Date() : null,
          active: true,
        },
        select: { id: true },
      });
      const doctores = aplicarPerfil((clinica.config as Obj | null)?.doctors, r.inv.doctorId, perfil, user.id);
      if (!doctores) throw new Error("PROFESIONAL_ELIMINADO");
      await tx.clinic.update({
        where: { id: r.inv.clinicId },
        data: { config: { ...(clinica.config as Obj), doctors: doctores } as Prisma.InputJsonValue },
      });
      // Solo si sigue sin usar: dos envíos simultáneos del mismo link no crean dos cuentas.
      const marcada = await tx.invitacionProfesional.updateMany({ where: { id: r.inv.id, usadaAt: null }, data: { usadaAt: new Date() } });
      if (marcada.count !== 1) throw new Error("INVITACION_USADA");
      return user.id;
    });
    return { ok: true, userId };
  } catch (e) {
    if (e instanceof Error && e.message === "PROFESIONAL_ELIMINADO") return { ok: false, motivo: "no_existe" };
    if (e instanceof Error && e.message === "INVITACION_USADA") return { ok: false, motivo: "usada" };
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: false, motivo: "correo_en_uso" };
    throw e;
  }
}

/* ── El profesional edita su perfil después (MOL-54) ─────────────────────── */

export type EdicionPerfil = Omit<PerfilProfesional, "email" | "password">;

/** Mismas reglas que al aceptar, sin correo ni contraseña (esos van por su cuenta). */
export function validarEdicion(body: unknown): { ok: true; perfil: EdicionPerfil } | { ok: false; error: string } {
  const b = esObj(body) ? body : {};
  const v = validarPerfil({ ...b, email: "x@x.cl", password: "xxxxxxxx", aceptaTerminos: true });
  if (!v.ok) return v;
  const { email: _e, password: _p, ...perfil } = v.perfil;
  void _e; void _p;
  // Vaciar el RUT o el WhatsApp es válido: se borran.
  if (typeof b.rut === "string" && !b.rut.trim()) perfil.rut = "";
  if (typeof b.phone === "string" && !b.phone.trim()) perfil.phone = "";
  return { ok: true, perfil };
}

/** El perfil del profesional unido a esta cuenta, o null si no es profesional de la clínica. */
export async function miPerfilProfesional(userId: string, clinicId: string) {
  const clinica = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { name: true, config: true } });
  const doctores = (clinica?.config as Obj | null)?.doctors;
  const d = Array.isArray(doctores) ? doctores.filter(esObj).find((x) => x.userId === userId) : undefined;
  if (!clinica || !d) return null;
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    clinica: clinica.name,
    perfil: {
      nombres: s(d.nombres), apellidos: s(d.apellidos), rut: s(d.rut), phone: s(d.phone),
      specialty: s(d.specialty),
      days: Array.isArray(d.days) ? d.days.filter((x): x is string => typeof x === "string") : [],
    },
  };
}

export async function editarMiPerfil(userId: string, clinicId: string, perfil: EdicionPerfil): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const clinica = await tx.clinic.findUnique({ where: { id: clinicId }, select: { config: true } });
    const doctores = (clinica?.config as Obj | null)?.doctors;
    if (!clinica || !Array.isArray(doctores) || !doctores.some((d) => esObj(d) && d.userId === userId)) return false;
    const nombre = `${perfil.nombres} ${perfil.apellidos}`;
    const nuevos = doctores.map((d) => {
      if (!esObj(d) || d.userId !== userId) return d;
      const actualizado: Obj = { ...d, ...perfil, name: nombre };
      if (perfil.rut === "") delete actualizado.rut;
      if (perfil.phone === "") delete actualizado.phone;
      return actualizado;
    });
    await tx.clinic.update({
      where: { id: clinicId },
      data: { config: { ...(clinica.config as Obj), doctors: nuevos } as Prisma.InputJsonValue },
    });
    // El nombre y el teléfono de su cuenta van a la par con su perfil.
    await tx.partnerUser.update({
      where: { id: userId },
      data: { name: nombre, phone: perfil.phone || null, occupation: perfil.specialty ?? undefined },
    });
    return true;
  });
}
