import { describe, it, expect } from "vitest";
import type { ErrorEvent } from "@sentry/nextjs";
import { scrubEvent } from "@/lib/sentryScrub";

/**
 * Lo que se manda a Sentry sale de la clínica hacia un tercero. Bajo la Ley
 * 21.719 eso no puede llevar datos del paciente, y en el navegador hay una
 * fuente que el backend no tiene: la barra de direcciones y los breadcrumbs,
 * que Sentry adjunta solo.
 */
const evento = (over: Partial<ErrorEvent>): ErrorEvent => ({ type: undefined, ...over } as ErrorEvent);

describe("scrubEvent (navegador)", () => {
  it("borra cuerpo, cookies, headers y query string de la petición", () => {
    const out = scrubEvent(evento({
      request: {
        url: "https://molari.ai/partners/pacientes?rut=12345678-9",
        query_string: "rut=12345678-9",
        data: { nombre: "Paciente Real" },
        cookies: { session: "abc" },
        headers: { authorization: "Bearer secreto" },
      },
    }));
    expect(out.request?.data).toBeUndefined();
    expect(out.request?.cookies).toBeUndefined();
    expect(out.request?.headers).toBeUndefined();
    expect(out.request?.query_string).toBeUndefined();
    // La ruta queda: sin ella no se sabe qué se rompió.
    expect(out.request?.url).toBe("https://molari.ai/partners/pacientes");
  });

  it("del usuario deja solo el id, nunca el correo ni la IP", () => {
    const out = scrubEvent(evento({
      user: { id: "u1", email: "doctor@clinica.cl", username: "Dr. Poblete", ip_address: "190.1.2.3" },
    }));
    expect(out.user).toEqual({ id: "u1" });
  });

  it("limpia también los breadcrumbs, que guardan cada navegación y cada fetch", () => {
    const out = scrubEvent(evento({
      breadcrumbs: [
        { data: { url: "https://molari.ai/api/patients?rut=12345678-9" } },
        { data: { from: "/pacientes?q=jose", to: "/agenda?doctor=Poblete" } },
        { message: "sin data" },
      ],
    }));
    expect(out.breadcrumbs?.[0].data?.url).toBe("https://molari.ai/api/patients");
    expect(out.breadcrumbs?.[1].data?.from).toBe("/pacientes");
    expect(out.breadcrumbs?.[1].data?.to).toBe("/agenda");
    expect(out.breadcrumbs?.[2].message).toBe("sin data");
  });

  it("no explota con un evento vacío", () => {
    expect(() => scrubEvent(evento({}))).not.toThrow();
  });
});
