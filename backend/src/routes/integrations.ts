import type { FastifyInstance } from "fastify";
import prisma from "../config/prisma";
import { verifyToken } from "./auth";

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
      },
      sii: {
        verified:     c.siiVerified,
        rutEmisor:    c.siiRutEmisor,
        razonSocial:  c.siiRazonSocial,
        giro:         c.siiGiro,
        documentType: c.siiDocumentType,
        exenta:       c.siiExenta,
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

  // ════════════════════════════════════════════════════════════════════════════
  // SII / OpenFactura
  // ════════════════════════════════════════════════════════════════════════════

  // PATCH /api/clinics/:id/integrations/sii — guardar config SII
  app.patch<{
    Params: { id: string };
    Body: {
      apiKey?:        string | null;
      rutEmisor?:     string | null;
      razonSocial?:   string | null;
      giro?:          string | null;
      documentType?:  number | null;
      exenta?:        boolean;
    };
  }>("/clinics/:id/integrations/sii", async (req, reply) => {
    const g = guard(req);
    if (!g.ok) return reply.status(g.status).send({ error: g.error });

    const { apiKey, rutEmisor, razonSocial, giro, documentType, exenta } = req.body ?? {};

    // Validaciones
    if (apiKey !== undefined && apiKey !== null && (typeof apiKey !== "string" || apiKey.trim().length < 10)) {
      return reply.status(400).send({ error: "API key inválido" });
    }
    if (rutEmisor !== undefined && rutEmisor !== null) {
      if (typeof rutEmisor !== "string" || !/^\d{1,2}\.\d{3}\.\d{3}-[\dkK]$/.test(rutEmisor.trim())) {
        return reply.status(400).send({ error: "RUT inválido — formato esperado: 76.123.456-7" });
      }
    }
    if (documentType !== undefined && documentType !== null && ![39, 41].includes(documentType)) {
      return reply.status(400).send({ error: "Tipo de documento inválido (39 afecta, 41 exenta)" });
    }

    const data: Record<string, unknown> = { siiVerified: false }; // limpiar verificación
    if (apiKey       !== undefined) data.siiApiKey       = apiKey === null ? null : apiKey.trim();
    if (rutEmisor    !== undefined) data.siiRutEmisor    = rutEmisor === null ? null : rutEmisor.trim();
    if (razonSocial  !== undefined) data.siiRazonSocial  = razonSocial === null ? null : razonSocial?.trim() || null;
    if (giro         !== undefined) data.siiGiro         = giro === null ? null : giro?.trim() || null;
    if (documentType !== undefined) data.siiDocumentType = documentType;
    if (exenta       !== undefined) data.siiExenta       = Boolean(exenta);

    await prisma.clinic.update({ where: { id: req.params.id }, data });
    return reply.send({ ok: true });
  });

  // POST /api/clinics/:id/integrations/sii/verify — validar config SII
  // v1: validación de formato + presencia. Una verificación real requiere
  // emitir un DTE de prueba lo cual gasta folios; lo dejamos al admin.
  app.post<{ Params: { id: string } }>(
    "/clinics/:id/integrations/sii/verify",
    async (req, reply) => {
      const g = guard(req);
      if (!g.ok) return reply.status(g.status).send({ error: g.error });

      const c = await prisma.clinic.findUnique({
        where: { id: req.params.id },
        select: {
          siiApiKey: true, siiRutEmisor: true, siiRazonSocial: true,
          siiGiro: true, siiDocumentType: true,
        },
      });
      if (!c) return reply.status(404).send({ error: "Clínica no encontrada" });

      const missing: string[] = [];
      if (!c.siiApiKey?.trim())     missing.push("apiKey");
      if (!c.siiRutEmisor?.trim())  missing.push("rutEmisor");
      if (!c.siiRazonSocial?.trim()) missing.push("razonSocial");
      if (!c.siiGiro?.trim())       missing.push("giro");
      if (!c.siiDocumentType)       missing.push("documentType");

      if (missing.length > 0) {
        return reply.status(400).send({
          error: "Faltan campos obligatorios",
          missing,
        });
      }

      await prisma.clinic.update({
        where: { id: req.params.id },
        data:  { siiVerified: true },
      });
      return reply.send({
        ok: true,
        message: "Configuración guardada como verificada. La primera emisión real testea el API key.",
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

    if (phoneId !== undefined && phoneId !== null) {
      if (typeof phoneId !== "string" || !/^\d{6,}$/.test(phoneId.trim())) {
        return reply.status(400).send({ error: "Phone Number ID inválido — debe ser numérico (ej: 123456789012345)" });
      }
    }
    if (token !== undefined && token !== null && (typeof token !== "string" || token.trim().length < 20)) {
      return reply.status(400).send({ error: "Token inválido — pegá el System User Access Token permanente" });
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
