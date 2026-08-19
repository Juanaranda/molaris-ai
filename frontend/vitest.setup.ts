import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Cada test parte con el DOM limpio; si no, un componente montado antes
// aparece en las consultas del siguiente y los fallos son incomprensibles.
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// jsdom no implementa scrollIntoView y el autocompletar lo llama al navegar
// con las flechas. Sin este stub el test revienta por algo que no está probando.
Element.prototype.scrollIntoView = vi.fn();
