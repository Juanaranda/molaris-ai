import { getToken } from "./auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface PatientSuggestion {
  key: string;
  name: string;
  rut: string | null;
  phone: string | null;
  email: string | null;
  visits: number;
  lastVisit: string;
  lastDoctor: string;
  services: string[];
}

/**
 * Búsqueda de pacientes ya registrados para no tipearlos de nuevo al agendar.
 *
 * La lista se trae entera una vez y se filtra en memoria: el back la arma
 * agregando todas las citas, así que consultarla en cada tecla sería caro y
 * lento. Filtrando local, el desplegable responde al instante — que es lo
 * único que hace que un autocompletar se sienta útil y no un estorbo.
 */

let cache: { data: PatientSuggestion[]; at: number } | null = null;
let enVuelo: Promise<PatientSuggestion[]> | null = null;
const TTL_MS = 60_000;

/** Se llama al crear una cita: si no, el paciente nuevo no aparece hasta que expire el TTL. */
export function invalidatePatientsCache(): void {
  cache = null;
  enVuelo = null;
}

export async function fetchPatients(): Promise<PatientSuggestion[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  // Si dos componentes piden a la vez, comparten la misma petición.
  if (enVuelo) return enVuelo;

  enVuelo = (async () => {
    const res = await fetch(`${API}/api/patients`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) throw new Error("No pudimos cargar los pacientes");
    const data = (await res.json()) as PatientSuggestion[];
    cache = { data, at: Date.now() };
    enVuelo = null;
    return data;
  })();

  try {
    return await enVuelo;
  } catch (err) {
    enVuelo = null;
    throw err;
  }
}

/** Sin tildes, sin mayúsculas: escribir "jose" tiene que encontrar a "José". */
export function normalizar(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

/** Solo dígitos y K: así "12345678-9", "12.345.678-9" y "123456789" son lo mismo. */
function soloRut(s: string): string {
  return s.replace(/[^0-9kK]/g, "").toLowerCase();
}

/**
 * Busca por nombre, RUT o teléfono. Ordena por cercanía del match y, a igual
 * cercanía, por visita más reciente: quien vino la semana pasada es más
 * probable que vuelva que alguien de hace tres años.
 */
export function buscarPacientes(
  pacientes: PatientSuggestion[],
  consulta: string,
  limite = 6
): PatientSuggestion[] {
  const q = normalizar(consulta);
  if (q.length < 2) return [];

  const qRut = soloRut(consulta);
  const esRut = qRut.length >= 2 && /^[0-9]/.test(qRut);

  const puntuados: { p: PatientSuggestion; score: number }[] = [];

  for (const p of pacientes) {
    const nombre = normalizar(p.name);
    let score = -1;

    if (nombre.startsWith(q)) score = 0;
    else if (nombre.split(/\s+/).some((parte) => parte.startsWith(q))) score = 1;
    else if (nombre.includes(q)) score = 2;

    if (esRut && p.rut && soloRut(p.rut).startsWith(qRut)) score = score === -1 ? 0 : Math.min(score, 0);
    if (p.phone && soloRut(p.phone).includes(qRut) && qRut.length >= 4) score = score === -1 ? 3 : score;

    if (score >= 0) puntuados.push({ p, score });
  }

  return puntuados
    .sort((a, b) =>
      a.score !== b.score
        ? a.score - b.score
        : new Date(b.p.lastVisit).getTime() - new Date(a.p.lastVisit).getTime()
    )
    .slice(0, limite)
    .map((x) => x.p);
}

/** "hace 3 días", "hace 2 meses" — más legible que una fecha suelta. */
export function haceCuanto(iso: string): string {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (dias < 0) return "próximamente";
  if (dias === 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 30) return `hace ${dias} días`;
  const meses = Math.floor(dias / 30);
  if (meses < 12) return `hace ${meses} ${meses === 1 ? "mes" : "meses"}`;
  const años = Math.floor(meses / 12);
  return `hace ${años} ${años === 1 ? "año" : "años"}`;
}
