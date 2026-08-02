import Fastify from "fastify";
import cors from "@fastify/cors";
import formbody from "@fastify/formbody";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { config } from "./config/env";
import { chatRoutes } from "./routes/chat";
import { availabilityRoutes } from "./routes/availability";
import { bookingRoutes } from "./routes/bookings";
import { authRoutes } from "./routes/auth";
import { clinicRoutes } from "./routes/clinics";
import { patientAuthRoutes } from "./routes/patient-auth";
import { bookRoutes } from "./routes/book";
import { adminRoutes } from "./routes/admin";
import { webhookRoutes } from "./routes/webhooks";
import { webhookMetaRoutes } from "./routes/webhooksMeta";
import { webhookTwilioRoutes } from "./routes/webhooksTwilio";
import { agendaRoutes } from "./routes/agenda";
import { patientsRoutes } from "./routes/patients";
import { treatmentPlansRoutes } from "./routes/treatmentPlans";
import { dentalQuotesRoutes } from "./routes/dentalQuotes";
import { sessionRoutes } from "./routes/sessions";
import { toothImagesRoutes } from "./routes/toothImages";
import { recallRoutes } from "./routes/recall";
import { paymentRoutes } from "./routes/payments";
import { boletaRoutes } from "./routes/boletas";
import { integrationRoutes } from "./routes/integrations";
import { odontogramRoutes } from "./routes/odontogram";
import { clinicalRecordRoutes } from "./routes/clinicalRecords";
import { waitlistRoutes } from "./routes/waitlist";
import { auditLogRoutes } from "./routes/auditLog";
import { anamnesisRoutes } from "./routes/anamnesis";
import { consentRoutes } from "./routes/consents";
import { labOrderRoutes } from "./routes/labOrders";
import { inventoryRoutes } from "./routes/inventory";
import { startReminderScheduler } from "./services/notifications/reminderService";
import { startRecallScheduler } from "./services/notifications/recallService";
import prisma from "./config/prisma";
import { getSchedulerHealth } from "./services/notifications/schedulerHealth";
import { getOpenRouterCredits } from "./services/ai/creditsService";
import { startRecoveryScheduler } from "./services/agent/agentRecovery";

const isProd = config.nodeEnv === "production";

const app = Fastify({
  logger: isProd
    ? { level: "warn", serializers: { req: (req) => ({ method: req.method, url: req.url }) } }
    : { level: "info" },
});

app.register(helmet, {
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
});

app.register(rateLimit, {
  global: true,
  max: 120,
  timeWindow: "1 minute",
  keyGenerator: (req) => (req.headers.authorization ?? req.ip) as string,
  errorResponseBuilder: () => ({ error: "Demasiadas solicitudes. Intenta de nuevo en un minuto." }),
});

app.register(cors, {
  origin: isProd
    ? [config.frontendUrl, /\.molari\.ai$/, /\.vercel\.app$/]
    : true,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false,
});

app.register(formbody);
app.register(chatRoutes, { prefix: "/api" });
app.register(availabilityRoutes, { prefix: "/api" });
app.register(bookingRoutes, { prefix: "/api" });
app.register(authRoutes, { prefix: "/api" });
app.register(clinicRoutes, { prefix: "/api" });
app.register(patientAuthRoutes, { prefix: "/api" });
app.register(bookRoutes, { prefix: "/api" });
app.register(adminRoutes, { prefix: "/api" });
app.register(webhookRoutes, { prefix: "/api" });
app.register(webhookMetaRoutes, { prefix: "/api" });
app.register(webhookTwilioRoutes, { prefix: "/api" });
app.register(agendaRoutes, { prefix: "/api" });
app.register(patientsRoutes, { prefix: "/api" });
app.register(treatmentPlansRoutes, { prefix: "/api" });
app.register(dentalQuotesRoutes, { prefix: "/api" });
app.register(sessionRoutes, { prefix: "/api" });
app.register(toothImagesRoutes, { prefix: "/api" });
app.register(recallRoutes, { prefix: "/api" });
app.register(paymentRoutes, { prefix: "/api" });
app.register(boletaRoutes, { prefix: "/api" });
app.register(integrationRoutes, { prefix: "/api" });
app.register(odontogramRoutes, { prefix: "/api" });
app.register(clinicalRecordRoutes, { prefix: "/api" });
app.register(waitlistRoutes, { prefix: "/api" });
app.register(auditLogRoutes, { prefix: "/api" });
app.register(anamnesisRoutes, { prefix: "/api" });
app.register(consentRoutes, { prefix: "/api" });
app.register(labOrderRoutes, { prefix: "/api" });
app.register(inventoryRoutes, { prefix: "/api" });

// Health check para monitoreo externo (UptimeRobot, etc.) y diagnóstico (#58).
// Devuelve 503 solo si la DB está caída (la clínica no puede operar); un
// scheduler atrasado o una IA sin key dan "degraded" con 200, para no gatillar
// una alerta de "sitio caído" cuando el servicio en realidad responde.
app.get("/health", async (_req, reply) => {
  const t0 = Date.now();
  let db: { ok: boolean; latencyMs?: number; error?: string };
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = { ok: true, latencyMs: Date.now() - t0 };
  } catch (e) {
    db = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  const schedulers = getSchedulerHealth();

  // Saldo: solo el estado, NUNCA el monto — /health es público y lo consulta
  // el monitoreo externo sin autenticarse. El detalle va en /api/admin/credits.
  // "unknown" cubre tanto "sin key" como "OpenRouter no respondió".
  const credits = await getOpenRouterCredits();
  const ai = {
    openRouter: Boolean(config.openRouter.apiKey),
    groq: Boolean(config.groq.apiKey),
    credits: credits ? (credits.low ? "low" : "ok") : "unknown",
  };

  const schedulersOk = schedulers.every((s) => s.ok);
  const aiOk = ai.openRouter || ai.groq; // al menos un proveedor configurado
  const creditsOk = ai.credits !== "low";
  const status = !db.ok ? "down" : schedulersOk && aiOk && creditsOk ? "ok" : "degraded";

  return reply.code(db.ok ? 200 : 503).send({
    status,
    project: "molari.ai",
    timestamp: new Date().toISOString(),
    uptimeSec: Math.round(process.uptime()),
    checks: { db, schedulers, ai },
  });
});

app.listen({ port: config.port, host: "0.0.0.0" }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  startReminderScheduler();
  startRecallScheduler();
  startRecoveryScheduler();
});
