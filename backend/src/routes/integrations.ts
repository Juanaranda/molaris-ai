import type { FastifyInstance } from "fastify";
import jwt from "jsonwebtoken";
import prisma from "../config/prisma";
import { verifyToken } from "./auth";
import { config } from "../config/env";
import { verificacionPendiente, RESPUESTA_VERIFICACION_PENDIENTE } from "../services/auth/contactoVerificado";
import { AMBIENTE_PRUEBAS, ErrorOpenFactura, organizacion } from "../services/sii/openFacturaService";
import { rutCanonico } from "../lib/rut";

/**
 * Endpoints de configuración de integraciones externas por clínica.
 * Mercado Pago y SII/OpenFactura. Permisos: ADMIN/SUPERADMIN.
 */
export async function integrationRoutes(app: FastifyInstance) {

  function guard(req: { headers: { authorization?: string }; params: { id: string } }):
    | { ok: true;  payload: ReturnType<typeof verifyToken> }
    | { ok: false; status: number; error: string }
  {
    let payload;
    try { payload = verifyToken(req.headers.authorization); }
    catch { return { ok: false, status: 401, error: "No autorizado" }; }
    if (payload.role === "USER") return { ok: false, status: 403, error: "Sin permisos" };
    if (payload.role !== "SUPERADMIN" && payload.clinicId !== req.params.id) {
      return { ok: false, status: 403, error: "Acceso denegado" };
    }
    return { ok: true, payload };
  }

  // ────────────────────────────────────────────────────────────────────────────
  // GET /api/clinics/:id/integrations — devuelve estado de las 3 integraciones
  // ────────────────────────────────────────────────────────────────────────────
  app.get<{ Params: { id: string } }>("/clinics/:id/integrations", async (req, reply) => {
    const g = guard(req);
    if (!g.ok) return reply.status(g.status).send({ error: g.error });

    const c = await prisma.clinic.findUnique({
      where: { id: req.params.id },
      select: {
        waPhoneId: true, waVerified: true,                                // No exponemos waToken
        mpVerified: true,                                                  // No exponemos mpAccessToken
        siiRutEmisor: true, siiRazonSocial: true, siiGiro: true,
        siiDocumentType: true, siiExenta: true, siiVerified: true,         // No exponemos siiApiKey
      },
    });
    if (!c) return reply.status(404).send({ error: "Clínica no encontrada" });

    return reply.send({
      whatsapp: {
        configured: Boolean(c.waPhoneId),
        verified:   c.waVerified,
      },
      mercadopago: {
        verified: c.mpVerified,
        oauthAvailable: Boolean(config.mercadoPago.clientId),
      },
      sii: {
        verified:     c.siiVerified,
        rutEmisor:    c.siiRutEmisor,
        razonSocial:  c.siiRazonSocial,
        giro:         c.siiGiro,
        documentType: c.siiDocumentType,
        exenta:       c.siiExenta,
        pruebas:      AMBIENTE_PRUEBAS,
      },
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // MERCADO PAGO
  // ════════════════════════════════════════════════════════════════════════════

  // PATCH /api/clinics/:id/integrations/mercadopago — guardar accessToken
  app.patch<{
    Params: { id: string };
    Body:   { accessToken?: string | null };
  }>("/clinics/:id/integrations/mercadopago", async (req, reply) => {
    const g = guard(req);
    if (!g.ok) return reply.status(g.status).send({ error: g.error });

    const accessToken = req.body?.accessToken;
    if (accessToken !== null && (typeof accessToken !== "string" || accessToken.trim().length < 10)) {
      return reply.status(400).send({ error: "Access token inválido" });
    }

    await prisma.clinic.update({
      where: { id: req.params.id },
      data: {
        mpAccessToken: accessToken === null ? null : accessToken.trim(),
        mpVerified:    false,  // limpiar verificación al cambiar el token
      },
    });
    return reply.send({ ok: true });
  });

  // POST /api/clinics/:id/integrations/mercadopago/verify — pingear MP /users/me
  app.post<{ Params: { id: string } }>(
    "/clinics/:id/integrations/mercadopago/verify",
    async (req, reply) => {
      const g = guard(req);
      if (!g.ok) return reply.status(g.status).send({ error: g.error });

      const c = await prisma.clinic.findUnique({
        where: { id: req.params.id },
        select: { mpAccessToken: true },
      });
      if (!c?.mpAccessToken) {
        return reply.status(400).send({ error: "Falta guardar el access token primero" });
      }

      try {
        const res = await fetch("https://api.mercadopago.com/users/me", {
          headers: { Authorization: `Bearer ${c.mpAccessToken}` },
        });
        if (!res.ok) {
          const err = await res.text();
          return reply.status(400).send({
            error: "Mercado Pago rechazó el token",
            detail: err.slice(0, 200),
          });
        }
        const user = await res.json() as { id?: number; email?: string; nickname?: string };
        await prisma.clinic.update({
          where: { id: req.params.id },
          data:  { mpVerified: true },
        });
        return reply.send({
          ok: true,
          mpUser: { id: user.id, email: user.email, nickname: user.nickname },
        });
      } catch (err) {
        return reply.status(502).send({
          error: "No se pudo contactar a Mercado Pago",
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    }
  );

  // ── OAuth: "conectar con 1 click" (Issue #48) ─────────────────────────────
  // GET /clinics/:id/integrations/mercadopago/oauth/start
  // Devuelve la URL de autorización de MP con un state firmado que lleva el clinicId.
  app.get<{ Params: { id: string } }>(
    "/clinics/:id/integrations/mercadopago/oauth/start",
    async (req, reply) => {
      const g = guard(req);
      if (!g.ok) return reply.status(g.status).send({ error: g.error });

      if (!config.mercadoPago.clientId) {
        return reply.status(503).send({ error: "OAuth de Mercado Pago no está configurado en el servidor" });
      }

      const state = jwt.sign(
        { clinicId: req.params.id, kind: "mp_oauth" },
        config.jwtSecret,
        { expiresIn: "10m" }
      );
      const redirectUri = `${config.oauthRedirectBase}/api/integrations/mercadopago/oauth/callback`;
      const authUrl =
        `https://auth.mercadopago.cl/authorization?client_id=${encodeURIComponent(config.mercadoPago.clientId)}` +
        `&response_type=code&platform_id=mp` +
        `&state=${encodeURIComponent(state)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}`;

      return reply.send({ authUrl });
    }
  );

  // GET /integrations/mercadopago/oauth/callback — lo llama Mercado Pago (público).
  // Intercambia el code por el access_token y lo guarda en la clínica.
  app.get<{ Querystring: { code?: string; state?: string; error?: string } }>(
    "/integrations/mercadopago/oauth/callback",
    async (req, reply) => {
      const { code, state, error } = req.query;
      const back = (status: string) => reply.redirect(`${config.frontendUrl}/partners/dashboard?mp=${status}`);

      if (error || !code || !state) return back("error");

      let clinicId: string;
      try {
        const payload = jwt.verify(state, config.jwtSecret) as { clinicId: string; kind: string };
        if (payload.kind !== "mp_oauth") throw new Error("bad kind");
        clinicId = payload.clinicId;
      } catch {
        return back("error");
      }

      try {
        const redirectUri = `${config.oauthRedirectBase}/api/integrations/mercadopago/oauth/callback`;
        const res = await fetch("https://api.mercadopago.com/oauth/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id:     config.mercadoPago.clientId,
            client_secret: config.mercadoPago.clientSecret,
            code,
            grant_type:    "authorization_code",
            redirect_uri:  redirectUri,
          }),
        });
        if (!res.ok) return back("error");
        const data = await res.json() as { access_token?: string };
        if (!data.access_token) return back("error");

        await prisma.clinic.update({
          where: { id: clinicId },
          data:  { mpAccessToken: data.access_token, mpVerified: true },
        });
        return back("connected");
      } catch {
        return back("error");
      }
    }
  );

  // ════════════════════════════════════════════════════════════════════════════
  // SII / OpenFactura
  // ════════════════════════════════════════════════════════════════════════════

  // PATCH /api/clinics/:id/integrations/sii — guardar la API key, el RUT y si
  // la boleta es exenta. La razón social y el giro no se escriben a mano: los
  // trae "Verificar" desde OpenFactura, tal como los tiene el SII.
  app.patch<{
    Params: { id: string };
    Body: { apiKey?: string | null; rutEmisor?: string | null; exenta?: boolean };
  }>("/clinics/:id/integrations/sii", async (req, reply) => {
    const g = guard(req);
    if (!g.ok) return reply.status(g.status).send({ error: g.error });

    const { apiKey, rutEmisor, exenta } = req.body ?? {};
    if (apiKey !== undefined && apiKey !== null && (typeof apiKey !== "string" || apiKey.trim().length < 10)) {
      return reply.status(400).send({ error: "API key inválida" });
    }
    const rut = typeof rutEmisor === "string" && rutEmisor.trim() ? rutCanonico(rutEmisor) : null;
    if (typeof rutEmisor === "string" && rutEmisor.trim() && !rut) {
      return reply.status(400).send({ error: "RUT inválido" });
    }
    if (exenta !== undefined && typeof exenta !== "boolean") {
      return reply.status(400).send({ error: "Indica si la boleta es exenta (sí o no)" });
    }

    const data: Record<string, unknown> = { siiVerified: false }; // hay que volver a verificar
    if (apiKey !== undefined) data.siiApiKey = apiKey === null ? null : apiKey.trim();
    if (rutEmisor !== undefined) data.siiRutEmisor = rut;
    // Exenta → boleta 41; afecta → boleta 39. Un solo dato, para que no se contradigan.
    if (exenta !== undefined) { data.siiExenta = exenta; data.siiDocumentType = exenta ? 41 : 39; }

    await prisma.clinic.update({ where: { id: req.params.id }, data });
    return reply.send({ ok: true });
  });

  // POST /api/clinics/:id/integrations/sii/verify — prueba la API key contra
  // OpenFactura (sin emitir nada) y trae los datos de la clínica como los
  // tiene el SII: razón social, giro y RUT.
  app.post<{ Params: { id: string } }>(
    "/clinics/:id/integrations/sii/verify",
    async (req, reply) => {
      const g = guard(req);
      if (!g.ok) return reply.status(g.status).send({ error: g.error });

      const c = await prisma.clinic.findUnique({
        where: { id: req.params.id },
        select: { siiApiKey: true, siiRutEmisor: true },
      });
      if (!c) return reply.status(404).send({ error: "Clínica no encontrada" });
      if (!c.siiApiKey?.trim()) return reply.status(400).send({ error: "Primero guarda la API key de OpenFactura" });

      let emisor;
      try { emisor = await organizacion(c.siiApiKey); }
      catch (e) {
        if (e instanceof ErrorOpenFactura) return reply.status(400).send({ error: e.message });
        throw e;
      }
      const rutDeLaKey = rutCanonico(emisor.rut);
      if (c.siiRutEmisor && rutDeLaKey !== rutCanonico(c.siiRutEmisor)) {
        return reply.status(400).send({
          error: `Esa API key es de otra empresa: ${emisor.razonSocial} (${emisor.rut}). Revisa la key o el RUT.`,
        });
      }

      await prisma.clinic.update({
        where: { id: req.params.id },
        data: { siiVerified: true, siiRutEmisor: rutDeLaKey, siiRazonSocial: emisor.razonSocial, siiGiro: emisor.giro },
      });
      return reply.send({
        ok: true,
        message: `Conectado con OpenFactura como ${emisor.razonSocial} (${emisor.rut}).` +
          (AMBIENTE_PRUEBAS ? " Es el ambiente de pruebas: las boletas no llegan al SII real." : ""),
      });
    }
  );

  // ════════════════════════════════════════════════════════════════════════════
  // WHATSAPP (Meta Cloud API)
  // ════════════════════════════════════════════════════════════════════════════

  // PATCH /api/clinics/:id/integrations/whatsapp — guardar Phone Number ID + token
  app.patch<{
    Params: { id: string };
    Body:   { phoneId?: string | null; token?: string | null };
  }>("/clinics/:id/integrations/whatsapp", async (req, reply) => {
    const g = guard(req);
    if (!g.ok) return reply.status(g.status).send({ error: g.error });

    const { phoneId, token } = req.body ?? {};

    // Conectar exige la cuenta verificada (MOL-52); desconectar, no.
    const conecta = (phoneId !== undefined && phoneId !== null) || (token !== undefined && token !== null);
    if (conecta && g.payload.role !== "SUPERADMIN" && await verificacionPendiente(req.params.id)) {
      return reply.status(403).send(RESPUESTA_VERIFICACION_PENDIENTE);
    }

    if (phoneId !== undefined && phoneId !== null) {
      if (typeof phoneId !== "string" || !/^\d{6,}$/.test(phoneId.trim())) {
        return reply.status(400).send({ error: "Phone Number ID inválido — debe ser numérico (ej: 123456789012345)" });
      }
    }
    if (token !== undefined && token !== null && (typeof token !== "string" || token.trim().length < 20)) {
      return reply.status(400).send({ error: "Token inválido — pega el System User Access Token permanente" });
    }

    const data: Record<string, unknown> = { waVerified: false }; // limpiar verificación al cambiar credenciales
    if (phoneId !== undefined) data.waPhoneId = phoneId === null ? null : phoneId.trim();
    if (token   !== undefined) data.waToken   = token   === null ? null : token.trim();

    await prisma.clinic.update({ where: { id: req.params.id }, data });
    return reply.send({ ok: true });
  });

  // POST /api/clinics/:id/integrations/whatsapp/verify — pingear Meta Graph API
  app.post<{ Params: { id: string } }>(
    "/clinics/:id/integrations/whatsapp/verify",
    async (req, reply) => {
      const g = guard(req);
      if (!g.ok) return reply.status(g.status).send({ error: g.error });

      const c = await prisma.clinic.findUnique({
        where: { id: req.params.id },
        select: { waPhoneId: true, waToken: true },
      });
      if (!c?.waPhoneId || !c?.waToken) {
        return reply.status(400).send({ error: "Falta guardar el Phone Number ID y el token primero" });
      }

      try {
        const res = await fetch(
          `https://graph.facebook.com/v21.0/${c.waPhoneId}?fields=display_phone_number,verified_name,quality_rating`,
          { headers: { Authorization: `Bearer ${c.waToken}` } }
        );
        if (!res.ok) {
          const err = await res.text();
          return reply.status(400).send({
            error: "Meta rechazó las credenciales",
            detail: err.slice(0, 200),
          });
        }
        const num = await res.json() as { display_phone_number?: string; verified_name?: string };
        await prisma.clinic.update({
          where: { id: req.params.id },
          data:  { waVerified: true },
        });
        return reply.send({
          ok: true,
          waNumber: { displayPhone: num.display_phone_number, verifiedName: num.verified_name },
        });
      } catch (err) {
        return reply.status(502).send({
          error: "No se pudo contactar a Meta",
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    }
  );
}
