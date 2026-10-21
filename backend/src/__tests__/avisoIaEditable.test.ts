import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";

/**
 * La clínica escribe su propio texto antes del aviso de IA (MOL-11, borrador
 * pendiente de revisión legal). Solo se suma: que responde una IA, que los
 * datos se procesan fuera de Chile y el link a la política no se pueden
 * borrar desde el panel.
 */

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: { clinic: { findUnique: vi.fn(), update: vi.fn() } },
}));

vi.mock("../config/prisma", () => ({ default: mockPrisma }));
vi.mock("../routes/auth", () => ({
  verifyToken: () => ({ userId: "u-1", clinicId: "c-1", role: "ADMIN" }),
}));

const { clinicRoutes, ALLOWED_CONFIG_KEYS } = await import("../routes/clinics");
const { avisoPrivacidadWhatsApp, textoAvisoDeLaClinica, MAX_AVISO_CLINICA } = await import("../lib/avisoPrivacidad");

const AURORA = "Clínica Dental Aurora";
const URL = "https://molari-beta.vercel.app";

describe("avisoPrivacidadWhatsApp con el texto de la clínica", () => {
  const aviso = avisoPrivacidadWhatsApp(AURORA, URL, "¡Hola! Soy Sofía, la asistente de la clínica.");

  it("pone el texto de la clínica primero", () => {
    expect(aviso.startsWith("¡Hola! Soy Sofía, la asistente de la clínica.\n\n")).toBe(true);
  });

  it("igual dice que responde una IA, que se procesa fuera de Chile y enlaza la política", () => {
    expect(aviso).toContain(`asistente de inteligencia artificial de ${AURORA}`);
    expect(aviso).toContain("fuera de Chile");
    expect(aviso).toContain(`Política de privacidad (borrador): ${URL}/legal/privacidad`);
  });

  it("sin texto de la clínica queda el aviso de siempre", () => {
    expect(avisoPrivacidadWhatsApp(AURORA, URL, "   ")).toBe(avisoPrivacidadWhatsApp(AURORA, URL));
    expect(avisoPrivacidadWhatsApp(AURORA, URL).startsWith("Antes de seguir:")).toBe(true);
  });
});

describe("textoAvisoDeLaClinica (lo que se lee de config)", () => {
  it("devuelve el texto limpio", () => {
    expect(textoAvisoDeLaClinica({ avisoIa: "  Hola  " })).toBe("Hola");
  });

  it("ignora lo que no es texto o viene vacío", () => {
    expect(textoAvisoDeLaClinica({ avisoIa: 42 })).toBeNull();
    expect(textoAvisoDeLaClinica({ avisoIa: "  " })).toBeNull();
    expect(textoAvisoDeLaClinica({})).toBeNull();
    expect(textoAvisoDeLaClinica(null)).toBeNull();
  });

  it("corta lo que se haya guardado más largo que el máximo", () => {
    expect(textoAvisoDeLaClinica({ avisoIa: "a".repeat(MAX_AVISO_CLINICA + 50) })).toHaveLength(MAX_AVISO_CLINICA);
  });
});

describe("PATCH /clinics/:id — config.avisoIa", () => {
  function app() {
    const a = Fastify({ logger: false });
    a.register(clinicRoutes);
    return a;
  }
  const patch = (config: Record<string, unknown>) =>
    app().inject({ method: "PATCH", url: "/clinics/c-1", headers: { authorization: "Bearer x" }, payload: { config } });
  const configGuardada = () => mockPrisma.clinic.update.mock.calls[0][0].data.config;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.clinic.update.mockImplementation(({ data }) => Promise.resolve({ id: "c-1", name: AURORA, ...data }));
  });

  it("está en la allowlist: si no, todo guardado del perfil falla con 400", () => {
    expect(ALLOWED_CONFIG_KEYS.has("avisoIa")).toBe(true);
  });

  it("guarda el texto sin espacios de más", async () => {
    const res = await patch({ tone: "cercano", avisoIa: "  Hola, soy Sofía.  " });
    expect(res.statusCode).toBe(200);
    expect(configGuardada()).toEqual({ tone: "cercano", avisoIa: "Hola, soy Sofía." });
  });

  it("borrar el texto lo saca de config (y el paciente ve el aviso de siempre)", async () => {
    const res = await patch({ tone: "cercano", avisoIa: "" });
    expect(res.statusCode).toBe(200);
    expect(configGuardada()).toEqual({ tone: "cercano" });
  });

  it("rechaza un texto más largo que el máximo, sin guardar nada", async () => {
    const res = await patch({ avisoIa: "a".repeat(MAX_AVISO_CLINICA + 1) });
    expect(res.statusCode).toBe(400);
    expect(mockPrisma.clinic.update).not.toHaveBeenCalled();
  });

  it("rechaza lo que no es texto", async () => {
    const res = await patch({ avisoIa: { html: "<b>hola</b>" } });
    expect(res.statusCode).toBe(400);
    expect(mockPrisma.clinic.update).not.toHaveBeenCalled();
  });
});
