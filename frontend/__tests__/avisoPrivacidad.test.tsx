import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AvisoPrivacidadChat } from "@/components/AvisoPrivacidadChat";

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
