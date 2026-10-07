/**
 * Estado de los ambientes (beta, y producción cuando exista) para la página
 * "Estado" del panel interno.
 *
 * Junta en un solo lugar lo que hoy hay que ir a mirar a cinco partes:
 * el /health de cada backend, si el frontend responde, qué commit sirve cada
 * uno contra la punta de su rama, los últimos deploys, los chequeos
 * automáticos (MOL-16) y el consumo de Neon. Esto último es lo primero que se
 * va a quedar corto: la caída de beta del 29/9 fue la cuota del plan gratis,
 * no carga.
 *
 * Todo se consulta desde el servidor: así los tokens (GitHub, Neon) no pasan
 * por el navegador y no hace falta abrir el CORS de cada ambiente.
 */

export interface AmbienteConfig {
  nombre: string;
  api: string;            // backend (su /health es público)
  web: string;            // frontend
  rama: string;           // rama de git que despliega
  deploys: string[];      // nombres de environment con que Vercel/Railway reportan a GitHub
  neonProyecto?: string;  // id del proyecto de Neon, si hay NEON_API_KEY
}

const BETA: AmbienteConfig = {
  nombre: "beta",
  api: "https://molaris-ai-beta.up.railway.app",
  web: "https://molari-beta.vercel.app",
  rama: "beta",
  // Vercel reporta beta como "Production" porque es su rama de producción.
  deploys: ["Production", "molari / beta"],
  neonProyecto: process.env.NEON_PROJECT_ID_BETA || undefined,
};

/** ESTADO_AMBIENTES (JSON) reemplaza la lista; sin ella, solo beta. */
export function leerAmbientes(raw: string | undefined): AmbienteConfig[] {
  if (!raw) return [BETA];
  try {
    const lista = JSON.parse(raw);
    if (!Array.isArray(lista)) return [BETA];
    const validos = lista.filter((a): a is AmbienteConfig =>
      a && typeof a.nombre === "string" && typeof a.api === "string" &&
      typeof a.web === "string" && typeof a.rama === "string" && Array.isArray(a.deploys));
    return validos.length ? validos : [BETA];
  } catch {
    return [BETA];
  }
}

// ── Datos crudos de cada fuente ─────────────────────────────────────────────

export interface Salud {
  alcanzable: boolean;
  ms: number;
  status?: "ok" | "degraded" | "down";
  db?: { ok: boolean; latencyMs?: number };
  schedulers?: { name: string; ok: boolean; ageSec: number | null }[];
  ia?: { openRouter: boolean; groq: boolean; credits: string };
  version?: string | null;
  uptimeSec?: number;
}

export interface Web { alcanzable: boolean; status?: number; ms: number }

export interface Commit { sha: string; mensaje: string; fecha: string }

export interface Deploy { ambiente: string; sha: string; estado: string; fecha: string }

export interface Chequeo { conclusion: string | null; estado: string; evento: string; fecha: string; url: string }

export interface Neon {
  configurado: boolean;
  error?: string;
  computoHoras?: number;
  activoHoras?: number;
  almacenamientoMB?: number;
  finPeriodo?: string;
  cuota?: { computoHoras?: number; activoHoras?: number; almacenamientoMB?: number };
  endpoints?: { tipo: string; estado: string; deshabilitado: boolean; ultimoUso?: string }[];
}

// ── Semáforo ────────────────────────────────────────────────────────────────

export type Nivel = "ok" | "degradado" | "caido";

/** Cómo reporta cada plataforma sus deploys a GitHub, en palabras. */
export const NOMBRE_DEPLOY: Record<string, string> = {
  "Production": "Vercel (frontend)",
  "molari / beta": "Railway (backend)",
};

/** Minutos que se le dan a un deploy para entrar antes de avisar desfase. */
export const GRACIA_DEPLOY_MIN = 15;
/** Sobre este porcentaje de la cuota de Neon, avisar. */
export const UMBRAL_CUOTA = 0.8;

/**
 * Qué tan bien está un ambiente y por qué. Es lo que se ve arriba de cada
 * tarjeta; los motivos van en español para leerlos de un vistazo.
 */
export function evaluarAmbiente(d: {
  salud: Salud; web: Web; punta?: Commit | null; deploys?: Deploy[]; ultimoChequeo?: Chequeo | null; neon?: Neon; ahora?: Date;
}): { nivel: Nivel; motivos: string[] } {
  const caido: string[] = [];
  const degradado: string[] = [];
  const ahora = d.ahora ?? new Date();

  if (!d.salud.alcanzable) caido.push("El backend no responde");
  else {
    if (d.salud.db && !d.salud.db.ok) caido.push("La base de datos no responde");
    for (const s of d.salud.schedulers ?? []) if (!s.ok) degradado.push(`Scheduler "${s.name}" detenido`);
    if (d.salud.ia?.credits === "low") degradado.push("Saldo de OpenRouter bajo");
    if (d.salud.ia && !d.salud.ia.openRouter && !d.salud.ia.groq) caido.push("La IA no tiene proveedor configurado");
  }

  if (!d.web.alcanzable || (d.web.status && d.web.status >= 500)) caido.push("El frontend no responde");

  // Desfase de commit: solo si el backend lo informa y el último commit ya
  // tuvo tiempo de desplegarse. Es el caso del 29/9: el deploy no entró.
  if (d.salud.version && d.punta && !d.punta.sha.startsWith(d.salud.version)) {
    const minutos = (ahora.getTime() - new Date(d.punta.fecha).getTime()) / 60_000;
    if (minutos > GRACIA_DEPLOY_MIN) {
      degradado.push(`El backend sirve ${d.salud.version} y la rama está en ${d.punta.sha.slice(0, 7)}: el último deploy no entró`);
    }
  }

  // Un deploy fallido deja corriendo la versión anterior: el sitio responde,
  // pero lo último que se subió no está. En Railway pasa si el contenedor
  // nuevo no parte (el 29/9, porque no llegaba a la base).
  for (const dep of d.deploys ?? []) {
    if (dep.estado === "failure" || dep.estado === "error") {
      degradado.push(`Falló el último deploy de ${NOMBRE_DEPLOY[dep.ambiente] ?? dep.ambiente} (${dep.sha})`);
    }
  }

  if (d.ultimoChequeo?.conclusion === "failure") degradado.push("El último chequeo automático falló");

  const n = d.neon;
  if (n?.endpoints?.some((e) => e.deshabilitado)) caido.push("Neon tiene el cómputo deshabilitado");
  if (n?.cuota) {
    const pares: [number | undefined, number | undefined, string][] = [
      [n.computoHoras, n.cuota.computoHoras, "horas de cómputo"],
      [n.activoHoras, n.cuota.activoHoras, "horas activas"],
      [n.almacenamientoMB, n.cuota.almacenamientoMB, "almacenamiento"],
    ];
    for (const [uso, cuota, que] of pares) {
      if (uso !== undefined && cuota && uso / cuota >= UMBRAL_CUOTA) {
        degradado.push(`Neon: ${Math.round((uso / cuota) * 100)}% de la cuota de ${que}`);
      }
    }
  }

  if (caido.length) return { nivel: "caido", motivos: [...caido, ...degradado] };
  if (degradado.length) return { nivel: "degradado", motivos: degradado };
  return { nivel: "ok", motivos: [] };
}

// ── Consultas ───────────────────────────────────────────────────────────────

async function traer(url: string, init: RequestInit = {}, ms = 8000) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(ms) });
    return { res, ms: Date.now() - t0 };
  } catch {
    return { res: null, ms: Date.now() - t0 };
  }
}

async function leerSalud(api: string): Promise<Salud> {
  const { res, ms } = await traer(`${api}/health`);
  if (!res) return { alcanzable: false, ms };
  try {
    const h = await res.json();
    return {
      alcanzable: true, ms,
      status: h.status,
      db: h.checks?.db ? { ok: Boolean(h.checks.db.ok), latencyMs: h.checks.db.latencyMs } : undefined,
      schedulers: h.checks?.schedulers,
      ia: h.checks?.ai,
      version: h.version ?? null,
      uptimeSec: h.uptimeSec,
    };
  } catch {
    return { alcanzable: true, ms };
  }
}

async function leerWeb(web: string): Promise<Web> {
  const { res, ms } = await traer(web);
  return res ? { alcanzable: true, status: res.status, ms } : { alcanzable: false, ms };
}

const REPO = process.env.ESTADO_GITHUB_REPO ?? "Juanaranda/molaris-ai";

async function github<T>(ruta: string): Promise<T | null> {
  const headers: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "molari-estado" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const { res } = await traer(`https://api.github.com/repos/${REPO}${ruta}`, { headers });
  if (!res?.ok) return null;
  return res.json() as Promise<T>;
}

async function leerPunta(rama: string): Promise<Commit | null> {
  const c = await github<{ sha: string; commit: { message: string; committer: { date: string } } }>(`/commits/${rama}`);
  return c ? { sha: c.sha, mensaje: c.commit.message.split("\n")[0], fecha: c.commit.committer.date } : null;
}

async function leerDeploys(ambientes: string[]): Promise<Deploy[]> {
  const todos = await github<{ id: number; sha: string; environment: string; created_at: string }[]>("/deployments?per_page=100");
  if (!todos) return [];
  const ultimos = ambientes
    .map((a) => todos.find((d) => d.environment === a))
    .filter((d): d is NonNullable<typeof d> => Boolean(d));
  return Promise.all(ultimos.map(async (d) => {
    const st = await github<{ state: string }[]>(`/deployments/${d.id}/statuses?per_page=1`);
    return { ambiente: d.environment, sha: d.sha.slice(0, 7), estado: st?.[0]?.state ?? "desconocido", fecha: d.created_at };
  }));
}

async function leerChequeos(): Promise<Chequeo[]> {
  const r = await github<{ workflow_runs: { conclusion: string | null; status: string; event: string; created_at: string; html_url: string }[] }>(
    "/actions/workflows/chequeo-beta.yml/runs?per_page=8");
  // "skipped" son los deploys de dev (Preview), que el workflow ignora a propósito.
  return (r?.workflow_runs ?? [])
    .filter((w) => w.conclusion !== "skipped")
    .map((w) => ({ conclusion: w.conclusion, estado: w.status, evento: w.event, fecha: w.created_at, url: w.html_url }));
}

async function leerNeon(proyecto: string | undefined): Promise<Neon> {
  const key = process.env.NEON_API_KEY;
  if (!key || !proyecto) return { configurado: false };
  const headers = { Authorization: `Bearer ${key}`, Accept: "application/json" };
  const base = `https://console.neon.tech/api/v2/projects/${encodeURIComponent(proyecto)}`;
  const [p, e] = await Promise.all([traer(base, { headers }), traer(`${base}/endpoints`, { headers })]);
  if (!p.res?.ok) return { configurado: true, error: `Neon respondió ${p.res?.status ?? "sin conexión"}` };
  const { project } = await p.res.json();
  const q = project?.settings?.quota ?? {};
  const horas = (s?: number) => (typeof s === "number" ? Math.round((s / 3600) * 10) / 10 : undefined);
  const mb = (b?: number) => (typeof b === "number" ? Math.round(b / 1024 / 1024) : undefined);
  const endpoints = e.res?.ok ? ((await e.res.json()).endpoints ?? []) : [];
  return {
    configurado: true,
    computoHoras: horas(project?.compute_time_seconds),
    activoHoras: horas(project?.active_time_seconds),
    almacenamientoMB: mb(project?.synthetic_storage_size),
    finPeriodo: project?.consumption_period_end,
    cuota: {
      computoHoras: horas(q.compute_time_seconds),
      activoHoras: horas(q.active_time_seconds),
      almacenamientoMB: mb(q.logical_size_bytes),
    },
    endpoints: endpoints.map((x: { type: string; current_state: string; disabled: boolean; last_active?: string }) => ({
      tipo: x.type, estado: x.current_state, deshabilitado: Boolean(x.disabled), ultimoUso: x.last_active,
    })),
  };
}

// ── Armado, con caché ───────────────────────────────────────────────────────

export interface EstadoAmbiente {
  nombre: string; api: string; web: string; rama: string;
  nivel: Nivel; motivos: string[];
  salud: Salud; frontend: Web; punta: Commit | null; deploys: Deploy[]; neon: Neon;
}
export interface Estado { generado: string; ambientes: EstadoAmbiente[]; chequeos: Chequeo[] }

// GitHub sin token permite 60 consultas por hora: con la página abierta y
// refrescando cada minuto, sin caché se agotarían en minutos.
const CACHE_MS = process.env.GITHUB_TOKEN ? 60_000 : 10 * 60_000;
let cacheGithub: { hasta: number; datos: { puntas: Record<string, Commit | null>; deploys: Deploy[]; chequeos: Chequeo[] } } | null = null;

export async function obtenerEstado(): Promise<Estado> {
  const ambientes = leerAmbientes(process.env.ESTADO_AMBIENTES);

  if (!cacheGithub || cacheGithub.hasta < Date.now()) {
    const ramas = [...new Set(ambientes.map((a) => a.rama))];
    const [puntas, deploys, chequeos] = await Promise.all([
      Promise.all(ramas.map(async (r) => [r, await leerPunta(r)] as const)).then(Object.fromEntries),
      leerDeploys(ambientes.flatMap((a) => a.deploys)),
      leerChequeos(),
    ]);
    cacheGithub = { hasta: Date.now() + CACHE_MS, datos: { puntas, deploys, chequeos } };
  }
  const { puntas, deploys, chequeos } = cacheGithub.datos;

  const resultado = await Promise.all(ambientes.map(async (a) => {
    const [salud, frontend, neon] = await Promise.all([leerSalud(a.api), leerWeb(a.web), leerNeon(a.neonProyecto)]);
    const punta = puntas[a.rama] ?? null;
    const ultimoChequeo = a.rama === "beta" ? chequeos.find((c) => c.estado === "completed") ?? null : null;
    const suyos = deploys.filter((d) => a.deploys.includes(d.ambiente));
    const { nivel, motivos } = evaluarAmbiente({ salud, web: frontend, punta, deploys: suyos, ultimoChequeo, neon });
    return {
      nombre: a.nombre, api: a.api, web: a.web, rama: a.rama, nivel, motivos,
      salud, frontend, punta, neon, deploys: suyos,
    };
  }));

  return { generado: new Date().toISOString(), ambientes: resultado, chequeos };
}
