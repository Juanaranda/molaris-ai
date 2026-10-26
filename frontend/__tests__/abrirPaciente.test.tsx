import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/auth", () => ({ getToken: () => "token-de-prueba", getMe: vi.fn() }));

const { FilaPaciente, ProveedorPaciente } = await import("@/components/pacientes/AbrirPaciente");

/**
 * Los doctores llegan a sus pacientes por la agenda, no buscando nombres o
 * RUT. Tocar una cita en cualquier pantalla del panel abre el detalle completo
 * del paciente (agendar, ficha clínica, cuenta, planes, presupuestos).
 */

const PEDRO = {
  key: "6979904-3", name: "Pedro Pizarro Cerro", rut: "6979904-3", phone: null, email: null,
  visits: 2, lastVisit: "2026-10-26T12:00:00.000Z", lastDoctor: "Juan Garcés", services: [],
  totalCharged: 0, totalPaid: 0, pendingCount: 2,
};

let llamadas: { url: string; init?: RequestInit }[] = [];

beforeEach(() => {
  llamadas = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    llamadas.push({ url, init });
    const body = url.endsWith("/api/patients/uno") ? PEDRO : [];
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("abrir un paciente desde una cita", () => {
  it("fuera del panel la fila no es un botón", () => {
    render(<FilaPaciente paciente={{ name: "Pedro Pizarro Cerro", rut: "6979904-3" }}>18:30 Pedro</FilaPaciente>);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("en el panel, tocar la fila abre el detalle completo del paciente", async () => {
    render(
      <ProveedorPaciente>
        <FilaPaciente paciente={{ name: "Pedro Pizarro Cerro", rut: "6979904-3" }}>18:30 Pedro</FilaPaciente>
      </ProveedorPaciente>,
    );
    fireEvent.click(screen.getByRole("button", { name: /18:30 Pedro/ }));

    const detalle = await screen.findByRole("dialog", { name: "Pedro Pizarro Cerro" });
    expect(detalle).toBeTruthy();
    expect(screen.getByRole("button", { name: /Ficha clínica/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Agendar/ })).toBeTruthy();
  });

  it("el RUT viaja en el cuerpo, no en la URL (no queda en los logs)", async () => {
    render(
      <ProveedorPaciente>
        <FilaPaciente paciente={{ name: "Pedro Pizarro Cerro", rut: "6979904-3" }}>18:30 Pedro</FilaPaciente>
      </ProveedorPaciente>,
    );
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(llamadas.some((l) => l.url.endsWith("/api/patients/uno"))).toBe(true));

    const pedido = llamadas.find((l) => l.url.endsWith("/api/patients/uno"))!;
    expect(pedido.init?.method).toBe("POST");
    expect(pedido.url).not.toContain("6979904");
    expect(JSON.parse(String(pedido.init?.body))).toEqual({ rut: "6979904-3" });
  });

  it("sin RUT busca por nombre", async () => {
    render(
      <ProveedorPaciente>
        <FilaPaciente paciente={{ name: "Ana Rojas", rut: null }}>Ana</FilaPaciente>
      </ProveedorPaciente>,
    );
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(llamadas.some((l) => l.url.endsWith("/api/patients/uno"))).toBe(true));
    const pedido = llamadas.find((l) => l.url.endsWith("/api/patients/uno"))!;
    expect(JSON.parse(String(pedido.init?.body))).toEqual({ nombre: "Ana Rojas" });  // sin teléfono no se manda
  });
});
