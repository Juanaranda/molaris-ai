import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import { hookErrorInterno, MENSAJE_ERROR_INTERNO } from "../lib/errorInterno";

/**
 * Qué ve la persona cuando algo se rompe de nuestro lado.
 *
 * Con la base de beta caída (29/9), el registro mostraba "Internal Server
 * Error" en inglés, y la respuesta traía el error de Prisma con el host de la
 * base. Se prueba con un Fastify real porque lo delicado es cómo interactúa
 * el hook con las respuestas que arman las rutas y los plugins.
 */
function app() {
  const a = Fastify();
  a.addHook("onSend", hookErrorInterno);
  a.get("/revienta", async () => {
    throw new Error("Can't reach database server at `ep-secreto.neon.tech:5432`");
  });
  a.get("/servicio-caido", async (_req, reply) =>
    reply.status(503).send({ error: "WhatsApp no está configurado" }));
  a.get("/mal-pedido", async () => {
    const e = new Error("Falta el RUT") as Error & { statusCode: number };
    e.statusCode = 400;
    throw e;
  });
  a.get("/demasiadas", async (_req, reply) =>
    reply.status(429).send({ statusCode: 429, error: "Too Many Requests", message: "Espera un minuto" }));
  return a;
}

describe("hookErrorInterno", () => {
  it("un error no atrapado sale en español y sin el detalle interno", async () => {
    const res = await app().inject({ url: "/revienta" });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: MENSAJE_ERROR_INTERNO });
    expect(res.body).not.toContain("neon.tech");
    expect(res.body).not.toContain("Internal Server Error");
  });

  it("un 5xx con mensaje propio de la ruta pasa tal cual", async () => {
    const res = await app().inject({ url: "/servicio-caido" });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ error: "WhatsApp no está configurado" });
  });

  it("los 4xx no se tocan, ni siquiera con la forma por defecto", async () => {
    const r400 = await app().inject({ url: "/mal-pedido" });
    expect(r400.statusCode).toBe(400);
    expect(r400.json().message).toBe("Falta el RUT");

    // El 429 del rate-limit es el que se rompió cuando se probó setErrorHandler.
    const r429 = await app().inject({ url: "/demasiadas" });
    expect(r429.statusCode).toBe(429);
    expect(r429.json().message).toBe("Espera un minuto");
  });
});
