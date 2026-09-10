import { describe, it, expect } from "vitest";
import { datosDeSolicitud, PLAZO_BASE_HORAS, ESPERANDO_CONFIRMACION, VIAS_DEL_PACIENTE } from "../services/booking/confirmation";

/**
 * Lo que toda solicitud del agente tiene que llevar.
 *
 * Los dos caminos que las crean —el widget web y el webhook de WhatsApp— se
 * habían separado y cada uno cargaba la mitad:
 *
 *   - el web marcaba `requestedVia` y el plazo, pero no guardaba el teléfono,
 *     así que al decidir el profesional no había a quién avisarle;
 *   - el de WhatsApp guardaba el teléfono pero no marcaba `requestedVia`, y el
 *     scheduler filtra por ese campo: esas horas quedaban "pending" para
 *     siempre, con el cupo tomado y sin que nadie las viera.
 *
 * Las tres cosas van juntas o el circuito no cierra, y eso es lo que se fija acá.
 */

const AHORA = new Date("2026-09-10T12:00:00.000Z");
const EN_UNA_SEMANA = new Date("2026-09-17T15:00:00.000Z");

describe("datosDeSolicitud", () => {
  it("entra al circuito de confirmación: pendiente, marcada y con plazo", () => {
    const d = datosDeSolicitud({ fechaCita: EN_UNA_SEMANA, telefono: "+56911111111", ahora: AHORA });
    expect(d.status).toBe("pending");
    // El scheduler filtra por este campo; sin él la solicitud es invisible.
    expect(d.requestedVia).toBe("agent");
    expect(d.confirmDeadline).toBeInstanceOf(Date);
  });

  it("la página pública también pide confirmación, no agenda sola", () => {
    // Que la página muestre solo horas publicadas no equivale a que el doctor
    // haya dicho que sí a esa hora concreta. Antes creaba la cita "confirmed".
    const d = datosDeSolicitud({ fechaCita: EN_UNA_SEMANA, telefono: "+56911111111", via: "web", ahora: AHORA });
    expect(d.status).toBe("pending");
    expect(d.requestedVia).toBe("web");
    expect(d.confirmDeadline).toBeInstanceOf(Date);
  });

  it("el filtro del scheduler alcanza a las dos vías", () => {
    // Si se suma un canal y no se agrega acá, esas horas quedan invisibles:
    // ni recordatorios, ni caducidad, ni aviso en el panel.
    for (const via of VIAS_DEL_PACIENTE) {
      expect(ESPERANDO_CONFIRMACION.requestedVia.in).toContain(via);
    }
    expect(ESPERANDO_CONFIRMACION.status).toBe("pending");
  });

  it("toda vía que exista tiene que estar en el filtro", () => {
    // Guarda contra el olvido: la lista de vías y el filtro salen de la misma
    // constante, así que agregar una sin cubrirla rompe acá.
    expect(ESPERANDO_CONFIRMACION.requestedVia.in.length).toBe(VIAS_DEL_PACIENTE.length);
  });

  it("conserva el teléfono, que es por donde se avisa la decisión", () => {
    expect(datosDeSolicitud({ fechaCita: EN_UNA_SEMANA, telefono: "+56911111111", ahora: AHORA }).patientPhone)
      .toBe("+56911111111");
  });

  it("un teléfono en blanco queda como null y no como cadena vacía", () => {
    // Importa: avisarPacienteDecision comprueba `!b.patientPhone`, y "" pasaría
    // esa guarda igual que null, pero ensucia la ficha y los listados.
    for (const vacio of ["", "   ", null, undefined]) {
      expect(datosDeSolicitud({ fechaCita: EN_UNA_SEMANA, telefono: vacio, ahora: AHORA }).patientPhone).toBeNull();
    }
  });

  it("el plazo base son 24 h cuando la cita está lejos", () => {
    const d = datosDeSolicitud({ fechaCita: EN_UNA_SEMANA, telefono: "+56911111111", ahora: AHORA });
    expect(d.confirmDeadline.getTime() - AHORA.getTime()).toBe(PLAZO_BASE_HORAS * 3_600_000);
  });

  it("si la cita es antes de 24 h, el plazo se acorta y nunca la pasa", () => {
    // Un plazo que venciera después de la hora pedida no sirve de nada.
    const enTresHoras = new Date(AHORA.getTime() + 3 * 3_600_000);
    const d = datosDeSolicitud({ fechaCita: enTresHoras, telefono: "+56911111111", ahora: AHORA });
    expect(d.confirmDeadline.getTime()).toBeLessThan(enTresHoras.getTime());
    expect(d.confirmDeadline.getTime()).toBeGreaterThan(AHORA.getTime());
  });
});
