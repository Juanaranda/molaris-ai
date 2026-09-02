import { describe, it, expect } from "vitest";
import jwt from "jsonwebtoken";
import { config } from "../config/env";
import { verifyToken } from "../routes/auth";
import {
  emitirTokenPendiente, validarTokenPendiente, hashearCodigosRespaldo,
  consumirCodigoRespaldo, normalizarRespaldo, MINUTOS_TOKEN_PENDIENTE,
} from "../services/auth/twoFactor";
import { generarCodigosRespaldo } from "../lib/totp";

/**
 * Las dos garantías del 2FA que no se ven mirando el endpoint (#68).
 */

describe("token intermedio del login", () => {
  it("vale para el segundo paso y devuelve el usuario", () => {
    const t = emitirTokenPendiente("user-123");
    expect(validarTokenPendiente(t)).toBe("user-123");
  });

  it("NO sirve como sesión: es lo que impide saltarse el código", () => {
    // Si verifyToken lo aceptara, cualquiera que pase la contraseña entraría
    // sin dar nunca el segundo factor y el 2FA sería decorativo.
    const t = emitirTokenPendiente("user-123");
    expect(() => verifyToken(`Bearer ${t}`)).toThrow();
  });

  it("un token de sesión tampoco sirve como token intermedio", () => {
    const sesion = jwt.sign({ userId: "user-123", role: "ADMIN", clinicId: "c1" }, config.jwtSecret);
    expect(validarTokenPendiente(sesion)).toBeNull();
  });

  it("rechaza vencido, vacío y manipulado", () => {
    expect(validarTokenPendiente(undefined)).toBeNull();
    expect(validarTokenPendiente("")).toBeNull();
    expect(validarTokenPendiente("no.es.un.jwt")).toBeNull();

    const vencido = jwt.sign({ userId: "u", stage: "2fa" }, "otra-clave", { expiresIn: "-1m" });
    expect(validarTokenPendiente(vencido)).toBeNull();
  });

  it("dura pocos minutos, no una sesión entera", () => {
    const t = emitirTokenPendiente("user-123");
    const { exp, iat } = jwt.decode(t) as { exp: number; iat: number };
    expect(exp - iat).toBe(MINUTOS_TOKEN_PENDIENTE * 60);
  });
});

describe("códigos de respaldo", () => {
  it("se guardan hasheados: la base filtrada no da acceso", async () => {
    const codigos = generarCodigosRespaldo();
    const hashes = await hashearCodigosRespaldo(codigos);
    for (const c of codigos) expect(hashes).not.toContain(c);
    expect(hashes).toHaveLength(codigos.length);
  });

  it("uno válido entra y queda consumido", async () => {
    const codigos = generarCodigosRespaldo();
    const hashes = await hashearCodigosRespaldo(codigos);

    const r = await consumirCodigoRespaldo(codigos[0], hashes);
    expect(r.valido).toBe(true);
    expect(r.restantes).toHaveLength(hashes.length - 1);

    // El punto de todo esto: el mismo código no sirve dos veces.
    const otraVez = await consumirCodigoRespaldo(codigos[0], r.restantes);
    expect(otraVez.valido).toBe(false);
  });

  it("consumir uno no invalida a los demás", async () => {
    const codigos = generarCodigosRespaldo();
    const hashes = await hashearCodigosRespaldo(codigos);
    const r = await consumirCodigoRespaldo(codigos[0], hashes);
    expect((await consumirCodigoRespaldo(codigos[1], r.restantes)).valido).toBe(true);
  });

  it("se acepta como lo copia la gente: sin guion, con espacios, en minúscula", async () => {
    const hashes = await hashearCodigosRespaldo(["1234-5678"]);
    for (const variante of ["1234-5678", "12345678", " 1234 5678 ", "1234-5678\n"]) {
      expect((await consumirCodigoRespaldo(variante, hashes)).valido).toBe(true);
    }
  });

  it("uno inventado no entra, y no rompe con vacío", async () => {
    const hashes = await hashearCodigosRespaldo(generarCodigosRespaldo());
    expect((await consumirCodigoRespaldo("0000-0000", hashes)).valido).toBe(false);
    expect((await consumirCodigoRespaldo("", hashes)).valido).toBe(false);
  });

  it("normalizar deja solo el contenido comparable", () => {
    expect(normalizarRespaldo(" 1234-5678 ")).toBe("12345678");
  });
});
