import { describe, it, expect } from "vitest";
import {
  STANDARD_QUESTIONS_V1, computeRedFlags, redFlagsToAlerts,
} from "../services/anamnesis/anamnesisService";

describe("STANDARD_QUESTIONS_V1", () => {
  it("incluye los bloques médicos críticos requeridos por discovery #12", () => {
    const codes = STANDARD_QUESTIONS_V1.map((q) => q.code);
    // Banderas rojas críticas en odontología
    expect(codes).toContain("allergy_anesthetic");
    expect(codes).toContain("allergy_penicillin");
    expect(codes).toContain("anticoagulants");
    expect(codes).toContain("bisphosphonates");
    expect(codes).toContain("pregnancy");
  });
  it("todas las preguntas críticas tienen redFlag=true", () => {
    const critical = ["allergy_anesthetic", "allergy_penicillin", "allergy_latex", "allergy_aines",
                      "anticoagulants", "bisphosphonates",
                      "diabetes", "hypertension", "cardiopathy", "coagulation", "pregnancy"];
    for (const code of critical) {
      const q = STANDARD_QUESTIONS_V1.find((x) => x.code === code);
      expect(q?.redFlag).toBe(true);
    }
  });
});

describe("computeRedFlags", () => {
  it("marca solo preguntas con redFlag=true cuyo answer es truthy", () => {
    const flags = computeRedFlags(STANDARD_QUESTIONS_V1, {
      diabetes: true,
      anticoagulants: true,
      smoking: true,  // no es redFlag aunque sea true
      pregnancy: false,
      allergy_other: "polen",  // text NO es redFlag
    });
    expect(flags).toContain("diabetes");
    expect(flags).toContain("anticoagulants");
    expect(flags).not.toContain("smoking");      // smoking no es redFlag
    expect(flags).not.toContain("pregnancy");    // answer false
    expect(flags).not.toContain("allergy_other"); // sin redFlag
  });

  it("texto vacío no cuenta como red flag", () => {
    const flags = computeRedFlags(STANDARD_QUESTIONS_V1, {
      diabetes: false,
      anticoagulants: "",
    });
    expect(flags).toEqual([]);
  });

  it("preguntas inexistentes en el template se ignoran", () => {
    const flags = computeRedFlags(STANDARD_QUESTIONS_V1, {
      inventado: true,
      diabetes: true,
    });
    expect(flags).toEqual(["diabetes"]);
  });
});

describe("redFlagsToAlerts", () => {
  it("convierte códigos a labels con iconos por sección", () => {
    const alerts = redFlagsToAlerts(STANDARD_QUESTIONS_V1, ["allergy_anesthetic", "anticoagulants", "diabetes"]);
    expect(alerts).toHaveLength(3);
    expect(alerts.some((a) => a.includes("⚠️") && a.toLowerCase().includes("anestésicos"))).toBe(true);
    expect(alerts.some((a) => a.includes("💊") && a.toLowerCase().includes("anticoagulantes"))).toBe(true);
    expect(alerts.some((a) => a.includes("🩺") && a.toLowerCase().includes("diabetes"))).toBe(true);
  });

  it("descarta códigos inexistentes en el template", () => {
    const alerts = redFlagsToAlerts(STANDARD_QUESTIONS_V1, ["inventado", "diabetes"]);
    expect(alerts).toHaveLength(1);
  });
});
