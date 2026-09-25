import { describe, it, expect, vi, afterEach } from "vitest";
import {
  citasActivasDelDoctor,
  esCitaDelDoctor,
  fechaLocal,
  fetchAgendaDelDia,
  minutosDeHora,
  proximaCita,
  vistaDelPanel,
  type AgendaBooking,
} from "@/lib/doctorView";

// El token sale de localStorage, que en jsdom no está garantizado: se fija acá
// para que los tests de fetch prueben la URL y el manejo de errores, no eso.
vi.mock("@/lib/auth", () => ({ getToken: () => "token-de-prueba" }));

/**
 * Vista del doctor (MOL-33). La agenda salía siempre vacía porque se pedía una
 * ruta inexistente y se leía un campo (`startTime`) que la respuesta no trae.
 * Los datos de acá tienen la forma real de `GET /api/agenda?date=`.
 */

function cita(over: Partial<AgendaBooking> & { time: string }): AgendaBooking {
  return {
    id: over.time,
    date: "2026-09-25T00:00:00.000Z",
    doctor: "Dr. Nicolás Rojas",
    patientName: "Ana Quezada",
    service: "Limpieza",
    status: "confirmed",
    requestedVia: null,
    ...over,
  };
}

const alas = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(2026, 8, 25, h, m, 0);
};

afterEach(() => { vi.unstubAllGlobals(); });

describe("fetchAgendaDelDia", () => {
  it("pide la ruta que existe, /api/agenda?date=, y no /api/agenda/bookings", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [cita({ time: "10:00" })] });
    vi.stubGlobal("fetch", fetchMock);

    const r = await fetchAgendaDelDia("2026-09-25");

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toMatch(/\/api\/agenda\?date=2026-09-25$/);
    expect(url).not.toContain("/api/agenda/bookings");
    expect(fetchMock.mock.calls[0][1].headers).toEqual({ Authorization: "Bearer token-de-prueba" });
    expect(r).toHaveLength(1);
  });

  it("si el backend responde con error, lanza en vez de mostrar un día vacío como si no hubiera citas", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
    await expect(fetchAgendaDelDia("2026-09-25")).rejects.toThrow("No pudimos cargar la agenda");
  });
});

describe("fechaLocal", () => {
  it("usa el día local, no el de UTC: a las 22 h en Chile sigue siendo hoy", () => {
    expect(fechaLocal(new Date(2026, 8, 25, 22, 30))).toBe("2026-09-25");
    expect(fechaLocal(new Date(2026, 0, 5, 0, 5))).toBe("2026-01-05");
  });
});

describe("minutosDeHora", () => {
  it("entiende HH:MM y H:MM", () => {
    expect(minutosDeHora("09:30")).toBe(570);
    expect(minutosDeHora("9:30")).toBe(570);
  });

  it("devuelve null con algo que no es una hora", () => {
    expect(minutosDeHora("")).toBeNull();
    expect(minutosDeHora("2026-09-25T10:00:00Z")).toBeNull();
  });
});

describe("esCitaDelDoctor", () => {
  it("reconoce al doctor aunque la cita lo escriba con tratamiento o sin tildes", () => {
    expect(esCitaDelDoctor({ doctor: "Dr. Juan Garcés" }, "Juan Garces")).toBe(true);
    expect(esCitaDelDoctor({ doctor: "Juan Garces" }, "Juan Garcés")).toBe(true);
  });

  it("no le muestra citas de otro profesional", () => {
    expect(esCitaDelDoctor({ doctor: "Dr. Yamileth Zerpa" }, "Nicolás Rojas")).toBe(false);
  });

  it("sin nombre no muestra nada, en vez de la agenda de toda la clínica", () => {
    expect(esCitaDelDoctor({ doctor: "Dr. Nicolás Rojas" }, "")).toBe(false);
    expect(esCitaDelDoctor({ doctor: "Dr. Nicolás Rojas" }, "   ")).toBe(false);
  });
});

describe("citasActivasDelDoctor", () => {
  it("deja solo las suyas, sin canceladas, ordenadas por hora", () => {
    const r = citasActivasDelDoctor([
      cita({ time: "15:00" }),
      cita({ time: "9:30" }),
      cita({ time: "11:00", status: "cancelled" }),
      cita({ time: "10:00", doctor: "Dr. Ivonne Poblete" }),
      cita({ time: "12:00", status: "pending", requestedVia: "agent" }),
    ], "Nicolás Rojas");

    expect(r.map((c) => c.time)).toEqual(["9:30", "12:00", "15:00"]);
  });
});

describe("proximaCita", () => {
  const hoy = [cita({ time: "09:00" }), cita({ time: "11:30" }), cita({ time: "16:00" })];

  it("es la primera que todavía no empieza, leyendo el campo time", () => {
    expect(proximaCita(hoy, alas("10:15"))?.time).toBe("11:30");
  });

  it("la que empieza justo ahora ya no es la próxima", () => {
    expect(proximaCita(hoy, alas("11:30"))?.time).toBe("16:00");
  });

  it("no hay próxima cuando ya pasaron todas", () => {
    expect(proximaCita(hoy, alas("18:00"))).toBeUndefined();
  });
});

describe("vistaDelPanel", () => {
  const doctor = { role: "USER" as const, mustChangePassword: false };

  it("un doctor con contraseña temporal ve la vista del doctor, pero con el cambio de contraseña obligatorio", () => {
    const r = vistaDelPanel({
      loading: false, user: { ...doctor, mustChangePassword: true }, tieneClinica: true, forzarPanelCompleto: false,
    });
    expect(r).toEqual({ vista: "doctor", pedirCambioDeContrasena: true });
  });

  it("al resto de los roles también se lo pide", () => {
    const r = vistaDelPanel({
      loading: false, user: { role: "ADMIN", mustChangePassword: true }, tieneClinica: true, forzarPanelCompleto: false,
    });
    expect(r).toEqual({ vista: "completo", pedirCambioDeContrasena: true });
  });

  it("un doctor sin contraseña temporal entra directo a su vista", () => {
    expect(vistaDelPanel({ loading: false, user: doctor, tieneClinica: true, forzarPanelCompleto: false }))
      .toEqual({ vista: "doctor", pedirCambioDeContrasena: false });
  });

  it("el doctor que pide el panel completo, o que no tiene clínica, ve el panel completo", () => {
    expect(vistaDelPanel({ loading: false, user: doctor, tieneClinica: true, forzarPanelCompleto: true }).vista)
      .toBe("completo");
    expect(vistaDelPanel({ loading: false, user: doctor, tieneClinica: false, forzarPanelCompleto: false }).vista)
      .toBe("completo");
  });

  it("mientras carga no decide nada", () => {
    expect(vistaDelPanel({ loading: true, user: null, tieneClinica: false, forzarPanelCompleto: false }))
      .toEqual({ vista: "cargando", pedirCambioDeContrasena: false });
  });
});
