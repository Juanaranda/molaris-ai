import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { carasEnPantalla } from "@/lib/tooth";
import { surfaceLayout } from "@/components/ToothSurfaceChart";
import { ToothSurfaceWheel } from "@/components/ToothSurfaceWheel";

/**
 * La grilla del odontograma y la rueda del detalle tienen que mostrar la misma
 * cara en el mismo lugar.
 *
 * No lo hacían: la rueda ponía vestibular siempre arriba y la grilla la ponía
 * abajo en las piezas inferiores, que es la convención correcta —la cara mira
 * hacia afuera de la arcada—. O sea que marcar "la de abajo" en un molar
 * inferior registraba vestibular en una pantalla y lingual en la otra, sobre
 * una ficha que es documento médico-legal (Ley 20.584).
 */

const PERMANENTES = [1, 2, 3, 4].flatMap((q) =>
  [1, 2, 3, 4, 5, 6, 7, 8].map((p) => `${q}${p}`)
);

/** Lee de la rueda renderizada qué cara quedó en cada lado. */
function carasDeLaRueda(fdi: string) {
  const { container } = render(
    <ToothSurfaceWheel toothFDI={fdi} selected={[]} onToggle={() => {}} size={160} />
  );
  const textos = [...container.querySelectorAll("text")].map((t) => ({
    code: t.textContent ?? "",
    x: Number(t.getAttribute("x")),
    y: Number(t.getAttribute("y")),
  }));
  const menorY = textos.reduce((a, b) => (a.y < b.y ? a : b));
  const mayorY = textos.reduce((a, b) => (a.y > b.y ? a : b));
  const menorX = textos.reduce((a, b) => (a.x < b.x ? a : b));
  const mayorX = textos.reduce((a, b) => (a.x > b.x ? a : b));
  return { arriba: menorY.code, abajo: mayorY.code, izquierda: menorX.code, derecha: mayorX.code };
}

describe("carasEnPantalla — la orientación canónica", () => {
  it("vestibular mira hacia afuera de la arcada", () => {
    // Superior: la cara externa apunta hacia arriba en el dibujo.
    expect(carasEnPantalla("16").arriba).toBe("V");
    expect(carasEnPantalla("16").abajo).toBe("P");
    // Inferior: al revés, y el lado interno es lingual, no palatino.
    expect(carasEnPantalla("36").arriba).toBe("L");
    expect(carasEnPantalla("36").abajo).toBe("V");
  });

  it("mesial mira a la línea media", () => {
    // Lado derecho del paciente (cuadrantes 1 y 4): mesial cae a la derecha.
    expect(carasEnPantalla("16").derecha).toBe("M");
    expect(carasEnPantalla("46").derecha).toBe("M");
    // Lado izquierdo (2 y 3): espejado.
    expect(carasEnPantalla("26").izquierda).toBe("M");
    expect(carasEnPantalla("36").izquierda).toBe("M");
  });

  it("el centro es incisal en anteriores y oclusal en posteriores", () => {
    for (const fdi of ["11", "12", "13", "21", "43"]) {
      expect(carasEnPantalla(fdi).centro).toBe("I");
    }
    for (const fdi of ["14", "16", "27", "38"]) {
      expect(carasEnPantalla(fdi).centro).toBe("O");
    }
  });

  it("los temporales siguen la misma convención que su cuadrante", () => {
    // 5 y 6 son superiores; 7 y 8, inferiores.
    expect(carasEnPantalla("55").arriba).toBe("V");
    expect(carasEnPantalla("85").arriba).toBe("L");
    // 5 y 8 caen en el lado derecho del paciente.
    expect(carasEnPantalla("55").derecha).toBe("M");
    expect(carasEnPantalla("75").izquierda).toBe("M");
  });

  it("nunca devuelve dos veces la misma cara", () => {
    for (const fdi of PERMANENTES) {
      const c = carasEnPantalla(fdi);
      const caras = [c.arriba, c.abajo, c.izquierda, c.derecha, c.centro];
      expect(new Set(caras).size, `pieza ${fdi} repite una cara`).toBe(5);
    }
  });
});

describe("la grilla y la rueda muestran lo mismo", () => {
  it.each(PERMANENTES)("pieza %s coincide en los cuatro lados", (fdi) => {
    const grilla = surfaceLayout(fdi);
    const rueda = carasDeLaRueda(fdi);

    expect(rueda.arriba,     `${fdi} arriba`).toBe(grilla.top);
    expect(rueda.abajo,      `${fdi} abajo`).toBe(grilla.bottom);
    expect(rueda.izquierda,  `${fdi} izquierda`).toBe(grilla.left);
    expect(rueda.derecha,    `${fdi} derecha`).toBe(grilla.right);
  });

  it("el caso que estaba roto: el molar inferior izquierdo", () => {
    // Antes: grilla arriba=L / rueda arriba=V. Justo al revés.
    expect(carasDeLaRueda("36").arriba).toBe("L");
    expect(surfaceLayout("36").top).toBe("L");
  });
});
