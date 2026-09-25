import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { clinicaSinSecretos, CAMPOS_SECRETOS } from "../lib/clinicaSinSecretos";

/**
 * Las credenciales de una clínica no salen del backend (MOL-29).
 *
 * Tres rutas devolvían la fila entera a cualquier persona del equipo, con el
 * token de WhatsApp, el de Mercado Pago y las keys del SII y de ZapSign.
 */

const CLINICA = {
  id: "c1", name: "Galana", slug: "galana", phone: "+56 2 1234", config: {},
  apiKey: "cuid-secreto", waToken: "EAAG-meta", mpAccessToken: "APP_USR-mp",
  siiApiKey: "sii-key", zapsignApiKey: "zap-key",
  waPhoneId: "123", waVerified: true, mpVerified: true,
};

describe("clinicaSinSecretos", () => {
  it("saca todas las credenciales", () => {
    const limpia = clinicaSinSecretos(CLINICA) as Record<string, unknown>;
    for (const campo of CAMPOS_SECRETOS) expect(limpia).not.toHaveProperty(campo);
  });

  it("ningún valor secreto aparece en ninguna parte de la respuesta", () => {
    // Mira el JSON final, que es lo que viaja al navegador: si algún día el
    // secreto se copiara a otro campo, este test lo ve igual.
    const json = JSON.stringify(clinicaSinSecretos(CLINICA));
    for (const valor of ["cuid-secreto", "EAAG-meta", "APP_USR-mp", "sii-key", "zap-key"]) {
      expect(json).not.toContain(valor);
    }
  });

  it("conserva lo que el panel sí usa", () => {
    const limpia = clinicaSinSecretos(CLINICA);
    expect(limpia).toMatchObject({ id: "c1", name: "Galana", slug: "galana", waVerified: true, mpVerified: true });
  });

  it("no modifica el objeto original", () => {
    const original = { ...CLINICA };
    clinicaSinSecretos(original);
    expect(original.waToken).toBe("EAAG-meta");
  });

  it("toda columna de Clinic con cara de secreto está cubierta", () => {
    // La guarda contra el olvido: si alguien agrega una columna como
    // `transbankApiKey` y no la suma a CAMPOS_SECRETOS, se filtraría por las
    // mismas rutas. Este test lee el modelo real de Prisma y falla primero.
    const pareceSecreto = /token|key|secret|password/i;
    const columnas = Object.values(Prisma.ClinicScalarFieldEnum) as string[];
    const sospechosas = columnas.filter((c) => pareceSecreto.test(c));
    const sinCubrir = sospechosas.filter((c) => !(CAMPOS_SECRETOS as readonly string[]).includes(c));
    expect(sinCubrir, `columnas secretas sin filtrar: ${sinCubrir.join(", ")}`).toEqual([]);
  });
});
