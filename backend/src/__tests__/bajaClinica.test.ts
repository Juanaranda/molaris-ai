import { describe, it, expect } from "vitest";
import { decidirBajaClinica } from "../routes/clinics";

/**
 * Qué pasa al dar de baja una clínica (MOL-17).
 *
 * Antes cualquier baja borraba en cascada las fichas clínicas y el registro de
 * auditoría. La ficha es documento médico-legal (Ley 20.584) y se conserva por
 * años; hasta que un abogado resuelva cómo convive eso con el derecho de
 * supresión (Ley 21.719), nada con registros clínicos se borra.
 */
describe("decidirBajaClinica", () => {
  it("con registros clínicos nadie borra, ni el superadmin", () => {
    expect(decidirBajaClinica({ rol: "SUPERADMIN", registrosClinicos: 1 })).toBe("desactivar");
    expect(decidirBajaClinica({ rol: "SUPERADMIN", registrosClinicos: 5000 })).toBe("desactivar");
  });

  it("el admin de la clínica nunca borra, ni siquiera sin registros", () => {
    // Una clínica recién creada puede no tener fichas todavía, pero el admin
    // igual se queda con desactivar: borrar es decisión de la plataforma.
    expect(decidirBajaClinica({ rol: "ADMIN", registrosClinicos: 0 })).toBe("desactivar");
    expect(decidirBajaClinica({ rol: "ADMIN", registrosClinicos: 12 })).toBe("desactivar");
  });

  it("el superadmin puede borrar una clínica vacía, para limpiar las de prueba", () => {
    expect(decidirBajaClinica({ rol: "SUPERADMIN", registrosClinicos: 0 })).toBe("borrar");
  });

  it("un rol desconocido cae en lo seguro", () => {
    expect(decidirBajaClinica({ rol: "USER", registrosClinicos: 0 })).toBe("desactivar");
    expect(decidirBajaClinica({ rol: "", registrosClinicos: 0 })).toBe("desactivar");
  });
});
