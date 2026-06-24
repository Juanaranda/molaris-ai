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
import { startReminderScheduler } from "./services/notifications/reminderService";
import { startRecallScheduler } from "./services/notifications/recallService";

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
    ? [config.frontendUrl, /\.molari\.ai$/]
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

app.get("/health", async () => ({ status: "ok", project: "molari.ai" }));

app.listen({ port: config.port, host: "0.0.0.0" }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  startReminderScheduler();
  startRecallScheduler();
});
