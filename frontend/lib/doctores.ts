/**
 * Nombre y RUT de los profesionales del equipo.
 *
 * Se piden nombres y apellidos por separado, sin "Dr." ni "Dra.": el prefijo
 * no es parte del nombre y adivinarlo desde el nombre es equivocarse. En la
 * configuración se sigue guardando `name` (nombres + apellidos) porque es lo
 * que usan la agenda, el agente y las citas ya creadas.
 */

/** "Dr. Juan Pérez" → "Juan Pérez". */
export function sinPrefijo(nombre: string): string {
  return nombre.replace(/^\s*(dr|dra|doctor|doctora)\.?\s+/i, "").trim();
}

export function nombreCompleto(nombres: string, apellidos: string): string {
  return [sinPrefijo(nombres), apellidos.trim()].filter(Boolean).join(" ").replace(/\s+/g, " ");
}

/**
 * Para profesionales guardados antes, con todo en `name`: lo separa como se
 * escribe en Chile, dos nombres y dos apellidos. Con tres palabras supone un
 * nombre y dos apellidos. Es una sugerencia: la persona lo corrige al editar.
 */
export function separarNombre(nombre: string): { nombres: string; apellidos: string } {
  const palabras = sinPrefijo(nombre).split(/\s+/).filter(Boolean);
  if (palabras.length <= 1) return { nombres: palabras[0] ?? "", apellidos: "" };
  if (palabras.length === 2) return { nombres: palabras[0], apellidos: palabras[1] };
  if (palabras.length === 3) return { nombres: palabras[0], apellidos: palabras.slice(1).join(" ") };
  return { nombres: palabras.slice(0, -2).join(" "), apellidos: palabras.slice(-2).join(" ") };
}

/* ── RUT (módulo 11), igual que backend/src/lib/rut.ts ─────────────────── */

function limpiarRut(rut: string): string {
  return rut.replace(/[.\-\s]/g, "").toUpperCase();
}

function digitoVerificador(cuerpo: string): string {
  let suma = 0;
  let mul = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i], 10) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const res = 11 - (suma % 11);
  return res === 11 ? "0" : res === 10 ? "K" : String(res);
}

export function rutValido(rut: string): boolean {
  const limpio = limpiarRut(rut);
  if (!/^\d{7,8}[0-9K]$/.test(limpio)) return false;
  return digitoVerificador(limpio.slice(0, -1)) === limpio.slice(-1);
}

/** Da formato mientras se escribe: "123456785" → "12.345.678-5". */
export function formatearRut(rut: string): string {
  const limpio = limpiarRut(rut).replace(/[^0-9K]/g, "").slice(0, 9);
  if (limpio.length < 2) return limpio;
  const cuerpo = limpio.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${cuerpo}-${limpio.slice(-1)}`;
}
