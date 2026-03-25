import { FastifyInstance } from "fastify";
import { chatController } from "../controllers/chatController";

export async function chatRoutes(app: FastifyInstance) {
  app.post("/chat", chatController);
}
