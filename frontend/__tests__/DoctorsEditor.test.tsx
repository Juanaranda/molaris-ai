import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DoctorsEditor, type DoctorRow } from "@/components/DoctorsEditor";

/**
 * Lo que se prueba acá es el aviso de "sin aviso".
 *
 * Un profesional sin WhatsApp ni correo no puede confirmar las horas que pide
 * el agente: el mensaje no tiene a dónde salir y la solicitud caduca sola a las
 * 24 horas. Antes eso solo quedaba en un console.warn del servidor, así que la
 * clínica veía caducar horas sin saber por qué.
 */

function montar(doctors: DoctorRow[]) {
  return render(
    <DoctorsEditor doctors={doctors} boxes={2} canEdit onSave={vi.fn()} />
  );
}

const CON_TELEFONO: DoctorRow = {
  name: "Dr. Ivonne Poblete", specialty: "Cirujano Dentista",
  schedule: "Lun/Mié", phone: "+56 9 1111 1111",
};
const SIN_CONTACTO: DoctorRow = {
  name: "Dr. Nicolás Rojas", specialty: "Cirujano Dentista", schedule: "Mar/Jue",
};

describe("DoctorsEditor — aviso de contacto faltante", () => {
  it("marca al profesional que no tiene por dónde recibir el aviso", () => {
    montar([SIN_CONTACTO]);
    expect(screen.getByText("sin aviso")).toBeInTheDocument();
    expect(screen.getByText(/caduca sola a las 24 horas/i)).toBeInTheDocument();
  });

  it("no molesta cuando todos tienen al menos un canal", () => {
    montar([CON_TELEFONO, { ...SIN_CONTACTO, email: "rojas@clinica.cl" }]);
    expect(screen.queryByText("sin aviso")).not.toBeInTheDocument();
  });

  it("un contacto en blanco no cuenta como contacto", () => {
    montar([{ ...SIN_CONTACTO, phone: "   ", email: "  " }]);
    expect(screen.getByText("sin aviso")).toBeInTheDocument();
  });

  it("cuenta cuántos faltan, para no revisarlos uno por uno", () => {
    montar([SIN_CONTACTO, { ...SIN_CONTACTO, name: "Dr. Yamileth Zerpa" }, CON_TELEFONO]);
    expect(screen.getByText(/Hay 2 profesionales sin WhatsApp ni correo/i)).toBeInTheDocument();
  });
});
