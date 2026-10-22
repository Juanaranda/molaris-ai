import { describe, it, expect, vi } from "vitest";

vi.mock("../config/prisma", () => ({ default: {} }));

const { doctoresActivos, protegerDatosDelProfesional } = await import("../lib/doctores");
const { validarPerfil, aplicarPerfil, generarToken, hashToken, validarEdicion } = await import("../services/equipo/invitaciones");

/**
 * Invitar a un profesional (MOL-54): el admin pone lo que sepa y el
 * profesional pone lo suyo. Estas pruebas cuidan quién puede cambiar qué.
 */

describe("profesionales pendientes", () => {
  it("el agente y la agenda solo usan a los que tienen nombre", () => {
    const lista = [{ name: "Ana Rojas" }, { name: "" }, { name: "   " }, { specialty: "Ortodoncia" }];
    expect(doctoresActivos(lista)).toEqual([{ name: "Ana Rojas" }]);
    expect(doctoresActivos(undefined)).toEqual([]);
  });
});

describe("al guardar la lista desde el panel", () => {
  let n = 0;
  const id = () => `nuevo-${++n}`;
  const admin = { userId: "admin-1", esSolo: false };

  it("le da un id a cada profesional y conserva el que ya tenía", () => {
    const r = protegerDatosDelProfesional([{ id: "a", name: "Ana" }, { name: "" }], [], admin, id);
    expect(r[0].id).toBe("a");
    expect(r[1].id).toMatch(/^nuevo-/);
  });

  it("reconoce por nombre a los guardados antes de tener id", () => {
    const r = protegerDatosDelProfesional([{ name: "Ana Rojas", specialty: "Endodoncia" }], [{ name: "Ana Rojas", phone: "+56911111111" }], admin, id);
    expect(r[0].phone).toBe("+56911111111");
  });

  it("el admin no cambia el RUT ni el WhatsApp que puso el profesional", () => {
    const guardados = [{ id: "a", name: "Ana", rut: "12.345.678-5", phone: "+56911111111", userId: "doc-1" }];
    const r = protegerDatosDelProfesional([{ id: "a", name: "Ana Rojas", rut: "11.111.111-1", phone: "+56999999999" }], guardados, admin, id);
    expect(r[0]).toMatchObject({ name: "Ana Rojas", rut: "12.345.678-5", phone: "+56911111111", userId: "doc-1" });
  });

  it("a un profesional nuevo el admin no le pone RUT ni WhatsApp", () => {
    const r = protegerDatosDelProfesional([{ name: "Ana", rut: "12.345.678-5", phone: "+56911111111", userId: "intruso" }], [], admin, id);
    expect(r[0]).not.toHaveProperty("rut");
    expect(r[0]).not.toHaveProperty("phone");
    expect(r[0]).not.toHaveProperty("userId");
  });

  it("el profesional sí edita lo suyo, pero no puede cambiar a quién está unido", () => {
    const guardados = [{ id: "a", name: "Ana", rut: "12.345.678-5", userId: "doc-1" }];
    const r = protegerDatosDelProfesional([{ id: "a", name: "Ana", rut: "11.111.111-1", phone: "+56922222222", userId: "otro" }], guardados, { userId: "doc-1", esSolo: false }, id);
    expect(r[0]).toMatchObject({ rut: "11.111.111-1", phone: "+56922222222", userId: "doc-1" });
  });

  it("en una cuenta solo el admin es el profesional y edita todo", () => {
    const r = protegerDatosDelProfesional([{ name: "Ana", rut: "12.345.678-5", phone: "+56911111111" }], [], { userId: "admin-1", esSolo: true }, id);
    expect(r[0]).toMatchObject({ rut: "12.345.678-5", phone: "+56911111111" });
  });
});

describe("lo que escribe el profesional al aceptar", () => {
  const base = { nombres: "María José", apellidos: "González", email: "MJ@Clinica.cl", password: "unaClaveLarga", aceptaTerminos: true };

  it("acepta lo mínimo y normaliza", () => {
    const r = validarPerfil({ ...base, nombres: "Dra. María José", rut: "123456785", phone: "9 1234 5678", days: ["monday", "monday", "funday"] });
    expect(r).toEqual({
      ok: true,
      perfil: { nombres: "María José", apellidos: "González", email: "mj@clinica.cl", password: "unaClaveLarga", rut: "12.345.678-5", phone: "+56912345678", days: ["monday"] },
    });
  });

  it("pide nombres, apellidos, correo, contraseña y aceptar los términos", () => {
    expect(validarPerfil({ ...base, apellidos: "" })).toMatchObject({ ok: false });
    expect(validarPerfil({ ...base, email: "no-es-correo" })).toMatchObject({ ok: false });
    expect(validarPerfil({ ...base, password: "corta" })).toMatchObject({ ok: false });
    expect(validarPerfil({ ...base, aceptaTerminos: false })).toMatchObject({ ok: false });
  });

  it("rechaza un RUT o un celular inválidos y días vacíos", () => {
    expect(validarPerfil({ ...base, rut: "12.345.678-9" })).toMatchObject({ ok: false, error: expect.stringMatching(/RUT/) });
    expect(validarPerfil({ ...base, phone: "123" })).toMatchObject({ ok: false, error: expect.stringMatching(/celular/) });
    expect(validarPerfil({ ...base, days: ["funday"] })).toMatchObject({ ok: false });
  });

  it("escribe el perfil en su profesional y lo une a su cuenta, sin la contraseña", () => {
    const v = validarPerfil({ ...base, phone: "912345678" });
    if (!v.ok) throw new Error(v.error);
    const lista = aplicarPerfil([{ id: "a", name: "", specialty: "Ortodoncia" }, { id: "b", name: "Otro" }], "a", v.perfil, "user-1");
    expect(lista?.[0]).toMatchObject({ id: "a", name: "María José González", specialty: "Ortodoncia", phone: "+56912345678", userId: "user-1" });
    expect(lista?.[0]).not.toHaveProperty("password");
    expect(lista?.[1]).toEqual({ id: "b", name: "Otro" });
  });

  it("si el profesional ya no está en la clínica, no escribe nada", () => {
    const v = validarPerfil(base);
    if (!v.ok) throw new Error(v.error);
    expect(aplicarPerfil([{ id: "b", name: "Otro" }], "a", v.perfil, "user-1")).toBeNull();
  });
});

describe("el token del link", () => {
  it("se guarda hasheado y cada link es distinto", () => {
    const a = generarToken();
    const b = generarToken();
    expect(a.token).not.toBe(b.token);
    expect(a.hash).toBe(hashToken(a.token));
    expect(a.hash).not.toContain(a.token);
  });
});

describe("el profesional edita su perfil después", () => {
  it("no pide correo ni contraseña", () => {
    expect(validarEdicion({ nombres: "Ana", apellidos: "Rojas", phone: "912345678" })).toEqual({
      ok: true, perfil: { nombres: "Ana", apellidos: "Rojas", phone: "+56912345678" },
    });
  });

  it("puede borrar su RUT o su WhatsApp", () => {
    expect(validarEdicion({ nombres: "Ana", apellidos: "Rojas", rut: "", phone: "" })).toEqual({
      ok: true, perfil: { nombres: "Ana", apellidos: "Rojas", rut: "", phone: "" },
    });
  });

  it("sigue validando el RUT", () => {
    expect(validarEdicion({ nombres: "Ana", apellidos: "Rojas", rut: "12.345.678-9" })).toMatchObject({ ok: false });
  });
});
