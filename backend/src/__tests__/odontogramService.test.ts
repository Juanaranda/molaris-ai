/**
 * Tests de la proyección event-sourced del odontograma.
 * Valida las decisiones de #11: M:N, extracción gana, "sano" limpia historial previo.
 */

import { describe, it, expect } from "vitest";
import {
  isValidFDI, isValidConditionCode,
  projectTooth, buildPatientOdontogram,
} from "../services/dental/odontogramService";
import type { DentalEvent, DentalSurface, DentalEventType } from "@prisma/client";

type Evt = DentalEvent & { surfaces: { surface: DentalSurface }[] };

function mkEvent(opts: {
  id?: string; toothFDI?: string; conditionCode: string;
  occurredAt: Date; eventType?: DentalEventType; surfaces?: DentalSurface[]; severity?: number;
}): Evt {
  return {
    id:             opts.id ?? `e-${Math.random().toString(36).slice(2, 8)}`,
    clinicId:       "c-1",
    patientId:      "p-1",
    sessionId:      null,
    professionalId: "u-1",
    toothFDI:       opts.toothFDI ?? "11",
    eventType:      opts.eventType ?? "DIAGNOSIS",
    conditionCode:  opts.conditionCode,
    severity:       opts.severity ?? null,
    notes:          null,
    occurredAt:     opts.occurredAt,
    createdAt:      opts.occurredAt,
    surfaces:       (opts.surfaces ?? []).map((s) => ({ surface: s })),
  };
}

describe("FDI validation", () => {
  it("acepta dientes permanentes 11-48", () => {
    expect(isValidFDI("11")).toBe(true);
    expect(isValidFDI("48")).toBe(true);
    expect(isValidFDI("21")).toBe(true);
    expect(isValidFDI("36")).toBe(true);
  });
  it("acepta dientes temporales 51-85", () => {
    expect(isValidFDI("51")).toBe(true);
    expect(isValidFDI("85")).toBe(true);
  });
  it("rechaza valores fuera de FDI", () => {
    expect(isValidFDI("1")).toBe(false);
    expect(isValidFDI("19")).toBe(false);
    expect(isValidFDI("49")).toBe(false);
    expect(isValidFDI("00")).toBe(false);
    expect(isValidFDI("")).toBe(false);
    expect(isValidFDI("11a")).toBe(false);
  });
});

describe("Condition catalog", () => {
  it("acepta códigos del catálogo", () => {
    expect(isValidConditionCode("caries")).toBe(true);
    expect(isValidConditionCode("endodoncia")).toBe(true);
    expect(isValidConditionCode("implante")).toBe(true);
  });
  it("rechaza códigos fuera del catálogo", () => {
    expect(isValidConditionCode("inventado")).toBe(false);
    expect(isValidConditionCode("")).toBe(false);
  });
});

describe("projectTooth — resolución de estado activo", () => {
  it("un diente sin eventos no aparece (se maneja en buildPatientOdontogram)", () => {
    const proj = projectTooth("11", []);
    expect(proj.activeConditions).toEqual([]);
    expect(proj.isExtracted).toBe(false);
  });

  it("una caries simple queda como activa", () => {
    const e = mkEvent({ conditionCode: "caries", occurredAt: new Date("2026-05-01"), surfaces: ["M", "O", "D"] });
    const proj = projectTooth("11", [e]);
    expect(proj.activeConditions).toHaveLength(1);
    expect(proj.activeConditions[0].conditionCode).toBe("caries");
    expect(proj.activeConditions[0].surfaces).toEqual(["M", "O", "D"]);
  });

  it("M:N: implante + corona conviven como activos", () => {
    const events = [
      mkEvent({ conditionCode: "corona",   occurredAt: new Date("2026-05-15") }),
      mkEvent({ conditionCode: "implante", occurredAt: new Date("2026-05-10") }),
    ];
    const proj = projectTooth("11", events);
    expect(proj.activeConditions).toHaveLength(2);
    const codes = proj.activeConditions.map((c) => c.conditionCode).sort();
    expect(codes).toEqual(["corona", "implante"]);
  });

  it("extracción gana: marca isExtracted y vacía activeConditions", () => {
    const events = [
      mkEvent({ conditionCode: "extraccion", occurredAt: new Date("2026-05-20") }),
      mkEvent({ conditionCode: "caries",     occurredAt: new Date("2026-05-10") }),
    ];
    const proj = projectTooth("11", events);
    expect(proj.isExtracted).toBe(true);
    expect(proj.activeConditions).toEqual([]);
    expect(proj.events).toHaveLength(2);  // historial completo se mantiene
  });

  it("'sano' más reciente limpia condiciones previas", () => {
    const events = [
      mkEvent({ conditionCode: "sano",   occurredAt: new Date("2026-05-20") }),
      mkEvent({ conditionCode: "caries", occurredAt: new Date("2026-05-10") }),
    ];
    const proj = projectTooth("11", events);
    expect(proj.activeConditions).toEqual([]);
    expect(proj.isExtracted).toBe(false);
  });

  it("hallazgo posterior a un 'sano' sí aparece como activo", () => {
    const events = [
      mkEvent({ conditionCode: "caries", occurredAt: new Date("2026-05-25") }),
      mkEvent({ conditionCode: "sano",   occurredAt: new Date("2026-05-20") }),
      mkEvent({ conditionCode: "caries", occurredAt: new Date("2026-05-10") }),
    ];
    const proj = projectTooth("11", events);
    expect(proj.activeConditions).toHaveLength(1);
    expect(proj.activeConditions[0].occurredAt.toISOString()).toContain("2026-05-25");
  });

  it("eventos OBSERVATION no se incluyen en activeConditions pero sí en historial", () => {
    const events = [
      mkEvent({ conditionCode: "caries", occurredAt: new Date("2026-05-15"), eventType: "OBSERVATION" }),
      mkEvent({ conditionCode: "implante", occurredAt: new Date("2026-05-10") }),
    ];
    const proj = projectTooth("11", events);
    expect(proj.activeConditions).toHaveLength(1);
    expect(proj.activeConditions[0].conditionCode).toBe("implante");
    expect(proj.events).toHaveLength(2);
  });

  it("preserva severidad (ej: ICDAS 4)", () => {
    const e = mkEvent({ conditionCode: "caries", occurredAt: new Date("2026-05-01"), severity: 4 });
    const proj = projectTooth("11", [e]);
    expect(proj.activeConditions[0].severity).toBe(4);
  });
});

describe("buildPatientOdontogram — agrupación por diente", () => {
  it("agrupa eventos en el FDI correcto y ordena desc por occurredAt", () => {
    const events = [
      mkEvent({ toothFDI: "11", conditionCode: "caries",   occurredAt: new Date("2026-05-10") }),
      mkEvent({ toothFDI: "11", conditionCode: "obturacion", occurredAt: new Date("2026-05-15") }),
      mkEvent({ toothFDI: "36", conditionCode: "endodoncia", occurredAt: new Date("2026-05-12") }),
    ];
    const map = buildPatientOdontogram(events);
    expect(Object.keys(map).sort()).toEqual(["11", "36"]);
    // Para 11: el más reciente es obturacion
    expect(map["11"].events[0].conditionCode).toBe("obturacion");
    expect(map["11"].activeConditions).toHaveLength(2);  // caries + obturacion conviven (M:N)
    expect(map["36"].activeConditions[0].conditionCode).toBe("endodoncia");
  });

  it("paciente sin eventos → diccionario vacío", () => {
    expect(buildPatientOdontogram([])).toEqual({});
  });
});
