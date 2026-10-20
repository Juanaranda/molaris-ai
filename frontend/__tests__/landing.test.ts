import { describe, it, expect } from "vitest";
import {
  GUIONES, RECORRIDO, MOMENTOS, PLANES, COMPARACION, PREGUNTAS, AVISO_IA,
} from "@/lib/landing";

/**
 * La landing no puede prometer lo que molari no hace, y su ejemplo es una
 * clínica inventada, nunca la del piloto. Estas pruebas cuidan las dos cosas.
 */

const TODO_EL_TEXTO = JSON.stringify({ GUIONES, RECORRIDO, MOMENTOS, PLANES, COMPARACION, PREGUNTAS, AVISO_IA });

describe("ejemplo de la landing", () => {
  it("no usa la clínica piloto ni sus doctores reales", () => {
    for (const real of ["Galana", "Poblete", "Garcés", "Paimilla", "Zerpa"]) {
      expect(TODO_EL_TEXTO).not.toContain(real);
    }
  });

  it("no promete lo que molari no hace", () => {
    for (const promesa of [/extremo a extremo/i, /cumple(mos)? (con )?la ley/i, /integraci[oó]n con (reservo|dentalink)/i, /\bAPI\b/]) {
      expect(TODO_EL_TEXTO).not.toMatch(promesa);
    }
  });
});

describe("el chat de ejemplo", () => {
  it("el agente deja la hora pedida, nunca la da por agendada", () => {
    for (const g of GUIONES) {
      for (const l of g.lineas.filter((l) => l.quien === "molari")) {
        expect(l.texto).not.toMatch(/\b(agendad[ao]|confirmad[ao]|reservad[ao])\b/i);
      }
    }
  });

  it("cada conversación alterna paciente y molari, y parte el paciente", () => {
    for (const g of GUIONES) {
      g.lineas.forEach((l, i) => expect(l.quien).toBe(i % 2 === 0 ? "paciente" : "molari"));
    }
  });
});

describe("todo lo que trae", () => {
  it("cada momento tiene funciones y ninguna se repite", () => {
    const nombres = MOMENTOS.flatMap((m) => m.funciones.map((f) => f.nombre));
    expect(MOMENTOS.every((m) => m.funciones.length > 0)).toBe(true);
    expect(new Set(nombres).size).toBe(nombres.length);
  });
});

describe("planes", () => {
  it("la comparación tiene un valor por plan", () => {
    for (const fila of COMPARACION) expect(fila.valores).toHaveLength(PLANES.length);
  });

  it("hay un solo plan destacado", () => {
    expect(PLANES.filter((p) => p.destacado)).toHaveLength(1);
  });
});
