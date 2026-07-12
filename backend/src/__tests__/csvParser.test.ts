/**
 * Tests del parser CSV de patients.ts (papaparse).
 * Cubren los formatos reales de Reservo y DentaLink:
 * - delimitador ; o ,
 * - headers con tildes y mayúsculas
 * - valores con comillas
 * - filas vacías intercaladas
 */

import { describe, it, expect } from "vitest";
import Papa from "papaparse";

// Replicamos la firma del parseCSV interno para testearlo directamente sin
// arrastrar todo el route. Si cambia la implementación de patients.ts, este
// test debería actualizarse en espejo.
function parseCSV(content: string): Record<string, string>[] {
  const trimmed = content.trim();
  if (!trimmed) return [];
  const result = Papa.parse<Record<string, string>>(trimmed, {
    header:           true,
    skipEmptyLines:   "greedy",
    delimitersToGuess: [",", ";", "\t", "|"],
    transformHeader:  (h) => h.trim().toLowerCase().replace(/^["']|["']$/g, ""),
    transform:        (v) => (typeof v === "string" ? v.trim().replace(/^["']|["']$/g, "") : v),
  });
  return result.data.filter((row) =>
    row && Object.values(row).some((v) => v !== "" && v != null)
  );
}

describe("parseCSV (papaparse)", () => {
  it("parsea CSV con delimitador coma", () => {
    const csv = `nombre,rut,telefono
Juan Pérez,12345678-9,+56912345678
María González,98765432-1,+56987654321`;
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ nombre: "Juan Pérez", rut: "12345678-9", telefono: "+56912345678" });
    expect(rows[1].nombre).toBe("María González");
  });

  it("auto-detecta delimitador ; (formato Reservo/DentaLink)", () => {
    const csv = `Nombre;RUT;Teléfono Móvil;Email
Juan Pérez;12.345.678-9;+56912345678;juan@test.cl
Ana Soto;9.876.543-2;+56987654321;ana@test.cl`;
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(2);
    expect(Object.keys(rows[0])).toContain("teléfono móvil");
    expect(rows[0]["teléfono móvil"]).toBe("+56912345678");
  });

  it("normaliza headers a minúsculas y elimina espacios", () => {
    const csv = `  Nombre Completo , RUT , Email
Juan,11111111-1,j@test.cl`;
    const rows = parseCSV(csv);
    expect(Object.keys(rows[0])).toEqual(["nombre completo", "rut", "email"]);
  });

  it("maneja valores entre comillas con el delimitador adentro", () => {
    const csv = `nombre,observacion
Juan,"alergia, paracetamol"
Ana,"sin observaciones"`;
    const rows = parseCSV(csv);
    expect(rows[0].observacion).toBe("alergia, paracetamol");
    expect(rows[1].observacion).toBe("sin observaciones");
  });

  it("descarta filas completamente vacías", () => {
    const csv = `nombre,rut
Juan,11111111-1

Ana,22222222-2

`;
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.nombre)).toEqual(["Juan", "Ana"]);
  });

  it("retorna [] si el CSV está vacío o solo tiene header", () => {
    expect(parseCSV("")).toEqual([]);
    expect(parseCSV("   ")).toEqual([]);
    expect(parseCSV("nombre,rut")).toEqual([]);
  });

  it("trimea valores y descarta comillas envolventes", () => {
    const csv = `nombre,rut
"  Juan  ","'11111111-1'"
'Ana',22222222-2`;
    const rows = parseCSV(csv);
    expect(rows[0].nombre).toBe("Juan");
    expect(rows[0].rut).toBe("11111111-1");
    expect(rows[1].nombre).toBe("Ana");
  });
});
