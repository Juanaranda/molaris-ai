import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AgentFlowDiagram, type AgentFlowConfig } from "@/components/AgentFlowDiagram";

/**
 * El nodo "Llega un mensaje" le dice a la clínica por dónde contesta su agente.
 *
 * El Instagram de la clínica es solo su handle de perfil: molari no recibe ni
 * contesta mensajes de Instagram. Si el diagrama lo nombrara, le prometería a
 * la clínica un canal que no existe.
 */

function detalleEntrada(config: AgentFlowConfig) {
  render(<AgentFlowDiagram config={config} />);
  const titulo = screen.getByText("Llega un mensaje");
  return titulo.closest("li")?.textContent ?? "";
}

describe("AgentFlowDiagram — canales de entrada", () => {
  it("con WhatsApp configurado lista WhatsApp y sitio web", () => {
    expect(detalleEntrada({ whatsapp: "+56 9 1111 1111" })).toContain("WhatsApp y sitio web");
  });

  it("sin WhatsApp lista solo el sitio web", () => {
    const texto = detalleEntrada({});
    expect(texto).toContain("sitio web");
    expect(texto).not.toContain("WhatsApp");
  });

  it("un handle de Instagram no hace aparecer Instagram", () => {
    // La config real de la clínica puede traer el handle; el diagrama debe ignorarlo.
    const config = { whatsapp: "+56 9 1111 1111", instagram: "@clinica" } as AgentFlowConfig;
    render(<AgentFlowDiagram config={config} />);
    expect(screen.queryByText(/instagram/i)).toBeNull();
  });
});
