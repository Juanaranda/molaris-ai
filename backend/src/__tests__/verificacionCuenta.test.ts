import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Verificación de la cuenta al registrarse (MOL-52): basta con correo O
 * WhatsApp, y hasta verificar la clínica no carga pacientes.
 */

type Usuario = Record<string, unknown> & { id: string };
const db = vi.hoisted(() => ({
  usuarios: new Map<string, Record<string, unknown>>(),
  clinicas: new Map<string, Record<string, unknown>>(),
  enviados: [] as { telefono: string; codigo: string }[],
  entregar: true,
}));

vi.mock("../config/prisma", () => {
  const aplicar = (fila: Record<string, unknown>, data: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(data)) {
      if (v && typeof v === "object" && "increment" in v) fila[k] = (fila[k] as number) + (v as { increment: number }).increment;
      else fila[k] = v;
    }
    return fila;
  };
  return {
    default: {
      partnerUser: {
        findUnique: async ({ where }: { where: { id: string } }) => db.usuarios.get(where.id) ?? null,
        update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) =>
          aplicar(db.usuarios.get(where.id)!, data),
      },
      clinic: {
        findUnique: async ({ where }: { where: { id: string } }) => db.clinicas.get(where.id) ?? null,
        updateMany: async ({ where, data }: { where: { id: string; contactoVerificadoAt: null }; data: Record<string, unknown> }) => {
          const c = db.clinicas.get(where.id);
          if (!c || c.contactoVerificadoAt !== null) return { count: 0 };
          aplicar(c, data);
          return { count: 1 };
        },
      },
    },
  };
});

vi.mock("../services/notifications/codigoPorTelefono", () => ({
  enviarCodigoPorTelefono: async (telefono: string, codigo: string) => {
    db.enviados.push({ telefono, codigo });
    return db.entregar ? { delivered: true, canal: "whatsapp" } : { delivered: false };
  },
}));

const { telefonoE164 } = await import("../lib/telefono");
const { esperaParaReenviar, RESEND_COOLDOWN_SEC } = await import("../services/auth/codigoVerificacion");
const { clinicaPuedeCargarDatos, verificacionPendiente, REGLA_DESDE } = await import("../services/auth/contactoVerificado");
const { issuePhoneCode, verifyPhoneCode } = await import("../services/auth/phoneVerification");

const NUEVA = new Date(REGLA_DESDE.getTime() + 86_400_000);

function sembrar(rol = "ADMIN"): Usuario {
  const u: Usuario = {
    id: "u1", active: true, role: rol, clinicId: "c1", phone: null,
    phoneVerifiedAt: null, phoneVerifyCodeHash: null, phoneVerifyExpiresAt: null,
    phoneVerifyAttempts: 0, phoneVerifySentAt: null,
  };
  db.usuarios.set(u.id, u);
  db.clinicas.set("c1", { id: "c1", contactoVerificadoAt: null, createdAt: NUEVA });
  return u;
}

beforeEach(() => {
  db.usuarios.clear();
  db.clinicas.clear();
  db.enviados = [];
  db.entregar = true;
});

describe("celular en formato internacional", () => {
  it("entiende cómo lo escribe una persona en Chile", () => {
    expect(telefonoE164("9 1234 5678")).toBe("+56912345678");
    expect(telefonoE164("+56 9 1234 5678")).toBe("+56912345678");
    expect(telefonoE164("56912345678")).toBe("+56912345678");
    expect(telefonoE164("(+56) 912345678")).toBe("+56912345678");
  });

  it("respeta un número de otro país si viene con +", () => {
    expect(telefonoE164("+1 415 555 0100")).toBe("+14155550100");
  });

  it("rechaza fijos, números cortos y texto", () => {
    expect(telefonoE164("2 2345 6789")).toBeNull();
    expect(telefonoE164("+56 2 2345 6789")).toBeNull();
    expect(telefonoE164("12345")).toBeNull();
    expect(telefonoE164("hola")).toBeNull();
    expect(telefonoE164("")).toBeNull();
  });
});

describe("espera entre reenvíos", () => {
  it("sin envío previo no hay espera; recién enviado, sí", () => {
    expect(esperaParaReenviar(null)).toBe(0);
    const ahora = Date.now();
    expect(esperaParaReenviar(new Date(ahora), ahora)).toBe(RESEND_COOLDOWN_SEC);
    expect(esperaParaReenviar(new Date(ahora - RESEND_COOLDOWN_SEC * 1000), ahora)).toBe(0);
  });
});

describe("quién puede cargar datos", () => {
  it("una clínica nueva sin verificar no puede; verificada, sí", () => {
    expect(clinicaPuedeCargarDatos({ contactoVerificadoAt: null, createdAt: NUEVA })).toBe(false);
    expect(clinicaPuedeCargarDatos({ contactoVerificadoAt: new Date(), createdAt: NUEVA })).toBe(true);
  });

  it("las clínicas que ya existían siguen trabajando (Galana incluida)", () => {
    expect(clinicaPuedeCargarDatos({ contactoVerificadoAt: null, createdAt: new Date("2026-03-01") })).toBe(true);
  });

  it("una clínica que no existe no puede", async () => {
    expect(await verificacionPendiente("no-existe")).toBe(true);
  });
});

describe("verificar por WhatsApp", () => {
  it("con el código correcto, el usuario y la clínica quedan verificados", async () => {
    sembrar();
    const r = await issuePhoneCode("u1", "9 1234 5678");
    expect(r).toMatchObject({ ok: true, canal: "whatsapp", telefono: "+56912345678" });
    expect(await verificacionPendiente("c1")).toBe(true);

    const { codigo } = db.enviados[0];
    expect(await verifyPhoneCode("u1", codigo)).toEqual({ ok: true });
    expect(db.usuarios.get("u1")!.phoneVerifiedAt).toBeInstanceOf(Date);
    expect(await verificacionPendiente("c1")).toBe(false);
  });

  it("el código no se guarda en claro", async () => {
    sembrar();
    await issuePhoneCode("u1", "912345678");
    const { codigo } = db.enviados[0];
    expect(db.usuarios.get("u1")!.phoneVerifyCodeHash).not.toContain(codigo);
  });

  it("rechaza un celular inválido sin enviar nada", async () => {
    sembrar();
    expect(await issuePhoneCode("u1", "22345678")).toEqual({ ok: false, reason: "invalid_phone" });
    expect(db.enviados).toHaveLength(0);
  });

  it("pide esperar antes de reenviar", async () => {
    sembrar();
    await issuePhoneCode("u1", "912345678");
    expect(await issuePhoneCode("u1", "912345678")).toMatchObject({ ok: false, reason: "cooldown" });
  });

  it("si el envío falla, se puede reintentar al tiro", async () => {
    sembrar();
    db.entregar = false;
    expect(await issuePhoneCode("u1", "912345678")).toEqual({ ok: false, reason: "send_failed" });
    db.entregar = true;
    expect(await issuePhoneCode("u1", "912345678")).toMatchObject({ ok: true });
  });

  it("cinco intentos fallidos bloquean el código", async () => {
    sembrar();
    await issuePhoneCode("u1", "912345678");
    const malo = db.enviados[0].codigo === "000000" ? "111111" : "000000";
    for (let i = 0; i < 4; i++) expect(await verifyPhoneCode("u1", malo)).toMatchObject({ reason: "invalid" });
    expect(await verifyPhoneCode("u1", malo)).toEqual({ ok: false, reason: "too_many_attempts" });
    // Ni siquiera el correcto entra después.
    expect(await verifyPhoneCode("u1", db.enviados[0].codigo)).toEqual({ ok: false, reason: "too_many_attempts" });
  });

  it("un código vencido no sirve", async () => {
    sembrar();
    await issuePhoneCode("u1", "912345678");
    db.usuarios.get("u1")!.phoneVerifyExpiresAt = new Date(Date.now() - 1000);
    expect(await verifyPhoneCode("u1", db.enviados[0].codigo)).toEqual({ ok: false, reason: "expired" });
  });

  it("un usuario invitado (no admin) no verifica la clínica por ella", async () => {
    sembrar("USER");
    await issuePhoneCode("u1", "912345678");
    expect(await verifyPhoneCode("u1", db.enviados[0].codigo)).toEqual({ ok: true });
    expect(await verificacionPendiente("c1")).toBe(true);
  });
});
