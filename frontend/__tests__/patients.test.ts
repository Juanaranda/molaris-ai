import { describe, it, expect } from "vitest";
import { buscarPacientes, normalizar, haceCuanto, type PatientSuggestion } from "@/lib/patients";

/**
 * Reglas de búsqueda del autocompletar. Es lo que decide a quién se le agenda
 * la hora, así que los casos de acá salen de cómo escribe la gente de verdad:
 * sin tildes, por apellido, o pegando un RUT con puntos.
 */

function paciente(over: Partial<PatientSuggestion> & { name: string }): PatientSuggestion {
  return {
    key: over.name, rut: null, phone: null, email: null,
    visits: 1, lastVisit: new Date().toISOString(), lastDoctor: "Dr. Ivonne Poblete",
    services: [], ...over,
  };
}

const base = [
  paciente({ name: "José Pérez Soto",     rut: "12.345.678-9", phone: "+56911111111" }),
  paciente({ name: "María González",      rut: "9.876.543-2",  phone: "+56922222222" }),
  paciente({ name: "Ana Quezada Riveros", rut: "11.222.333-4" }),
  paciente({ name: "Juan Pérez",          rut: "5.555.555-5" }),
];

describe("buscarPacientes", () => {
  it("no sugiere nada con menos de dos letras: con una sale media clínica", () => {
    expect(buscarPacientes(base, "j")).toHaveLength(0);
    expect(buscarPacientes(base, "")).toHaveLength(0);
  });

  it("encuentra sin tilde lo que está guardado con tilde", () => {
    const r = buscarPacientes(base, "jose");
    expect(r.map((p) => p.name)).toContain("José Pérez Soto");
  });

  it("encuentra por apellido, no solo por cómo empieza el nombre", () => {
    const r = buscarPacientes(base, "perez").map((p) => p.name);
    expect(r).toContain("José Pérez Soto");
    expect(r).toContain("Juan Pérez");
  });

  it("prioriza a quien empieza con lo escrito por sobre quien solo lo contiene", () => {
    const r = buscarPacientes(base, "juan");
    expect(r[0].name).toBe("Juan Pérez");
  });

  it("encuentra por RUT aunque venga con puntos y guion", () => {
    expect(buscarPacientes(base, "12.345.678-9")[0].name).toBe("José Pérez Soto");
    expect(buscarPacientes(base, "12345678")[0].name).toBe("José Pérez Soto");
  });

  it("encuentra por teléfono cuando se escriben suficientes dígitos", () => {
    expect(buscarPacientes(base, "922222222")[0].name).toBe("María González");
  });

  it("a igual coincidencia, primero el que vino hace menos", () => {
    const viejo    = paciente({ name: "Pedro Antiguo", lastVisit: "2020-01-01T00:00:00.000Z" });
    const reciente = paciente({ name: "Pedro Reciente", lastVisit: new Date().toISOString() });
    const r = buscarPacientes([viejo, reciente], "pedro");
    expect(r[0].name).toBe("Pedro Reciente");
  });

  it("corta la lista para que el desplegable no tape la pantalla", () => {
    const muchos = Array.from({ length: 30 }, (_, i) => paciente({ name: `Carlos ${i}`, key: `c${i}` }));
    expect(buscarPacientes(muchos, "carlos").length).toBeLessThanOrEqual(6);
  });

  it("devuelve vacío cuando no hay nadie parecido, en vez de sugerir cualquier cosa", () => {
    expect(buscarPacientes(base, "zzzz")).toHaveLength(0);
  });
});

describe("normalizar", () => {
  it("saca tildes y mayúsculas", () => {
    expect(normalizar("  JOSÉ Pérez ")).toBe("jose perez");
  });
});

describe("haceCuanto", () => {
  const dias = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

  it("traduce a lenguaje de persona, no a fechas sueltas", () => {
    expect(haceCuanto(dias(0))).toBe("hoy");
    expect(haceCuanto(dias(1))).toBe("ayer");
    expect(haceCuanto(dias(5))).toBe("hace 5 días");
    expect(haceCuanto(dias(60))).toBe("hace 2 meses");
    expect(haceCuanto(dias(400))).toBe("hace 1 año");
  });

  it("no dice 'hace -3 días' con una cita futura", () => {
    expect(haceCuanto(dias(-3))).toBe("próximamente");
  });
});
