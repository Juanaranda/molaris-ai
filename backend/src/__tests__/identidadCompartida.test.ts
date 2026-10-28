import { describe, it, expect } from "vitest";
import { elegirFicha, otraClinicaUsaIdentidad } from "../services/pacientes/identidad";

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

describe("qué ficha abrir cuando se busca por teléfono (MOL-60)", () => {
  const mama = { id: "m", name: "Carolina Soto" };
  const hijo = { id: "h", name: "Tomás Soto" };

  it("con el nombre, abre la de esa persona aunque compartan teléfono", () => {
    expect(elegirFicha([mama, hijo], "Tomás Soto")).toBe(hijo);
    expect(elegirFicha([mama, hijo], "tomas  soto")).toBe(hijo);
  });

  it("si el nombre no calza con nadie, no abre la de otro: hay que crear la suya", () => {
    expect(elegirFicha([mama], "Tomás Soto")).toBeNull();
  });

  it("si calzan dos, no adivina", () => {
    expect(elegirFicha([{ id: "a", name: "Ana Pérez" }, { id: "b", name: "Ana Pérez" }], "Ana Pérez")).toBe("ambigua");
    expect(elegirFicha([mama, hijo], null)).toBe("ambigua");
  });

  it("sin nombre y una sola ficha con ese teléfono, es esa", () => {
    expect(elegirFicha([mama], undefined)).toBe(mama);
  });
});
