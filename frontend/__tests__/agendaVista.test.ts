import { describe, it, expect } from "vitest";
import { choquesDeBox, nombreCorto, tramoDe, tramosDelDia } from "@/lib/agendaVista";
import { peldanoDeUrgencia } from "@/lib/plazos";

describe("tramoDe", () => {
  it("lleva la hora a su media hora", () => {
    expect(tramoDe("10:40")).toBe("10:30");
    expect(tramoDe("10:29")).toBe("10:00");
    expect(tramoDe("9:05")).toBe("09:00");
  });
});

describe("choquesDeBox", () => {
  const cita = (id: string, time: string, box: string | null, status = "confirmed") => ({ id, time, box, status });

  it("dos citas activas en el mismo box y tramo chocan entre sí", () => {
    const a = cita("a", "15:30", "2"), b = cita("b", "15:40", "2", "pending");
    const ch = choquesDeBox([a, b, cita("c", "15:30", "1")]);
    expect(ch.get("a")).toBe(b);
    expect(ch.get("b")).toBe(a);
    expect(ch.has("c")).toBe(false);
  });

  it("una cancelada no ocupa el box", () => {
    expect(choquesDeBox([cita("a", "10:00", "1"), cita("b", "10:00", "1", "cancelled")]).size).toBe(0);
  });

  it("sin box no hay con qué chocar", () => {
    expect(choquesDeBox([cita("a", "10:00", null), cita("b", "10:00", null)]).size).toBe(0);
  });
});

describe("nombreCorto", () => {
  it("no muestra el título: no es parte del nombre", () => {
    expect(nombreCorto("Dr. Ivonne Poblete")).toBe("Ivonne Poblete");
    expect(nombreCorto("Dra. Ana María Pérez")).toBe("Ana María Pérez");
    expect(nombreCorto("Ivonne Poblete")).toBe("Ivonne Poblete");
  });
  it("sin título se deja igual", () => {
    expect(nombreCorto("Sin asignar")).toBe("Sin asignar");
  });
});

describe("tramosDelDia", () => {
  it("suma los tramos de citas fuera de la grilla, en orden", () => {
    expect(tramosDelDia(["09:00", "09:30"], ["08:15", "09:10", "19:00"])).toEqual(["08:00", "09:00", "09:30", "19:00"]);
  });
});

describe("peldanoDeUrgencia", () => {
  const AHORA = new Date("2026-10-21T14:40:00.000Z");
  const en = (min: number) => new Date(AHORA.getTime() + min * 60_000).toISOString();
  it("sube mientras menos falta", () => {
    expect(peldanoDeUrgencia(en(45), AHORA)).toBe(3);
    expect(peldanoDeUrgencia(en(130), AHORA)).toBe(2);
    expect(peldanoDeUrgencia(en(320), AHORA)).toBe(1);
  });
  it("una vencida queda en el peldaño más alto", () => {
    expect(peldanoDeUrgencia(en(-5), AHORA)).toBe(3);
  });
  it("sin plazo, o con uno ilegible, no hay peldaño", () => {
    expect(peldanoDeUrgencia(null, AHORA)).toBeNull();
    expect(peldanoDeUrgencia("nada", AHORA)).toBeNull();
  });
});
