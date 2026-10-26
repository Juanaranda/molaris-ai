import { describe, it, expect } from "vitest";
import { otraClinicaUsaIdentidad } from "../services/pacientes/identidad";

/**
 * MOL-37: la identidad de un paciente es la misma en todas las clínicas que lo
 * atienden. Una clínica no puede editar la que también usa otra.
 */

type Fila = { identityId: string; clinicId: string };
function db(pacientes: Fila[], cuentas: Fila[] = []) {
  const contar = (filas: Fila[]) => async ({ where }: { where: { identityId: string; clinicId: { not: string } } }) =>
    filas.filter((f) => f.identityId === where.identityId && f.clinicId !== where.clinicId.not).length;
  return { patient: { count: contar(pacientes) }, patientUser: { count: contar(cuentas) } };
}

describe("¿otra clínica usa esta identidad?", () => {
  it("no, si solo esta clínica la atiende: se puede editar", async () => {
    expect(await otraClinicaUsaIdentidad(db([{ identityId: "i1", clinicId: "A" }]), "i1", "A")).toBe(false);
  });

  it("sí, si otra clínica la tiene como paciente", async () => {
    const d = db([{ identityId: "i1", clinicId: "A" }, { identityId: "i1", clinicId: "B" }]);
    expect(await otraClinicaUsaIdentidad(d, "i1", "A")).toBe(true);
  });

  it("sí, si la persona tiene cuenta en el portal de otra clínica", async () => {
    const d = db([{ identityId: "i1", clinicId: "A" }], [{ identityId: "i1", clinicId: "B" }]);
    expect(await otraClinicaUsaIdentidad(d, "i1", "A")).toBe(true);
  });

  it("no la confunde con otra persona de la otra clínica", async () => {
    const d = db([{ identityId: "i1", clinicId: "A" }, { identityId: "i2", clinicId: "B" }]);
    expect(await otraClinicaUsaIdentidad(d, "i1", "A")).toBe(false);
  });
});
