import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PatientSuggestion } from "@/lib/patients";

/**
 * El autocompletar de pacientes. Lo que se prueba acá es lo que decide a quién
 * se le agenda la hora: que al elegir de la lista salgan los datos de la ficha
 * y no los que alguien tipeó, y que al soltar al paciente no quede pegado el
 * RUT del anterior.
 */

// Las fechas van fijas y distintas a propósito. Los dos calzan igual de bien
// con "jose", así que el orden lo decide la última visita: con `new Date()` en
// ambos, que quedaran o no en el mismo milisegundo cambiaba quién iba primero
// y el test de teclado pasaba o fallaba según el reloj de la máquina.
const PACIENTES: PatientSuggestion[] = [
  { key: "1", name: "José Pérez Soto", rut: "12.345.678-9", phone: "+56911111111",
    email: "jose@mail.cl", visits: 3, lastVisit: "2026-08-20T10:00:00.000Z",
    lastDoctor: "Dr. Ivonne Poblete", services: [] },
  { key: "2", name: "Josefina Ramírez", rut: "9.876.543-2", phone: null, email: null,
    visits: 1, lastVisit: "2026-07-02T10:00:00.000Z", lastDoctor: "Dr. Nicolás Rojas", services: [] },
];

const fetchPatientsMock = vi.fn();
vi.mock("@/lib/patients", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/patients")>();
  // Solo se reemplaza la llamada de red; la lógica de búsqueda es la de verdad,
  // que es justamente lo que interesa ejercitar desde la UI.
  return { ...real, fetchPatients: () => fetchPatientsMock() };
});

import { PatientAutocomplete } from "@/components/PatientAutocomplete";

function montar(props: Partial<React.ComponentProps<typeof PatientAutocomplete>> = {}) {
  const onChange = vi.fn();
  const onSelect = vi.fn();
  const onClear  = vi.fn();
  const utils = render(
    <PatientAutocomplete
      value="" seleccionado={false} inputClassName="input"
      onChange={onChange} onSelect={onSelect} onClear={onClear} {...props}
    />
  );
  return { onChange, onSelect, onClear, ...utils };
}

beforeEach(() => { fetchPatientsMock.mockResolvedValue(PACIENTES); });

describe("PatientAutocomplete", () => {
  it("sugiere los pacientes que calzan con lo escrito", async () => {
    const user = userEvent.setup();
    const { rerender, onChange } = montar();
    await waitFor(() => expect(fetchPatientsMock).toHaveBeenCalled());

    await user.type(screen.getByRole("combobox"), "jose");
    // El componente es controlado: el padre devuelve el valor nuevo.
    expect(onChange).toHaveBeenCalled();
    rerender(
      <PatientAutocomplete value="jose" seleccionado={false} inputClassName="input"
        onChange={onChange} onSelect={vi.fn()} onClear={vi.fn()} />
    );
    await user.click(screen.getByRole("combobox"));

    // El nombre viene partido por el resaltado (<mark>), así que se compara el
    // texto de la opción completa, que es lo que el usuario lee como una línea.
    const opciones = await screen.findAllByRole("option");
    const nombres = opciones.map((o) => o.textContent);
    expect(nombres.some((n) => n?.includes("José Pérez Soto"))).toBe(true);
    expect(nombres.some((n) => n?.includes("Josefina Ramírez"))).toBe(true);
  });

  it("al elegir uno entrega la ficha completa, para poder rellenar RUT y contacto", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    montar({ value: "jose", onSelect });
    await waitFor(() => expect(fetchPatientsMock).toHaveBeenCalled());

    await user.click(screen.getByRole("combobox"));
    const opcion = (await screen.findAllByRole("option"))
      .find((o) => o.textContent?.includes("José Pérez Soto"))!;
    await user.click(within(opcion).getByRole("button"));

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ name: "José Pérez Soto", rut: "12.345.678-9", phone: "+56911111111" })
    );
  });

  it("con un paciente ya elegido no ofrece sugerencias ni deja editar el nombre a mano", async () => {
    montar({ value: "José Pérez Soto", seleccionado: true });
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText("Paciente ya registrado")).toBeInTheDocument();
  });

  it("el botón de quitar avisa al padre para que limpie también RUT y teléfono", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    montar({ value: "José Pérez Soto", seleccionado: true, onClear });

    await user.click(screen.getByRole("button", { name: /quitar paciente/i }));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("se puede elegir con el teclado, sin soltar el nombre", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    montar({ value: "jose", onSelect });
    await waitFor(() => expect(fetchPatientsMock).toHaveBeenCalled());

    const input = screen.getByRole("combobox");
    await user.click(input);
    const opciones = await screen.findAllByRole("option");
    // Se fija el orden esperado antes de navegar: si el ranking cambiara, el
    // test debe fallar acá diciendo por qué, y no en el nombre que salió.
    expect(opciones[0].textContent).toContain("José Pérez Soto");

    await user.keyboard("{ArrowDown}{Enter}");

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ name: "Josefina Ramírez" }));
  });

  it("si la lista de pacientes no carga, el campo sigue sirviendo para escribir a mano", async () => {
    fetchPatientsMock.mockRejectedValue(new Error("sin red"));
    const user = userEvent.setup();
    const { onChange } = montar();

    const input = await screen.findByRole("combobox");
    await user.type(input, "Paciente Nuevo");
    expect(onChange).toHaveBeenCalled();
    // Sin sugerencias, pero sin bloquear el agendamiento.
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
