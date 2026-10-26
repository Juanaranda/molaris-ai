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

/* ── Especialidades y días (onboarding, invitación) ─────────────────────── */

export const ESPECIALIDADES = [
  "Odontología General",
  "Ortodoncia",
  "Endodoncia",
  "Implantología",
  "Periodoncia",
  "Cirugía Oral",
  "Blanqueamiento",
  "Odontopediatría",
];

export const DIAS_SEMANA = [
  { clave: "monday", corto: "Lun" }, { clave: "tuesday", corto: "Mar" }, { clave: "wednesday", corto: "Mié" },
  { clave: "thursday", corto: "Jue" }, { clave: "friday", corto: "Vie" }, { clave: "saturday", corto: "Sáb" },
  { clave: "sunday", corto: "Dom" },
] as const;

/* ── A quién pertenece una cita (MOL-55) ─────────────────────────────────── */

/** Un profesional del equipo: id estable, nombre, y su cuenta si la tiene. */
export interface RefProfesional { id?: string | null; name: string; userId?: string | null }

/** Para comparar nombres de citas antiguas: sin "Dr.", tildes, mayúsculas ni dobles espacios. */
export function normalizarNombre(nombre: string): string {
  return sinPrefijo(nombre).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * ¿La cita es de este profesional? Por id cuando la cita y el profesional lo
 * tienen. Si no (citas anteriores al id, o de alguien que ya no está), por el
 * nombre completo: nunca por apellido, que juntaba a dos Rojas.
 */
export function esDelProfesional(cita: { doctor?: string | null; doctorId?: string | null }, prof: RefProfesional): boolean {
  if (cita.doctorId && prof.id) return cita.doctorId === prof.id;
  const a = normalizarNombre(cita.doctor ?? "");
  return a !== "" && a === normalizarNombre(prof.name);
}

/**
 * El profesional del equipo que corresponde a una cuenta: el unido a ella
 * (MOL-54) o, si no hay, el de su mismo nombre. Sin ninguno, solo el nombre.
 */
export function profesionalDeUsuario(equipo: RefProfesional[] | undefined, user: { id: string; name?: string | null }): RefProfesional {
  const lista = equipo ?? [];
  const nombre = normalizarNombre(user.name ?? "");
  return lista.find((p) => p.userId && p.userId === user.id)
    ?? lista.find((p) => nombre !== "" && normalizarNombre(p.name) === nombre)
    ?? { name: user.name ?? "" };
}
