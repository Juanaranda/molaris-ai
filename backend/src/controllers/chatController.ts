import { FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { getAIResponse } from "../services/ai/claudeService";
import prisma from "../config/prisma";
import { config } from "../config/env";
import { sendBookingNotification } from "../services/notifications/whatsappService";
import { buildJuanPrompt } from "../services/ai/promptBuilder";

const bodySchema = z.object({
  message: z.string().min(1),
  clinicSlug: z.string().default("galana"),
  sessionId: z.string().optional(),
  slotBooked: z.boolean().optional(),
  isDemoMode: z.boolean().optional(),
});

// ─── Helpers de disponibilidad ────────────────────────────────────────────────

const DAY_MAP: Record<string, number> = {
  Dom: 0, Lun: 1, Mar: 2, "Mié": 3, Jue: 4, Vie: 5, "Sáb": 6,
};
const DAY_NAMES_ES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function parseDoctorDays(schedule: string): number[] {
  if (schedule.includes("-")) {
    const [start, end] = schedule.split("-").map((s) => s.trim());
    const s = DAY_MAP[start]; const e = DAY_MAP[end];
    if (s == null || e == null) return [];
    return Array.from({ length: e - s + 1 }, (_, i) => s + i);
  }
  return schedule.split("/").map((d) => DAY_MAP[d.trim()]).filter((d) => d != null);
}

function isoDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function generateSlots(isSat: boolean): string[] {
  const slots: string[] = [];
  for (let h = 10; h < (isSat ? 14 : 18); h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
    slots.push(`${String(h).padStart(2, "0")}:30`);
  }
  return slots;
}

interface DoctorConfig { name: string; specialty: string; schedule: string; }
interface ClinicCfg { doctors?: DoctorConfig[]; }

async function buildAvailabilityHint(clinicId: string, cfg: ClinicCfg): Promise<string> {
  const doctors = cfg.doctors ?? [];
  const lines: string[] = ["## DISPONIBILIDAD PRÓXIMOS 5 DÍAS (usa SOLO estos horarios)"];

  for (let i = 1; i <= 5; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const jsDay = d.getDay();
    if (jsDay === 0) continue;

    const iso = isoDate(d);
    const dayLabel = DAY_NAMES_ES[jsDay];
    const isSat = jsDay === 6;
    const allSlots = generateSlots(isSat);

    const availDoctors = doctors.filter((doc) => parseDoctorDays(doc.schedule).includes(jsDay));
    if (availDoctors.length === 0) continue;

    const startOfDay = new Date(`${iso}T00:00:00`);
    const endOfDay   = new Date(`${iso}T23:59:59`);
    const booked = await prisma.booking.findMany({
      where: { clinicId, date: { gte: startOfDay, lte: endOfDay }, status: { not: "cancelled" } },
      select: { time: true, doctor: true },
    });
    const bookedMap: Record<string, Set<string>> = {};
    for (const b of booked) {
      bookedMap[b.doctor] ??= new Set();
      bookedMap[b.doctor].add(b.time);
    }

    lines.push(`\n${dayLabel} ${d.getDate()}/${d.getMonth() + 1}:`);
    for (const doc of availDoctors) {
      const free = allSlots.filter((t) => !bookedMap[doc.name]?.has(t));
      if (free.length > 0) {
        lines.push(`  ${doc.name} (${doc.specialty}): ${free.slice(0, 8).join(", ")}${free.length > 8 ? "…" : ""}`);
      }
    }
  }

  return lines.join("\n");
}

// ─── Controller ───────────────────────────────────────────────────────────────

export async function chatController(req: FastifyRequest, reply: FastifyReply) {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.flatten() });
  }

  const { message, clinicSlug, sessionId, slotBooked, isDemoMode } = parsed.data;

  try {
    const clinic = await prisma.clinic.findUnique({ where: { slug: clinicSlug } });
    if (!clinic) {
      return reply.status(404).send({ error: `Clínica "${clinicSlug}" no encontrada` });
    }

    let session = sessionId
      ? await prisma.session.findUnique({ where: { id: sessionId } })
      : null;

    if (!session) {
      session = await prisma.session.create({
        data: { clinicId: clinic.id, channel: isDemoMode ? "demo" : "web" },
      });
    }

    await prisma.message.create({
      data: { sessionId: session.id, role: "user", content: message },
    });

    const existingCtx = await prisma.patientContext.findUnique({ where: { sessionId: session.id } });

    // En modo demo Juan no inyecta disponibilidad de citas reales
    let availabilityHint: string | undefined;
    if (!isDemoMode && existingCtx?.intent === "booking_via_chat") {
      availabilityHint = await buildAvailabilityHint(clinic.id, clinic.config as ClinicCfg);
    }

    const { reply: aiReply, context, isFarewell, bookingAction, usage } = await getAIResponse({
      message,
      clinic,
      sessionId: session.id,
      availabilityHint,
      overrideSystemPrompt: isDemoMode ? buildJuanPrompt() : undefined,
      currentContext: {
        patientName:     existingCtx?.patientName     ?? undefined,
        rut:             existingCtx?.rut             ?? undefined,
        email:           existingCtx?.email           ?? undefined,
        serviceInterest: existingCtx?.serviceInterest ?? undefined,
        slotBooked:      slotBooked ?? existingCtx?.slotBooked ?? false,
        intent:          existingCtx?.intent          ?? undefined,
      },
    });

    if (usage) {
      prisma.usageEvent.create({
        data: {
          clinicId: clinic.id, sessionId: session.id,
          model: usage.model, tier: usage.tier,
          tokensIn: usage.tokensIn, tokensOut: usage.tokensOut,
          costUsd: usage.costUsd, latencyMs: usage.latencyMs,
        },
      }).catch((e) => console.error("[usage]", e));
    }

    // ── Ejecutar booking si el AI lo solicitó ────────────────────────────────
    let finalReply = aiReply;
    let chatBookingConfirmed = false;

    if (bookingAction) {
      try {
        const { doctor, date, time, patientName, patientRut, service } = bookingAction;

        // Verificar disponibilidad del slot
        const startOfDay = new Date(`${date}T00:00:00`);
        const endOfDay   = new Date(`${date}T23:59:59`);
        const conflict   = await prisma.booking.findFirst({
          where: { clinicId: clinic.id, date: { gte: startOfDay, lte: endOfDay }, doctor, time, status: { not: "cancelled" } },
        });

        if (conflict) {
          finalReply = `Ese horario (${time} con ${doctor}) acaba de ser reservado por otro paciente. Elige otro horario disponible.`;
        } else {
          const requestedDate = new Date(`${date}T12:00:00.000Z`);
          const booking = await prisma.booking.create({
            data: {
              clinicId: clinic.id,
              patientName,
              patientRut: patientRut.replace(/[.\-]/g, ""),
              doctor, date: requestedDate, time,
              service: service ?? null,
              status: "confirmed",
            },
          });

          chatBookingConfirmed = true;
          const dayName = DAY_NAMES_ES[new Date(`${date}T12:00:00`).getDay()];

          // Notificación WhatsApp
          const clinicFull = await prisma.clinic.findUnique({
            where: { id: clinic.id },
            select: { whatsapp: true, name: true, phone: true },
          });
          if (clinicFull?.whatsapp) {
            sendBookingNotification({
              clinicName: clinicFull.name, clinicWhatsapp: clinicFull.whatsapp,
              patientName, service: service ?? "A confirmar",
              date, dayName, time, doctor, box: null, sessionId: booking.id,
            }).catch(() => {});
          }

          const firstName = patientName.split(" ")[0];
          finalReply = `¡Listo, ${firstName}! Tu cita está confirmada:\n\n📅 ${dayName} ${new Date(`${date}T12:00:00`).toLocaleDateString("es-CL", { day: "numeric", month: "long" })} a las ${time}\n👨‍⚕️ ${doctor}\n\n¡Te esperamos en ${clinic.name}! 🦷`;
        }
      } catch (bookingErr) {
        console.error("[chat] Error creando booking via chat:", bookingErr);
        finalReply = "Tuve un problema al confirmar la cita. Por favor intenta de nuevo o usa el formulario de reserva.";
      }
    }

    await prisma.message.create({
      data: { sessionId: session.id, role: "assistant", content: finalReply },
    });

    if (context) {
      const slotBookedValue = chatBookingConfirmed || slotBooked || existingCtx?.slotBooked || false;
      await prisma.patientContext.upsert({
        where: { sessionId: session.id },
        update: { ...context, slotBooked: slotBookedValue },
        create: { sessionId: session.id, ...context, slotBooked: slotBookedValue },
      });
    }

    // Adjuntar link cuando el bot dice "aquí:" (flujo formulario)
    if (!chatBookingConfirmed && !bookingAction) {
      const hasBookingCue = /(?:aquí|link|enlace)\s*:?\s*$/i.test(aiReply.trim());
      const justReadyToBook = context?.intent === "ready_to_book" && existingCtx?.intent !== "ready_to_book";

      if ((justReadyToBook || hasBookingCue) && !(existingCtx?.slotBooked ?? false)) {
        const bookingUrl = `${config.frontendUrl}/book/${clinicSlug}?s=${session.id}`;
        finalReply = hasBookingCue
          ? aiReply.trimEnd() + `\n\n👉 ${bookingUrl}`
          : aiReply.replace(/\s+$/, "") + `\n\n👉 ${bookingUrl}`;
      }
    }

    return reply.send({ reply: finalReply, sessionId: session.id, context, isFarewell });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    req.log.error({ err }, `[chat] Error inesperado: ${msg}`);
    return reply.send({
      reply: "En este momento estamos con alta demanda. Por favor escríbenos directamente al WhatsApp y te atendemos de inmediato. 🦷",
      sessionId: (req.body as { sessionId?: string })?.sessionId ?? null,
      context: null,
      isFarewell: false,
    });
  }
}
