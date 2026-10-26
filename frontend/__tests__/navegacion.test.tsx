import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { seccionesDelPanel, repartirParaCelular } from "@/lib/navegacion";
import { NavCelular } from "@/components/dashboard/NavCelular";
import type { Tab } from "@/components/dashboard/types";

/**
 * Navegación del panel en el celular (MOL-46): cuatro secciones de todos los
 * días en la barra inferior y el resto en "Más", en vez de once pestañas que
 * había que deslizar de lado.
 */

describe("seccionesDelPanel", () => {
  it("una clínica con admin ve todas, equipo e inventario incluidos", () => {
    const ids = seccionesDelPanel({ rol: "ADMIN", tipoCuenta: "clinic" }).map((s) => s.id);
    expect(ids).toContain("equipo");
    expect(ids).toContain("inventario");
    expect(ids).toContain("finanzas");
    expect(ids).toHaveLength(12);
  });

  it("el doctor independiente (plan Solo) no ve equipo ni inventario, y su clínica se llama consulta", () => {
    const s = seccionesDelPanel({ rol: "ADMIN", tipoCuenta: "solo" });
    expect(s.map((x) => x.id)).not.toContain("equipo");
    expect(s.map((x) => x.id)).not.toContain("inventario");
    expect(s.find((x) => x.id === "clinica")?.label).toBe("Mi consulta");
  });

  it("van por uso: lo de todos los días primero y el perfil propio al final", () => {
    expect(seccionesDelPanel({ rol: "ADMIN", tipoCuenta: "clinic" }).map((s) => s.id)).toEqual([
      "inicio", "agenda", "patients", "bookings", "conversaciones", "analytics", "finanzas",
      "inventario", "equipo", "clinica", "config", "perfil",
    ]);
  });

  it("un usuario sin rol de admin no ve Equipo ni Finanzas", () => {
    const ids = seccionesDelPanel({ rol: "USER", tipoCuenta: "clinic" }).map((s) => s.id);
    expect(ids).not.toContain("equipo");
    expect(ids).not.toContain("finanzas");
  });
});

describe("repartirParaCelular", () => {
  it("la barra lleva Hoy, Agenda, Pacientes y Mensajes en ese orden; nada se pierde", () => {
    const todas = seccionesDelPanel({ rol: "ADMIN", tipoCuenta: "clinic" });
    const { barra, mas } = repartirParaCelular(todas);
    expect(barra.map((s) => s.corto ?? s.label)).toEqual(["Hoy", "Agenda", "Pacientes", "Mensajes"]);
    expect(barra.length + mas.length).toBe(todas.length);
    expect(mas.map((s) => s.id)).toContain("bookings");
  });
});

describe("NavCelular", () => {
  function Prueba({ inicial = "inicio" as Tab, onChange = vi.fn() }) {
    const [activa, setActiva] = useState<Tab>(inicial);
    return <NavCelular secciones={seccionesDelPanel({ rol: "ADMIN", tipoCuenta: "clinic" })} activa={activa}
      onChange={(t) => { setActiva(t); onChange(t); }} />;
  }

  it("marca la sección activa y cambia al tocar otra", () => {
    render(<Prueba />);
    expect(screen.getByRole("button", { name: "Hoy" })).toHaveAttribute("aria-current", "page");
    fireEvent.click(screen.getByRole("button", { name: "Pacientes" }));
    expect(screen.getByRole("button", { name: "Pacientes" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Hoy" })).not.toHaveAttribute("aria-current");
  });

  it("Más abre una hoja con el resto; elegir una sección la cierra y la activa", () => {
    const onChange = vi.fn();
    render(<Prueba onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Más" }));
    const hoja = screen.getByRole("dialog", { name: "Más secciones" });
    expect(hoja).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Citas" }));
    expect(onChange).toHaveBeenCalledWith("bookings");
    expect(screen.queryByRole("dialog")).toBeNull();
    // Con una sección de "Más" activa, el botón Más se ve activo.
    expect(screen.getByRole("button", { name: "Más" })).toHaveAttribute("aria-current", "page");
  });

  it("Escape cierra la hoja y devuelve el foco al botón Más", () => {
    render(<Prueba />);
    const mas = screen.getByRole("button", { name: "Más" });
    fireEvent.click(mas);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mas).toHaveFocus();
  });
});
