/**
 * Tests del webhook de Meta Cloud API — verifican la validación HMAC-SHA256
 * y el endpoint de verificación de Meta.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import crypto from "node:crypto";

const {
  APP_SECRET, VERIFY_TOKEN,
  mockPrisma, mockSendMeta, mockMarkRead, mockGetAI,
} = vi.hoisted(() => ({
  APP_SECRET:   "test_app_secret_for_hmac_validation",
  VERIFY_TOKEN: "test_verify_token_value",
  mockPrisma: {
    clinic:         { findUnique: vi.fn() },
    patient:        { findFirst:  vi.fn(), create: vi.fn() },
    session:        { findFirst:  vi.fn(), create: vi.fn() },
    message:        { create:     vi.fn() },
    patientContext: { findUnique: vi.fn(), upsert: vi.fn() },
    booking:        { create:     vi.fn() },
  },
  mockSendMeta: vi.fn().mockResolvedValue(undefined),
  mockMarkRead: vi.fn().mockResolvedValue(undefined),
  mockGetAI:    vi.fn().mockResolvedValue({ reply: "test reply", context: null }),
}));

vi.mock("../config/env", () => ({
  config: {
    meta: {
      verifyToken: VERIFY_TOKEN,
      appSecret:   APP_SECRET,
    },
  },
}));

vi.mock("../config/prisma", () => ({ default: mockPrisma }));
vi.mock("../services/ai/claudeService", () => ({ getAIResponse: mockGetAI }));
vi.mock("../services/whatsapp/metaService", () => ({
  sendMetaMessage:     mockSendMeta,
  markMetaMessageRead: mockMarkRead,
}));

import { webhookMetaRoutes } from "../routes/webhooksMeta";

function buildApp() {
  const app = Fastify({ logger: false });
  app.register(webhookMetaRoutes);
  return app;
}

function sign(body: string, secret: string): string {
  return "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
}

const SAMPLE_BODY = JSON.stringify({
  object: "whatsapp_business_account",
  entry:  [],
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /webhooks/meta — verificación", () => {
  it("retorna el challenge con verify_token correcto", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/webhooks/meta?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=abc123`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe("abc123");
  });

  it("rechaza con verify_token incorrecto", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/webhooks/meta?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=abc123",
    });
    expect(res.statusCode).toBe(403);
  });

  it("rechaza con hub.mode distinto a 'subscribe'", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/webhooks/meta?hub.mode=unsubscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=abc123`,
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("POST /webhooks/meta — validación HMAC", () => {
  it("rechaza request sin header X-Hub-Signature-256", async () => {
    const app = buildApp();
    const res = await app.inject({
      method:  "POST",
      url:     "/webhooks/meta",
      headers: { "content-type": "application/json" },
      payload: SAMPLE_BODY,
    });
    expect(res.statusCode).toBe(403);
    expect(res.body).toContain("Missing signature");
  });

  it("rechaza request con firma inválida", async () => {
    const app = buildApp();
    const res = await app.inject({
      method:  "POST",
      url:     "/webhooks/meta",
      headers: {
        "content-type":       "application/json",
        "x-hub-signature-256": "sha256=" + "0".repeat(64),
      },
      payload: SAMPLE_BODY,
    });
    expect(res.statusCode).toBe(403);
    expect(res.body).toContain("Invalid signature");
  });

  it("rechaza si la firma fue computada con otro secret", async () => {
    const app = buildApp();
    const wrongSig = sign(SAMPLE_BODY, "secret_diferente");
    const res = await app.inject({
      method:  "POST",
      url:     "/webhooks/meta",
      headers: {
        "content-type":       "application/json",
        "x-hub-signature-256": wrongSig,
      },
      payload: SAMPLE_BODY,
    });
    expect(res.statusCode).toBe(403);
  });

  it("acepta request con firma HMAC-SHA256 válida", async () => {
    const app = buildApp();
    const validSig = sign(SAMPLE_BODY, APP_SECRET);
    const res = await app.inject({
      method:  "POST",
      url:     "/webhooks/meta",
      headers: {
        "content-type":       "application/json",
        "x-hub-signature-256": validSig,
      },
      payload: SAMPLE_BODY,
    });
    expect(res.statusCode).toBe(200);
  });

  it("la firma no se rompe ante manipulación del body", async () => {
    const app = buildApp();
    const validSig = sign(SAMPLE_BODY, APP_SECRET);
    const tamperedBody = SAMPLE_BODY.replace("whatsapp_business_account", "evil_account");
    const res = await app.inject({
      method:  "POST",
      url:     "/webhooks/meta",
      headers: {
        "content-type":       "application/json",
        "x-hub-signature-256": validSig,
      },
      payload: tamperedBody,
    });
    expect(res.statusCode).toBe(403);
  });

  it("procesa el mensaje y llama a Meta cuando la firma es válida", async () => {
    const body = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [{
        id: "entry-1",
        changes: [{
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: { phone_number_id: "PHONE_123", display_phone_number: "+56999" },
            messages: [{
              id:        "msg-1",
              from:      "56987654321",
              type:      "text",
              text:      { body: "hola" },
              timestamp: "1700000000",
            }],
          },
        }],
      }],
    });
    const validSig = sign(body, APP_SECRET);

    mockPrisma.clinic.findUnique.mockResolvedValue({
      id: "c-1", active: true, name: "Test Clinic", waToken: "TOKEN_X", waPhoneId: "PHONE_123",
    });
    mockPrisma.patient.findFirst.mockResolvedValue(null);
    mockPrisma.patient.create.mockResolvedValue({ id: "p-1" });
    mockPrisma.session.findFirst.mockResolvedValue(null);
    mockPrisma.session.create.mockResolvedValue({ id: "s-1" });
    mockPrisma.patientContext.findUnique.mockResolvedValue(null);

    const app = buildApp();
    const res = await app.inject({
      method:  "POST",
      url:     "/webhooks/meta",
      headers: {
        "content-type":       "application/json",
        "x-hub-signature-256": validSig,
      },
      payload: body,
    });

    expect(res.statusCode).toBe(200);
    // Verificar que el mensaje del paciente se procesó y se envió respuesta
    await new Promise((r) => setTimeout(r, 30)); // esperar al async post-200
    expect(mockMarkRead).toHaveBeenCalledWith("PHONE_123", "TOKEN_X", "msg-1");
    expect(mockSendMeta).toHaveBeenCalled();
  });
});
