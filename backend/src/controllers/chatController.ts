import { FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { getAIResponse } from "../services/ai/claudeService";
import prisma from "../config/prisma";
import { config } from "../config/env";
import { sendBookingNotification } from "../services/notifications/whatsappService";
import { buildJuanPrompt } from "../services/ai/promptBuilder";
import { calculateLeadScore } from "../lib/leadScoring";
import { triggerAlert } from "../services/alerts/alertService";

const bodySchema = z.object({
  message: z.string().min(1),
  clinicSlug: z.string().default("galana"),
  sessionId: z.string().optional(),
  slotBooked: z.boolean().optional(),
  isDemoMode: z.boolean().optional(),
  isSandbox: z.boolean().optional(),  // true = /partners/preview, no crea bookings reales
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

  // BUG FIX #8: collect candidate days first, then fetch all booked slots in
  // parallel with Promise.all instead of N sequential awaits inside the loop.
  type DayInfo = { d: Date; iso: string; jsDay: number; isSat: boolean; availDoctors: DoctorConfig[] };
  const candidateDays: DayInfo[] = [];

  for (let i = 1; i <= 5; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const jsDay = d.getDay();
    if (jsDay === 0) continue;
    const availDoctors = doctors.filter((doc) => parseDoctorDays(doc.schedule).includes(jsDay));
    if (availDoctors.length === 0) continue;
    candidateDays.push({ d, iso: isoDate(d), jsDay, isSat: jsDay === 6, availDoctors });
  }

  const bookingResults = await Promise.all(
    candidateDays.map(({ iso }) =>
      prisma.booking.findMany({
        where: {
          clinicId,
          date: { gte: new Date(`${iso}T00:00:00`), lte: new Date(`${iso}T23:59:59`) },
          status: { not: "cancelled" },
        },
        select: { time: true, doctor: true },
      })
    )
  );

  for (let i = 0; i < candidateDays.length; i++) {
    const { d, jsDay, isSat, availDoctors } = candidateDays[i];
    const dayLabel = DAY_NAMES_ES[jsDay];
    const allSlots = generateSlots(isSat);
    const booked = bookingResults[i];

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

// ─── Error classifier ─────────────────────────────────────────────────────────
function classifyError(err: unknown): string {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (msg.includes("timeout") || msg.includes("timed out") || msg.includes("econnreset")) return "timeout";
  if (msg.includes("rate limit") || msg.includes("429") || msg.includes("too many")) return "rate_limit";
  if (msg.includes("content") && msg.includes("filter")) return "content_filter";
  if (msg.includes("404") || msg.includes("not found") || msg.includes("model")) return "model_error";
  if (msg.includes("parse") || msg.includes("json") || msg.includes("syntax")) return "parse_error";
  return "unknown";
}

// ─── Controller ───────────────────────────────────────────────────────────────

export async function chatController(req: FastifyRequest, reply: FastifyReply) {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.flatten() });
  }

  const { message, clinicSlug, sessionId, slotBooked, isDemoMode, isSandbox } = parsed.data;
  const callStart = Date.now();

  try {
    const clinic = await prisma.clinic.findUnique({ where: { slug: clinicSlug } });
    if (!clinic) {
      return reply.status(404).send({ error: `Clínica "${clinicSlug}" no encontrada` });
    }

    let session = sessionId
      ? await prisma.session.findUnique({ where: { id: sessionId } })
      : null;

    // Reject sessions belonging to a different clinic
    if (session && session.clinicId !== clinic.id) session = null;

    if (!session) {
      session = await prisma.session.create({
        data: {
          clinicId: clinic.id,
          channel: isDemoMode ? "demo" : isSandbox ? "sandbox" : "web",
          isSandbox: isSandbox ?? false,
        },
      });
    }

    await prisma.message.create({
      data: { sessionId: session.id, role: "user", content: message },
    });

    const existingCtx = await prisma.patientContext.findUnique({ where: { sessionId: session.id } });

    // Kill switch del agente (#49): si está apagado, no llamamos a la IA.
    // Guardamos el mensaje (ya hecho arriba) y respondemos con fallback humano.
    if (clinic.agentEnabled === false) {
      const fallback = "¡Gracias por tu mensaje! 🙏 En este momento te atiende una persona del equipo; te respondemos a la brevedad.";
      await prisma.message.create({ data: { sessionId: session.id, role: "assistant", content: fallback } });
      return reply.send({ reply: fallback, sessionId: session.id, context: existingCtx, isFarewell: false, showScheduler: false });
    }

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

    const channel = isDemoMode ? "demo" : isSandbox ? "sandbox" : "web";
    if (usage) {
      prisma.usageEvent.create({
        data: {
          clinicId: clinic.id, sessionId: session.id,
          model: usage.model, tier: usage.tier,
          tokensIn: usage.tokensIn, tokensOut: usage.tokensOut,
          costUsd: usage.costUsd, latencyMs: usage.latencyMs,
          success: true, isSandbox: isSandbox ?? false, channel,
        },
      }).catch((e) => console.error("[usage]", e));
    }

    // ── Lead scoring (fire-and-forget) ───────────────────────────────────────
    calculateLeadScore(session.id).catch(console.error);

    // ── Ejecutar booking si el AI lo solicitó ────────────────────────────────
    let finalReply = aiReply;
    let chatBookingConfirmed = false;

    if (bookingAction && !isSandbox) {
      try {
        const { doctor, date, time, patientName, patientRut, service } = bookingAction;

        // Slot conflict check + booking creation are wrapped in a single
        // interactive transaction so that two concurrent requests for the same
        // slot cannot both pass the conflict check before either write completes.
        const startOfDay = new Date(`${date}T00:00:00`);
        const endOfDay   = new Date(`${date}T23:59:59`);
        const requestedDate = new Date(`${date}T12:00:00.000Z`);

        const txResult = await prisma.$transaction(async (tx) => {
          const conflict = await tx.booking.findFirst({
            where: { clinicId: clinic.id, date: { gte: startOfDay, lte: endOfDay }, doctor, time, status: { not: "cancelled" } },
          });
          if (conflict) return { conflict: true, booking: null };

          const booking = await tx.booking.create({
            data: {
              clinicId: clinic.id,
              patientName,
              patientRut: patientRut.replace(/[.\-]/g, ""),
              doctor, date: requestedDate, time,
              service: service ?? null,
              status: "confirmed",
            },
          });
          return { conflict: false, booking };
        });

        if (txResult.conflict) {
          finalReply = `Ese horario (${time} con ${doctor}) acaba de ser reservado por otro paciente. Elige otro horario disponible.`;
        } else {
          const booking = txResult.booking!;

          chatBookingConfirmed = true;
          const dayName = DAY_NAMES_ES[new Date(`${date}T12:00:00`).getDay()];

          // Notificación WhatsApp
          const clinicFull = await prisma.clinic.findUnique({
            where: { id: clinic.id },
            select: { whatsapp: true, name: true, phone: true, waVerified: true, waPhoneId: true, waToken: true },
          });
          if (clinicFull?.whatsapp) {
            const clinicMeta = (clinicFull.waVerified && clinicFull.waPhoneId && clinicFull.waToken)
              ? { phoneId: clinicFull.waPhoneId, token: clinicFull.waToken }
              : undefined;
            sendBookingNotification({
              clinicName: clinicFull.name, clinicWhatsapp: clinicFull.whatsapp, clinicMeta,
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

    // Mostrar picker solo cuando intent=ready_to_book Y el usuario NO especificó ya una hora/fecha concreta.
    // Si ya dijo "el martes a las 14:00", el flujo continúa por chat — el picker sería redundante.
    const alreadyBooked = chatBookingConfirmed || slotBooked || (existingCtx?.slotBooked ?? false);
    // Keep consistent with USER_GAVE_TIME_RE in claudeService: "mañana" is only
    // a scheduling signal when NOT preceded by "de la" (time-of-day phrase).
    const userGaveTime =
      /\b\d{1,2}:\d{2}\b|\b(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|pr[oó]ximo|esta semana|tarde)\b/i.test(message) ||
      /(?<!de\s+la\s+)\b(ma[nñ]ana|pasado\s+ma[nñ]ana)\b/i.test(message);
    const showScheduler =
      !alreadyBooked &&
      !bookingAction &&
      !chatBookingConfirmed &&
      !userGaveTime &&
      context?.intent === "ready_to_book";

    // Adjuntar link solo cuando NO mostramos el picker (fallback para canales sin UI)
    if (!chatBookingConfirmed && !bookingAction && !showScheduler) {
      const hasBookingCue = /(?:aquí|link|enlace)\s*:?\s*$/i.test(aiReply.trim());
      const justReadyToBook = context?.intent === "ready_to_book" && existingCtx?.intent !== "ready_to_book";

      if ((justReadyToBook || hasBookingCue) && !alreadyBooked) {
        const bookingUrl = `${config.frontendUrl}/book/${clinicSlug}?s=${session.id}`;
        finalReply = hasBookingCue
          ? aiReply.trimEnd() + `\n\n👉 ${bookingUrl}`
          : aiReply.replace(/\s+$/, "") + `\n\n👉 ${bookingUrl}`;
      }
    }

    return reply.send({ reply: finalReply, sessionId: session.id, context, isFarewell, showScheduler });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    req.log.error({ err }, `[chat] Error inesperado: ${msg}`);

    triggerAlert({
      kind: "ai_all_providers_down",
      severity: "critical",
      message: `Chat backend lanzó excepción: ${msg.slice(0, 200)}`,
      detail: { errorType: classifyError(err) },
    }).catch(() => {});

    // Intentar registrar el fallo en usage_events para trazabilidad
    try {
      const body = req.body as Record<string, unknown>;
      const slug = typeof body?.clinicSlug === "string" ? body.clinicSlug : "galana";
      const clinic = await prisma.clinic.findUnique({ where: { slug }, select: { id: true } });
      if (clinic) {
        await prisma.usageEvent.create({
          data: {
            clinicId: clinic.id,
            sessionId: typeof body?.sessionId === "string" ? body.sessionId : null,
            model: "unknown", tier: "unknown",
            tokensIn: 0, tokensOut: 0, costUsd: 0,
            latencyMs: Date.now() - callStart,
            success: false,
            errorType: classifyError(err),
            errorMessage: msg.slice(0, 300),
            isSandbox: body?.isSandbox === true,
            channel: body?.isDemoMode === true ? "demo" : body?.isSandbox === true ? "sandbox" : "web",
          },
        });
      }
    } catch { /* no propagar errores del log */ }

    return reply.send({
      reply: "En este momento estamos con alta demanda. Por favor escríbenos directamente al WhatsApp y te atendemos de inmediato. 🦷",
      sessionId: (req.body as { sessionId?: string })?.sessionId ?? null,
      context: null,
      isFarewell: false,
    });
  }
}
