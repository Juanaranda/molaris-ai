/**
 * Tests del chatController — simulan conversaciones del agente y verifican
 * que los estados, sesiones y citas queden correctamente registrados.
 *
 * Mocks:
 *  - prisma           → evita base de datos real
 *  - getAIResponse    → controla respuesta del LLM
 *  - sendBookingNotification → evita llamadas a WhatsApp
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";

// ─── Mocks antes de importar el controller ───────────────────────────────────
// vi.mock se hoista al tope del módulo, por lo que las variables declaradas
// con const no están inicializadas aún. vi.hoisted() resuelve esto.

const { mockPrisma, mockGetAIResponse } = vi.hoisted(() => {
  const mockPrisma: {
    clinic:         { findUnique: ReturnType<typeof vi.fn> };
    session:        { findUnique: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
    message:        { create: ReturnType<typeof vi.fn> };
    patientContext: { findUnique: ReturnType<typeof vi.fn>; upsert: ReturnType<typeof vi.fn> };
    booking:        { findFirst: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
    usageEvent:     { create: ReturnType<typeof vi.fn> };
    $transaction:   ReturnType<typeof vi.fn>;
  } = {
    clinic: { findUnique: vi.fn() },
    session: { findUnique: vi.fn(), create: vi.fn() },
    message: { create: vi.fn() },
    patientContext: { findUnique: vi.fn(), upsert: vi.fn() },
    booking: { findFirst: vi.fn(), create: vi.fn() },
    usageEvent: { create: vi.fn() },
    // Mock interactivo: ejecuta la callback con el propio prisma (tx === prisma).
    // Los tests configuran booking.findFirst/create vía mockPrisma directamente.
    $transaction: vi.fn(),
  };
  mockPrisma.$transaction.mockImplementation(async (cb: (tx: typeof mockPrisma) => Promise<unknown>) => cb(mockPrisma));
  const mockGetAIResponse = vi.fn();
  return { mockPrisma, mockGetAIResponse };
});

vi.mock("../config/prisma", () => ({ default: mockPrisma }));
vi.mock("../services/ai/claudeService", () => ({ getAIResponse: mockGetAIResponse }));

vi.mock("../services/notifications/whatsappService", () => ({
  sendBookingNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../services/ai/promptBuilder", () => ({
  buildJuanPrompt: vi.fn().mockReturnValue("system prompt demo"),
}));

// ─── Importar después de los mocks ───────────────────────────────────────────

import { chatController } from "../controllers/chatController";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const CLINIC = {
  id: "clinic-1",
  slug: "galana",
  name: "Galana Clínica Dental",
  whatsapp: "+56912345678",
  phone: null,
  config: {
    doctors: [
      { name: "Dra. Ana Aranda", specialty: "General", schedule: "Lun-Vie" },
      { name: "Dr. Pedro Engel",  specialty: "General", schedule: "Mar/Jue/Sáb" },
    ],
  },
};

const SESSION = { id: "session-abc", clinicId: "clinic-1", channel: "web" };

const AI_BASE = {
  reply: "¿En qué puedo ayudarte?",
  context: null,
  isFarewell: false,
  bookingAction: null,
  usage: null,
};

// ─── Setup de Fastify para inyectar requests ──────────────────────────────────

function buildApp() {
  const app = Fastify({ logger: false });
  app.post("/chat", chatController);
  return app;
}

function post(app: ReturnType<typeof buildApp>, body: Record<string, unknown>) {
  return app.inject({ method: "POST", url: "/chat", payload: body });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("chatController", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = buildApp();

    // Defaults felices
    mockPrisma.clinic.findUnique.mockResolvedValue(CLINIC);
    mockPrisma.session.findUnique.mockResolvedValue(null);
    mockPrisma.session.create.mockResolvedValue(SESSION);
    mockPrisma.message.create.mockResolvedValue({});
    mockPrisma.patientContext.findUnique.mockResolvedValue(null);
    mockPrisma.patientContext.upsert.mockResolvedValue({});
    mockPrisma.booking.findFirst.mockResolvedValue(null);
    mockPrisma.booking.create.mockResolvedValue({ id: "booking-1" });
    mockPrisma.usageEvent.create.mockResolvedValue({});
    mockGetAIResponse.mockResolvedValue({ ...AI_BASE });
  });

  // ── 1. Validación de body ──────────────────────────────────────────────────

  it("devuelve 400 si falta el mensaje", async () => {
    const res = await post(app, { clinicSlug: "galana" });
    expect(res.statusCode).toBe(400);
  });

  it("devuelve 400 si el mensaje está vacío", async () => {
    const res = await post(app, { message: "", clinicSlug: "galana" });
    expect(res.statusCode).toBe(400);
  });

  // ── 2. Clínica no encontrada ───────────────────────────────────────────────

  it("devuelve 404 si la clínica no existe", async () => {
    mockPrisma.clinic.findUnique.mockResolvedValue(null);
    const res = await post(app, { message: "Hola", clinicSlug: "no-existe" });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).error).toMatch(/no encontrada/i);
  });

  // ── 3. Consulta general — sin cita ────────────────────────────────────────

  it("consulta general: responde sin crear booking", async () => {
    mockGetAIResponse.mockResolvedValue({
      ...AI_BASE,
      reply: "El precio de limpieza dental es $25.000.",
      context: { serviceInterest: "Limpieza dental", intent: "evaluating", score: 40 },
    });

    const res = await post(app, { message: "¿Cuánto vale una limpieza?", clinicSlug: "galana" });
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body);
    expect(body.reply).toContain("limpieza");
    expect(body.sessionId).toBe("session-abc");

    // No se crea ningún booking
    expect(mockPrisma.booking.create).not.toHaveBeenCalled();
  });

  it("guarda los mensajes de usuario y asistente en la sesión", async () => {
    mockGetAIResponse.mockResolvedValue({ ...AI_BASE, reply: "¡Hola!" });

    await post(app, { message: "Hola", clinicSlug: "galana" });

    expect(mockPrisma.message.create).toHaveBeenCalledTimes(2);
    const calls = mockPrisma.message.create.mock.calls;
    expect(calls[0][0].data.role).toBe("user");
    expect(calls[1][0].data.role).toBe("assistant");
  });

  // ── 4. Intent ready_to_book — agrega link de reserva ──────────────────────

  it("cuando el intent cambia a ready_to_book agrega el link de reserva en el reply", async () => {
    mockGetAIResponse.mockResolvedValue({
      ...AI_BASE,
      reply: "¡Perfecto! Puedes reservar aquí:",
      context: { intent: "ready_to_book", patientName: "Juan", score: 80 },
    });

    const res = await post(app, { message: "Quiero agendar el martes", clinicSlug: "galana" });
    const body = JSON.parse(res.body);

    expect(body.reply).toMatch(/https?:\/\//); // link incluido
    expect(mockPrisma.booking.create).not.toHaveBeenCalled();
  });

  // ── 5. Booking vía chat — agente crea la cita directamente ────────────────

  it("cuando el AI devuelve bookingAction se crea el booking en la DB", async () => {
    const action = {
      doctor:      "Dra. Ana Aranda",
      date:        "2026-05-15",
      time:        "10:00",
      patientName: "María González",
      patientRut:  "12.345.678-9",
      service:     "Limpieza dental",
    };
    mockGetAIResponse.mockResolvedValue({
      ...AI_BASE,
      bookingAction: action,
    });
    mockPrisma.clinic.findUnique
      .mockResolvedValueOnce(CLINIC)       // primera llamada (lookup de clínica)
      .mockResolvedValueOnce({             // segunda llamada (lookup para notificación)
        ...CLINIC, whatsapp: "+56912345678",
      });

    const res = await post(app, { message: "Confirmo el martes a las 10", clinicSlug: "galana" });
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body);
    // El agente NO confirma: deja la solicitud y lo dice. Prometerle una cita
    // al paciente antes de que un humano apruebe es el bug que esto evita.
    expect(body.reply).toMatch(/solicitud/i);
    expect(body.reply).toMatch(/validándola/i);
    expect(body.reply).not.toMatch(/confirmada/i);

    expect(mockPrisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clinicId:    "clinic-1",
          patientName: "María González",
          patientRut:  "123456789",         // RUT normalizado sin puntos/guion
          doctor:      "Dra. Ana Aranda",
          time:        "10:00",
          // Reservada, no confirmada: el cupo queda tomado pero todavía no
          // es una cita.
          status:      "pending",
          requestedVia: "agent",
        }),
      })
    );
  });

  it("booking confirma el RUT sin puntos ni guion", async () => {
    mockGetAIResponse.mockResolvedValue({
      ...AI_BASE,
      bookingAction: {
        doctor: "Dr. Pedro Engel", date: "2026-05-20", time: "11:30",
        patientName: "Carlos Soto", patientRut: "9.876.543-2", service: null,
      },
    });
    mockPrisma.clinic.findUnique.mockResolvedValue(CLINIC);

    await post(app, { message: "Confirmo", clinicSlug: "galana" });

    const call = mockPrisma.booking.create.mock.calls[0][0];
    expect(call.data.patientRut).toBe("98765432");
  });

  // ── 6. Conflicto de horario ────────────────────────────────────────────────

  it("si el slot ya está ocupado responde con mensaje de conflicto y NO crea booking", async () => {
    mockGetAIResponse.mockResolvedValue({
      ...AI_BASE,
      bookingAction: {
        doctor: "Dra. Ana Aranda", date: "2026-05-15", time: "10:00",
        patientName: "Pedro Rojas", patientRut: "11.111.111-1", service: "Implante",
      },
    });
    // Simula conflicto
    mockPrisma.booking.findFirst.mockResolvedValue({ id: "existing-booking" });

    const res = await post(app, { message: "Quiero el martes 10:00", clinicSlug: "galana" });
    const body = JSON.parse(res.body);

    expect(body.reply).toMatch(/reservado/i);
    expect(mockPrisma.booking.create).not.toHaveBeenCalled();
  });

  // ── 7. Sesión reutilizada ──────────────────────────────────────────────────

  it("reutiliza una sesión existente si se pasa sessionId", async () => {
    const existingSession = { id: "session-existente", clinicId: "clinic-1", channel: "web" };
    mockPrisma.session.findUnique.mockResolvedValue(existingSession);
    mockGetAIResponse.mockResolvedValue({ ...AI_BASE, reply: "Bienvenido de vuelta." });

    const res = await post(app, {
      message: "Hola de nuevo", clinicSlug: "galana", sessionId: "session-existente",
    });
    expect(res.statusCode).toBe(200);

    // No crea nueva sesión
    expect(mockPrisma.session.create).not.toHaveBeenCalled();
    expect(JSON.parse(res.body).sessionId).toBe("session-existente");
  });

  // ── 8. Modo demo ──────────────────────────────────────────────────────────

  it("en modo demo crea sesión con channel=demo", async () => {
    mockGetAIResponse.mockResolvedValue({ ...AI_BASE });
    mockPrisma.session.create.mockResolvedValue({ ...SESSION, channel: "demo" });

    await post(app, { message: "Hola", clinicSlug: "galana", isDemoMode: true });

    expect(mockPrisma.session.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ channel: "demo" }) })
    );
  });

  it("en modo demo no llama a buildAvailabilityHint (no consulta slots reales)", async () => {
    // El context existente tiene intent = "booking_via_chat" para provocar hint en modo normal
    mockPrisma.patientContext.findUnique.mockResolvedValue({
      sessionId: "session-abc", intent: "booking_via_chat",
    });
    mockGetAIResponse.mockResolvedValue({ ...AI_BASE });

    await post(app, { message: "¿Cuándo puedo ir?", clinicSlug: "galana", isDemoMode: true });

    // getAIResponse se llama sin availabilityHint cuando isDemoMode = true
    const aiCall = mockGetAIResponse.mock.calls[0][0];
    expect(aiCall.availabilityHint).toBeUndefined();
  });

  // ── 9. Mensaje de despedida ────────────────────────────────────────────────

  it("cuando isFarewell=true lo devuelve en la respuesta", async () => {
    mockGetAIResponse.mockResolvedValue({ ...AI_BASE, isFarewell: true, reply: "¡Hasta luego!" });

    const res = await post(app, { message: "Gracias, chao", clinicSlug: "galana" });
    expect(JSON.parse(res.body).isFarewell).toBe(true);
  });

  // ── 10. Lead que agenda → queda en tabla Booking ─────────────────────────

  it("lead que agenda queda en Booking y puede aparecer como paciente", async () => {
    // Flujo completo: lead consulta → el AI responde con bookingAction (slot confirmado)
    mockGetAIResponse.mockResolvedValue({
      ...AI_BASE,
      reply: "¡Todo listo, Sofía!",
      context: { patientName: "Sofía Muñoz", slotBooked: true, intent: "booking_via_chat", score: 90 },
      bookingAction: {
        doctor:      "Dra. Ana Aranda",
        date:        "2026-05-20",
        time:        "09:00",
        patientName: "Sofía Muñoz",
        patientRut:  "14.567.890-3",
        service:     "Ortodoncia",
      },
    });
    mockPrisma.clinic.findUnique.mockResolvedValue(CLINIC);

    const res = await post(app, {
      message: "Confirmo el miércoles a las 9", clinicSlug: "galana",
    });
    expect(res.statusCode).toBe(200);

    // El Booking se crea — con este registro el lead es derivado como "paciente"
    expect(mockPrisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          patientName: "Sofía Muñoz",
          service:     "Ortodoncia",
          status:      "pending",
        }),
      })
    );

    // El PatientContext se actualiza con slotBooked=true
    expect(mockPrisma.patientContext.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ slotBooked: true }),
      })
    );
  });

  // ── 11. Error del AI — fallback gracioso ──────────────────────────────────

  it("si el AI falla responde con mensaje de fallback sin status 500", async () => {
    mockGetAIResponse.mockRejectedValue(new Error("Timeout"));

    const res = await post(app, { message: "Hola", clinicSlug: "galana" });
    expect(res.statusCode).toBe(200); // nunca 500 al usuario
    expect(JSON.parse(res.body).reply).toMatch(/WhatsApp/i);
  });
});
