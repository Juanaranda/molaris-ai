import { describe, it, expect } from "vitest";
import type { ErrorEvent } from "@sentry/node";
import { scrubEvent } from "../instrument";

/**
 * Lo que se manda a Sentry sale de la clínica hacia un tercero. Bajo la Ley
 * 21.719 eso no puede incluir datos del paciente, así que el scrub se testea
 * en vez de confiarse.
 */

function eventoCon(request: ErrorEvent["request"], user?: ErrorEvent["user"]): ErrorEvent {
  return { type: undefined, request, user } as ErrorEvent;
}

describe("scrubEvent", () => {
  it("borra el cuerpo del request, que puede traer la ficha entera", () => {
    const out = scrubEvent(eventoCon({
      data: { rut: "12.345.678-9", nombre: "Paciente Real", diagnostico: "caries 1.6" },
    }));
    expect(out.request?.data).toBeUndefined();
  });

  it("borra la query string, donde viajan RUT y búsquedas de pacientes", () => {
    const out = scrubEvent(eventoCon({
      url: "https://api.molari.ai/api/patients?rut=12345678-9&q=juan",
      query_string: "rut=12345678-9&q=juan",
    }));
    expect(out.request?.query_string).toBeUndefined();
    // La ruta sí queda: sin ella no se sabe qué se rompió.
    expect(out.request?.url).toBe("https://api.molari.ai/api/patients");
  });

  it("deja solo los headers de la lista blanca — nada de Authorization ni cookies", () => {
    const out = scrubEvent(eventoCon({
      headers: {
        "content-type": "application/json",
        "user-agent": "Mozilla/5.0",
        authorization: "Bearer token-secreto",
        "x-api-key": "clave",
        cookie: "session=abc",
      },
      cookies: { session: "abc" },
    }));
    expect(Object.keys(out.request?.headers ?? {}).sort()).toEqual(["content-type", "user-agent"]);
    expect(out.request?.cookies).toBeUndefined();
  });

  it("filtra headers sin importar el casing con que lleguen", () => {
    const out = scrubEvent(eventoCon({
      headers: { Authorization: "Bearer x", "Content-Type": "application/json" },
    }));
    expect(out.request?.headers).toEqual({ "Content-Type": "application/json" });
  });

  it("del usuario deja el id y descarta email, nombre e IP", () => {
    const out = scrubEvent(eventoCon(undefined, {
      id: "user_123",
      email: "doctor@clinica.cl",
      username: "Dr. Ivonne Poblete",
      ip_address: "190.1.2.3",
    }));
    expect(out.user).toEqual({ id: "user_123" });
  });

  it("no explota cuando el evento viene sin request ni user", () => {
    expect(() => scrubEvent({ type: undefined } as ErrorEvent)).not.toThrow();
  });
});
