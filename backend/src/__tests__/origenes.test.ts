import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { origenesPermitidos } from "../lib/origenes";

/**
 * CORS en producción: la web y la app de teléfono entran; un sitio cualquiera
 * no (MOL-40). Se prueba con el plugin real porque lo que importa es qué
 * cabecera devuelve, no cómo está escrita la lista.
 */
async function permite(origen: string) {
  const app = Fastify();
  await app.register(cors, { origin: origenesPermitidos("https://molari-beta.vercel.app"), credentials: false });
  app.get("/x", async () => ({ ok: true }));
  const res = await app.inject({ url: "/x", headers: { origin: origen } });
  return res.headers["access-control-allow-origin"] === origen;
}

describe("origenesPermitidos", () => {
  it("la web y sus previews", async () => {
    expect(await permite("https://molari-beta.vercel.app")).toBe(true);
    expect(await permite("https://molaris-ai-git-dev.vercel.app")).toBe(true);
  });

  it("la app de iPhone y la de Android", async () => {
    expect(await permite("capacitor://localhost")).toBe(true);
    expect(await permite("https://localhost")).toBe(true);
  });

  it("un sitio cualquiera no", async () => {
    expect(await permite("https://sitio-malicioso.com")).toBe(false);
    expect(await permite("http://localhost:3000")).toBe(false);
  });
});
