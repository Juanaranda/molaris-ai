import { describe, it, expect } from "vitest";
import { rutaPaciente, idDePaciente, paramsEstaticos, MARCADOR } from "@/lib/rutasApp";

/**
 * La ficha del paciente tiene que abrir igual en la web y en la app, aunque la
 * app no tenga una página por cada id (MOL-40).
 */

describe("rutaPaciente", () => {
  it("en la web, la URL de siempre", () => {
    expect(rutaPaciente("cmabc123", false)).toBe("/partners/pacientes/cmabc123");
  });

  it("en la app, la página marcador con el id en la query", () => {
    expect(rutaPaciente("cmabc123", true)).toBe(`/partners/pacientes/${MARCADOR}/?id=cmabc123`);
  });

  it("escapa lo que no debe ir crudo en una URL", () => {
    expect(rutaPaciente("a/b?c", false)).toBe("/partners/pacientes/a%2Fb%3Fc");
    expect(rutaPaciente("a&b", true)).toContain("id=a%26b");
  });
});

describe("idDePaciente", () => {
  it("en la web viene en el segmento", () => {
    expect(idDePaciente("cmabc123", "")).toBe("cmabc123");
  });

  it("en la app viene en la query", () => {
    expect(idDePaciente(MARCADOR, "?id=cmabc123")).toBe("cmabc123");
  });

  it("ida y vuelta: lo que arma rutaPaciente se lee igual en ambos lados", () => {
    for (const app of [false, true]) {
      const url = new URL(rutaPaciente("a&b/c", app), "https://x");
      const segmento = url.pathname.split("/")[3];
      expect(idDePaciente(segmento, url.search)).toBe("a&b/c");
    }
  });

  it("sin id en ninguna parte, null (la página no inventa uno)", () => {
    expect(idDePaciente(MARCADOR, "")).toBeNull();
    expect(idDePaciente(undefined, "?otra=1")).toBeNull();
  });
});

describe("paramsEstaticos", () => {
  it("la app genera solo la página marcador; la web, ninguna", () => {
    expect(paramsEstaticos("slug", true)).toEqual([{ slug: MARCADOR }]);
    expect(paramsEstaticos("slug", false)).toEqual([]);
  });
});
