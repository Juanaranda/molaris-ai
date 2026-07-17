import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Emails de molari (empresa → cliente): render de plantillas + modo de
 * redirección segura. Mockeamos sendEmail para capturar lo que se enviaría.
 */

const sendEmailMock = vi.fn();
vi.mock("../services/email/emailService", () => ({
  sendEmail: (...args: unknown[]) => sendEmailMock(...args),
}));

// Permite cambiar la variable de redirección por test
vi.mock("../config/env", () => ({
  config: {
    frontendUrl: "https://molari-beta.vercel.app",
    email: { get molariRedirectTo() { return process.env.__TEST_REDIRECT ?? ""; } },
  },
}));

import { sendMolariEmail } from "../services/email/molariEmails";

beforeEach(() => { sendEmailMock.mockReset(); delete process.env.__TEST_REDIRECT; });
afterEach(() => { delete process.env.__TEST_REDIRECT; });

describe("sendMolariEmail — sin redirección (dominio verificado)", () => {
  it("bienvenida va al destinatario real y personaliza por nombre", async () => {
    await sendMolariEmail({ to: "juan@clinica.cl", toName: "Juan", message: { type: "welcome", accountType: "solo" } });
    expect(sendEmailMock).toHaveBeenCalledOnce();
    const arg = sendEmailMock.mock.calls[0][0];
    expect(arg.to).toBe("juan@clinica.cl");
    expect(arg.subject).toContain("Bienvenido");
    expect(arg.html).toContain("Hola Juan,");
    expect(arg.html).not.toContain("Modo prueba");
  });
});

describe("sendMolariEmail — con redirección (sin dominio)", () => {
  beforeEach(() => { process.env.__TEST_REDIRECT = "dueno@molari.ai"; });

  it("redirige al correo del dueño y marca el destinatario real", async () => {
    const res = await sendMolariEmail({ to: "juan@clinica.cl", toName: "Juan", message: { type: "welcome" } });
    const arg = sendEmailMock.mock.calls[0][0];
    expect(arg.to).toBe("dueno@molari.ai");
    expect(arg.subject).toContain("[→ juan@clinica.cl]");
    expect(arg.html).toContain("Modo prueba");
    expect(arg.html).toContain("juan@clinica.cl");
    expect(res.redirectedTo).toBe("dueno@molari.ai");
  });
});

describe("plantillas por tipo", () => {
  it("cumpleaños tiene su propio asunto", async () => {
    await sendMolariEmail({ to: "x@y.cl", toName: "Ana", message: { type: "birthday" } });
    expect(sendEmailMock.mock.calls[0][0].subject).toContain("cumpleaños");
  });

  it("announcement usa título y cuerpo custom", async () => {
    await sendMolariEmail({ to: "x@y.cl", message: { type: "announcement", title: "Nueva función", bodyHtml: "<tr><td>Ya puedes X</td></tr>" } });
    const arg = sendEmailMock.mock.calls[0][0];
    expect(arg.subject).toBe("Nueva función");
    expect(arg.html).toContain("Ya puedes X");
  });
});
