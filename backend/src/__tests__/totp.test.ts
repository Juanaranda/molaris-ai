import { describe, it, expect } from "vitest";
import {
  base32Encode, base32Decode, codigoDelPaso, generarCodigo, verificarCodigo,
  generarSecreto, generarCodigosRespaldo, urlOtpauth, pasoDe, PERIODO_SEGUNDOS,
} from "../lib/totp";

/**
 * TOTP para el 2FA de los admins (#68).
 *
 * Lo importante acá son los vectores del RFC 6238: si el algoritmo está mal,
 * los códigos de Google Authenticator no van a calzar y el admin queda fuera de
 * su propia cuenta. Es la única prueba que sirve de verdad — un test escrito
 * contra mi propia implementación validaría el mismo error dos veces.
 */

// Secreto del RFC: "12345678901234567890" en ASCII.
const SECRETO_RFC = base32Encode(Buffer.from("12345678901234567890", "ascii"));

describe("base32", () => {
  it("ida y vuelta conserva los bytes", () => {
    const buf = Buffer.from("12345678901234567890", "ascii");
    expect(base32Decode(base32Encode(buf))).toEqual(buf);
  });

  it("el secreto del RFC se codifica como corresponde", () => {
    expect(SECRETO_RFC).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  });

  it("tolera minúsculas, espacios y el relleno, que es como se copia a mano", () => {
    const esperado = base32Decode(SECRETO_RFC);
    expect(base32Decode("gezdgnbv gy3tqojq gezdgnbv gy3tqojq")).toEqual(esperado);
    expect(base32Decode("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ====")).toEqual(esperado);
  });

  it("rechaza lo que no es base32", () => {
    expect(() => base32Decode("no-es-base32!")).toThrow(/base32/i);
  });
});

describe("vectores oficiales del RFC 6238 (SHA1)", () => {
  // Tabla del apéndice B del RFC, con 8 dígitos.
  const VECTORES: [number, string][] = [
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
    [20000000000, "65353130"],
  ];

  it.each(VECTORES)("T=%i produce %s", (t, esperado) => {
    const paso = Math.floor(t / PERIODO_SEGUNDOS);
    expect(codigoDelPaso(SECRETO_RFC, paso, 8)).toBe(esperado);
  });

  it("a 6 dígitos son los últimos 6 del vector", () => {
    expect(codigoDelPaso(SECRETO_RFC, Math.floor(59 / PERIODO_SEGUNDOS))).toBe("287082");
  });
});

describe("verificarCodigo", () => {
  const AHORA = new Date("2026-08-26T12:00:00.000Z");

  it("acepta el código vigente", () => {
    const codigo = generarCodigo(SECRETO_RFC, AHORA);
    expect(verificarCodigo(SECRETO_RFC, codigo, { t: AHORA }).valido).toBe(true);
  });

  it("tolera ±30 s, por el reloj corrido del teléfono", () => {
    const antes = new Date(AHORA.getTime() - PERIODO_SEGUNDOS * 1000);
    const despues = new Date(AHORA.getTime() + PERIODO_SEGUNDOS * 1000);
    expect(verificarCodigo(SECRETO_RFC, generarCodigo(SECRETO_RFC, antes), { t: AHORA }).valido).toBe(true);
    expect(verificarCodigo(SECRETO_RFC, generarCodigo(SECRETO_RFC, despues), { t: AHORA }).valido).toBe(true);
  });

  it("no acepta más allá de la ventana", () => {
    const lejos = new Date(AHORA.getTime() + 5 * PERIODO_SEGUNDOS * 1000);
    expect(verificarCodigo(SECRETO_RFC, generarCodigo(SECRETO_RFC, lejos), { t: AHORA }).valido).toBe(false);
  });

  it("rechaza basura sin reventar", () => {
    for (const malo of ["", "abcdef", "12345", "1234567", "12 34 56 78"]) {
      expect(verificarCodigo(SECRETO_RFC, malo, { t: AHORA }).valido).toBe(false);
    }
  });

  it("ignora los espacios que mete el que copia y pega", () => {
    const codigo = generarCodigo(SECRETO_RFC, AHORA);
    const conEspacios = `${codigo.slice(0, 3)} ${codigo.slice(3)}`;
    expect(verificarCodigo(SECRETO_RFC, conEspacios, { t: AHORA }).valido).toBe(true);
  });

  it("no deja reusar un código ya usado", () => {
    const codigo = generarCodigo(SECRETO_RFC, AHORA);
    const primera = verificarCodigo(SECRETO_RFC, codigo, { t: AHORA });
    expect(primera.valido).toBe(true);

    // Con el paso ya registrado, el mismo código no entra de nuevo — es lo que
    // frena a quien lo alcanzó a ver por encima del hombro.
    const segunda = verificarCodigo(SECRETO_RFC, codigo, { t: AHORA, ultimoPaso: primera.paso });
    expect(segunda.valido).toBe(false);
  });

  it("un código anterior al último usado tampoco entra", () => {
    const previo = generarCodigo(SECRETO_RFC, new Date(AHORA.getTime() - PERIODO_SEGUNDOS * 1000));
    const actual = pasoDe(AHORA);
    expect(verificarCodigo(SECRETO_RFC, previo, { t: AHORA, ultimoPaso: actual }).valido).toBe(false);
  });

  it("un secreto distinto no valida el código de otro", () => {
    const otro = generarSecreto();
    const codigo = generarCodigo(SECRETO_RFC, AHORA);
    expect(verificarCodigo(otro, codigo, { t: AHORA }).valido).toBe(false);
  });
});

describe("generarSecreto", () => {
  it("da 20 bytes, que es lo que recomienda el RFC para SHA1", () => {
    expect(base32Decode(generarSecreto())).toHaveLength(20);
  });

  it("no repite: dos secretos seguidos son distintos", () => {
    const secretos = new Set(Array.from({ length: 50 }, () => generarSecreto()));
    expect(secretos.size).toBe(50);
  });
});

describe("urlOtpauth", () => {
  it("arma la URL que las apps saben leer", () => {
    const url = urlOtpauth({ secret: SECRETO_RFC, cuenta: "juan@clinica.cl" });
    expect(url).toMatch(/^otpauth:\/\/totp\//);
    const u = new URL(url);
    expect(u.searchParams.get("secret")).toBe(SECRETO_RFC);
    expect(u.searchParams.get("issuer")).toBe("molari.ai");
    expect(u.searchParams.get("digits")).toBe("6");
    expect(u.searchParams.get("period")).toBe("30");
  });

  it("escapa la etiqueta: el correo lleva @ y rompería la URL", () => {
    const url = urlOtpauth({ secret: SECRETO_RFC, cuenta: "juan@clinica.cl" });
    expect(url).toContain("molari.ai%3Ajuan%40clinica.cl");
  });
});

describe("códigos de respaldo", () => {
  it("son ocho y no se repiten", () => {
    const codigos = generarCodigosRespaldo();
    expect(codigos).toHaveLength(8);
    expect(new Set(codigos).size).toBe(8);
  });

  it("van agrupados, porque se copian a mano", () => {
    for (const c of generarCodigosRespaldo()) expect(c).toMatch(/^\d{4}-\d{4}$/);
  });
});
