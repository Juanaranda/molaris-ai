/**
 * Cálculos de presentación de la agenda (vista del día por box).
 *
 * Solo deciden cómo se muestra lo que ya llegó del backend: no cambian ninguna
 * cita. Viven fuera del componente para probar los bordes sin montar la agenda.
 */

/** Media hora a la que pertenece una hora: "10:40" → "10:30", "9:05" → "09:00". */
export function tramoDe(hora: string): string {
  const [h, m] = hora.split(":").map(Number);
  return `${String(h).padStart(2, "0")}:${m < 30 ? "00" : "30"}`;
}

export interface CitaEnBox {
  id: string;
  time: string;
  box: string | null;
  status: string;
}

/**
 * Choques de box: dos citas activas en el mismo box y la misma media hora.
 * Las citas no guardan duración, así que el tramo de 30 minutos es lo único
 * que permite ver que dos personas quedaron en el mismo sillón.
 * Devuelve, por id, la otra cita con la que choca. Sin box no hay choque.
 */
export function choquesDeBox<T extends CitaEnBox>(citas: T[]): Map<string, T> {
  const porLugar = new Map<string, T[]>();
  for (const c of citas) {
    if (c.status === "cancelled" || !c.box) continue;
    const clave = `${c.box}|${tramoDe(c.time)}`;
    porLugar.set(clave, [...(porLugar.get(clave) ?? []), c]);
  }
  const choques = new Map<string, T>();
  for (const grupo of porLugar.values()) {
    if (grupo.length < 2) continue;
    for (const c of grupo) choques.set(c.id, grupo.find((o) => o.id !== c.id)!);
  }
  return choques;
}

/**
 * Nombre corto del profesional para una agenda angosta: "Dr. Ivonne Poblete"
 * → "Dr. Poblete". Sin "Dr."/"Dra." al inicio se deja tal cual ("Sin asignar").
 */
export function nombreCorto(nombre: string): string {
  const m = /^(Dra?\.)\s+(.+)$/.exec(nombre.trim());
  if (!m) return nombre.trim();
  const apellido = m[2].split(/\s+/).pop();
  return `${m[1]} ${apellido}`;
}

/**
 * Filas de la vista del día: los tramos de la grilla más los de cualquier cita
 * que caiga fuera (una a las 8:30 o a las 19:00), para que ninguna quede oculta.
 */
export function tramosDelDia(grilla: string[], horasDeCitas: string[]): string[] {
  const todos = new Set(grilla);
  for (const h of horasDeCitas) todos.add(tramoDe(h));
  return [...todos].sort();
}
