import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "./config/env";
import { chatRoutes } from "./routes/chat";
import { availabilityRoutes } from "./routes/availability";

const app = Fastify({ logger: true });

app.register(cors, { origin: true });
app.register(chatRoutes, { prefix: "/api" });
app.register(availabilityRoutes, { prefix: "/api" });

app.get("/health", async () => ({ status: "ok", project: "molaris.ai" }));

app.listen({ port: config.port }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
});
