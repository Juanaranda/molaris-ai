import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { Button, Badge, Card, Field, Tabs } from "@/components/ui";

/**
 * Componentes base del panel (MOL-46). Se prueba lo que se rompe sin que se
 * vea: accesibilidad (etiquetas enlazadas, roles, teclado) y estados.
 */

describe("Button", () => {
  it("es type=button por defecto: no envía formularios sin querer", () => {
    render(<Button>Guardar</Button>);
    expect(screen.getByRole("button", { name: "Guardar" })).toHaveAttribute("type", "button");
  });

  it("cargando: deshabilitado y avisa que está ocupado", () => {
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>Guardar</Button>);
    const b = screen.getByRole("button");
    expect(b).toBeDisabled();
    expect(b).toHaveAttribute("aria-busy", "true");
    fireEvent.click(b);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("el tamaño normal tiene el alto mínimo de 44px", () => {
    render(<Button>Ok</Button>);
    expect(screen.getByRole("button").className).toContain("min-h-11");
  });
});

describe("Field", () => {
  it("tocar la etiqueta enfoca el campo (label enlazada)", () => {
    render(<Field label="RUT del paciente" />);
    expect(screen.getByLabelText("RUT del paciente").tagName).toBe("INPUT");
  });

  it("la ayuda y el error quedan asociados al campo", () => {
    render(<Field label="Correo" hint="Le llegan los recordatorios" error="Correo inválido" />);
    const campo = screen.getByLabelText("Correo");
    expect(campo).toHaveAttribute("aria-invalid", "true");
    expect(campo).toHaveAccessibleDescription("Le llegan los recordatorios Correo inválido");
  });

  it("sin error no se marca inválido", () => {
    render(<Field label="Nombre" />);
    expect(screen.getByLabelText("Nombre")).not.toHaveAttribute("aria-invalid");
  });

  it("multiline da un textarea con la misma etiqueta", () => {
    render(<Field label="Notas" multiline />);
    expect(screen.getByLabelText("Notas").tagName).toBe("TEXTAREA");
  });
});

describe("Card", () => {
  it("con título es una región con nombre", () => {
    render(<Card title="Agenda de hoy"><p>contenido</p></Card>);
    expect(screen.getByRole("region", { name: "Agenda de hoy" })).toBeInTheDocument();
  });

  it("sin título no inventa una región", () => {
    render(<Card><p>contenido</p></Card>);
    expect(screen.queryByRole("region")).toBeNull();
  });
});

describe("Badge", () => {
  it("el estado se lee en texto, no solo en el color", () => {
    render(<Badge tone="accent">Por confirmar</Badge>);
    expect(screen.getByText("Por confirmar")).toBeInTheDocument();
  });
});

describe("Tabs", () => {
  const ITEMS = [
    { id: "hoy", label: "Hoy" },
    { id: "agenda", label: "Agenda" },
    { id: "pacientes", label: "Pacientes", badge: 2 },
  ];
  function Prueba() {
    const [v, setV] = useState("hoy");
    return <Tabs label="Secciones" items={ITEMS} value={v} onChange={setV} />;
  }

  it("es un tablist con la pestaña activa marcada", () => {
    render(<Prueba />);
    expect(screen.getByRole("tablist", { name: "Secciones" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Hoy" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Agenda" })).toHaveAttribute("aria-selected", "false");
  });

  it("solo la activa entra en el orden de Tab", () => {
    render(<Prueba />);
    expect(screen.getByRole("tab", { name: "Hoy" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: "Agenda" })).toHaveAttribute("tabindex", "-1");
  });

  it("las flechas cambian de pestaña y dan la vuelta en los extremos", () => {
    render(<Prueba />);
    fireEvent.keyDown(screen.getByRole("tab", { name: "Hoy" }), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Agenda" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Agenda" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("tab", { name: "Agenda" }), { key: "End" });
    fireEvent.keyDown(screen.getByRole("tab", { name: /Pacientes/ }), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Hoy" })).toHaveAttribute("aria-selected", "true");
  });

  it("muestra el número cuando hay algo pendiente", () => {
    render(<Prueba />);
    expect(screen.getByRole("tab", { name: /Pacientes/ })).toHaveTextContent("2");
  });
});
