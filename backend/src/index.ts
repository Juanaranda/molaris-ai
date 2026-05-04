import Fastify from "fastify";
import cors from "@fastify/cors";
import formbody from "@fastify/formbody";
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
import { agendaRoutes } from "./routes/agenda";
import { patientsRoutes } from "./routes/patients";
import { startReminderScheduler } from "./services/notifications/reminderService";

const app = Fastify({ logger: true });

app.register(cors, { origin: true });
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
app.register(agendaRoutes, { prefix: "/api" });
app.register(patientsRoutes, { prefix: "/api" });

app.get("/health", async () => ({ status: "ok", project: "molari.ai" }));

app.listen({ port: config.port, host: "0.0.0.0" }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  startReminderScheduler();
});
