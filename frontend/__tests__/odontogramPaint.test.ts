import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { STATE_META, stateOf, surfacePaintFor } from "@/lib/odontogramPaint";
import type { ToothProjection } from "@/lib/odontogram";

/**
 * El odontograma tenía tres fuentes de color que no coincidían: la cara
 * pintada, la leyenda y la tabla mostraban "Tratado" en tres azules distintos,
 * y una obturación salía azul en el diente y verde en la tabla. Ahora hay una
 * sola (STATE_META); estas pruebas cuidan que siga siendo una.
 */

const css = readFileSync(join(__dirname, "../app/globals.css"), "utf8");
const TOKEN: Record<keyof typeof STATE_META, string> = {
  pending: "pending", treated: "treated", prosthetic: "prosthetic", extracted: "absent",
};

function luminancia(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

describe("colores clínicos", () => {
  for (const [estado, meta] of Object.entries(STATE_META) as [keyof typeof STATE_META, (typeof STATE_META)[keyof typeof STATE_META]][]) {
    it(`${meta.label}: globals.css tiene el mismo color que STATE_META`, () => {
      const t = TOKEN[estado];
      expect(css).toMatch(new RegExp(`--color-clinical-${t}:\\s*${meta.color};`, "i"));
      expect(css).toMatch(new RegExp(`--color-clinical-${t}-soft:\\s*${meta.soft};`, "i"));
    });

    it(`${meta.label}: el texto se lee sobre blanco y sobre su fondo suave (4,5:1)`, () => {
      expect(contraste(meta.color, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
      expect(contraste(meta.color, meta.soft)).toBeGreaterThanOrEqual(4.5);
    });
  }

  it("tratado no es el teal de la marca, que es el color de selección", () => {
    expect(STATE_META.treated.color.toUpperCase()).not.toBe("#1A5C7A");
  });
});

describe("estado de cada condición", () => {
  it("una extracción activa es una extracción indicada: pendiente", () => {
    expect(stateOf("extraccion")).toBe("pending");
  });

  it("la cara pintada usa el mismo color que la leyenda", () => {
    const proj: ToothProjection = {
      toothFDI: "16", events: [], isExtracted: false,
      activeConditions: [
        { conditionCode: "caries", eventId: "a", occurredAt: "", surfaces: ["M"], severity: null, professionalId: "u" },
        { conditionCode: "obturacion", eventId: "b", occurredAt: "", surfaces: ["O"], severity: null, professionalId: "u" },
      ],
    };
    expect(surfacePaintFor(proj).surfaces).toEqual({ M: STATE_META.pending.color, O: STATE_META.treated.color });
  });
});
