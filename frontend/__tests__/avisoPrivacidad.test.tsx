import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AvisoPrivacidadChat } from "@/components/AvisoPrivacidadChat";
import { AvisoIaEditor, MAX_AVISO_CLINICA } from "@/components/AvisoIaEditor";

/**
 * Aviso al paciente antes de conversar con el asistente (MOL-11, borrador
 * pendiente de revisión legal). Debe decir lo mismo que el de WhatsApp.
 */
describe("AvisoPrivacidadChat", () => {
  it("dice que responde una IA de la clínica y que se procesa fuera de Chile", () => {
    render(<AvisoPrivacidadChat nombreClinica="Galana Clínica Dental" />);
    const nota = screen.getByRole("note");
    expect(nota).toHaveTextContent("asistente de inteligencia artificial de Galana Clínica Dental");
    expect(nota).toHaveTextContent("fuera de Chile");
  });

  it("enlaza la política de privacidad en otra pestaña, marcada como borrador", () => {
    render(<AvisoPrivacidadChat nombreClinica="Galana" />);
    const link = screen.getByRole("link", { name: "Política de privacidad (borrador)" });
    expect(link).toHaveAttribute("href", "/legal/privacidad");
    expect(link).toHaveAttribute("target", "_blank");
  });
});

describe("AvisoPrivacidadChat con el texto de la clínica", () => {
  it("pone el texto de la clínica antes y mantiene el aviso fijo", () => {
    render(<AvisoPrivacidadChat nombreClinica="Clínica Dental Aurora" textoClinica="¡Hola! Soy Sofía." />);
    const nota = screen.getByRole("note");
    expect(nota.textContent?.startsWith("¡Hola! Soy Sofía.")).toBe(true);
    expect(nota).toHaveTextContent("asistente de inteligencia artificial de Clínica Dental Aurora");
    expect(nota).toHaveTextContent("fuera de Chile");
  });

  it("muestra el texto como texto, no como HTML", () => {
    render(<AvisoPrivacidadChat nombreClinica="Aurora" textoClinica={'<a href="https://x.test">premio</a>'} />);
    expect(screen.getAllByRole("link")).toHaveLength(1); // solo el de la política
  });
});

describe("AvisoIaEditor", () => {
  it("la vista previa siempre trae la parte fija, aunque la clínica no escriba nada", () => {
    render(<AvisoIaEditor nombreClinica="Clínica Dental Aurora" texto="" canEdit onSave={vi.fn()} />);
    expect(screen.getByRole("note")).toHaveTextContent("asistente de inteligencia artificial de Clínica Dental Aurora");
  });

  it("guarda el texto sin espacios de más", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<AvisoIaEditor nombreClinica="Aurora" texto="" canEdit onSave={onSave} />);
    await userEvent.click(screen.getByRole("button", { name: "Editar" }));
    await userEvent.type(screen.getByLabelText("Tu texto (opcional)"), "  Hola, soy Sofía.  ");
    expect(screen.getByRole("note").textContent?.startsWith("Hola, soy Sofía.")).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(onSave).toHaveBeenCalledWith("Hola, soy Sofía.");
  });

  it("no deja guardar un texto más largo que el máximo", async () => {
    render(<AvisoIaEditor nombreClinica="Aurora" texto={"a".repeat(MAX_AVISO_CLINICA + 1)} canEdit onSave={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Editar" }));
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
  });

  it("sin permiso no aparece el botón de editar", () => {
    render(<AvisoIaEditor nombreClinica="Aurora" texto="Hola" canEdit={false} onSave={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Editar" })).toBeNull();
  });
});
