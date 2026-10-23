import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Dialogo, Select } from "@/components/ui";

describe("Select", () => {
  it("tocar la etiqueta enfoca el desplegable (label enlazada)", () => {
    render(<Select label="Profesional"><option>Dr. Poblete</option></Select>);
    expect(screen.getByLabelText("Profesional").tagName).toBe("SELECT");
  });
});

describe("Dialogo", () => {
  it("tiene nombre accesible y el foco entra al abrirlo", () => {
    render(<Dialogo titulo="Nuevo paciente" onClose={() => {}}>contenido</Dialogo>);
    const d = screen.getByRole("dialog", { name: "Nuevo paciente" });
    expect(d).toHaveFocus();
  });

  it("Escape cierra solo el diálogo de más arriba", () => {
    const abajo = vi.fn(), arriba = vi.fn();
    render(
      <>
        <Dialogo titulo="Paciente" onClose={abajo}>a</Dialogo>
        <Dialogo titulo="Nuevo plan" onClose={arriba}>b</Dialogo>
      </>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(arriba).toHaveBeenCalledTimes(1);
    expect(abajo).not.toHaveBeenCalled();
  });

  it("el botón Cerrar tiene nombre", () => {
    const onClose = vi.fn();
    render(<Dialogo titulo="Importar" onClose={onClose}>x</Dialogo>);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(onClose).toHaveBeenCalled();
  });
});
