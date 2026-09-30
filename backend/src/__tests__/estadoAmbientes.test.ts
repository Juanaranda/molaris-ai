import { describe, it, expect } from "vitest";
import { evaluarAmbiente, leerAmbientes, GRACIA_DEPLOY_MIN, type Salud, type Web } from "../services/estado/estadoService";

/**
 * El semáforo de la página "Estado": qué cuenta como caído, degradado u ok.
 * Los casos salen de lo que ya pasó: la base de beta caída por la cuota de
 * Neon (29/9) y el deploy que no entró porque el contenedor nuevo no partía.
 */

const SANA: Salud = {
  alcanzable: true, ms: 120, status: "ok",
  db: { ok: true, latencyMs: 60 },
  schedulers: [{ name: "reminder", ok: true, ageSec: 30 }],
  ia: { openRouter: true, groq: false, credits: "ok" },
  version: "a8efaee",
};
const WEB_OK: Web = { alcanzable: true, status: 200, ms: 300 };
const AHORA = new Date("2026-09-30T12:00:00Z");
const hace = (min: number) => new Date(AHORA.getTime() - min * 60_000).toISOString();

describe("evaluarAmbiente", () => {
  it("todo bien → ok, sin motivos", () => {
    const r = evaluarAmbiente({ salud: SANA, web: WEB_OK, punta: { sha: "a8efaee1234", mensaje: "x", fecha: hace(60) }, ahora: AHORA });
    expect(r).toEqual({ nivel: "ok", motivos: [] });
  });

  it("la base caída es caído, aunque el backend responda (29/9)", () => {
    const r = evaluarAmbiente({ salud: { ...SANA, db: { ok: false } }, web: WEB_OK, ahora: AHORA });
    expect(r.nivel).toBe("caido");
    expect(r.motivos).toContain("La base de datos no responde");
  });

  it("backend o frontend sin responder es caído", () => {
    expect(evaluarAmbiente({ salud: { alcanzable: false, ms: 8000 }, web: WEB_OK }).nivel).toBe("caido");
    expect(evaluarAmbiente({ salud: SANA, web: { alcanzable: false, ms: 8000 } }).nivel).toBe("caido");
    expect(evaluarAmbiente({ salud: SANA, web: { alcanzable: true, status: 502, ms: 100 } }).nivel).toBe("caido");
  });

  it("un deploy que no entró se avisa solo pasada la gracia", () => {
    const reciente = { sha: "bbbbbbb999", mensaje: "x", fecha: hace(GRACIA_DEPLOY_MIN - 5) };
    expect(evaluarAmbiente({ salud: SANA, web: WEB_OK, punta: reciente, ahora: AHORA }).nivel).toBe("ok");

    const viejo = { ...reciente, fecha: hace(GRACIA_DEPLOY_MIN + 5) };
    const r = evaluarAmbiente({ salud: SANA, web: WEB_OK, punta: viejo, ahora: AHORA });
    expect(r.nivel).toBe("degradado");
    expect(r.motivos[0]).toMatch(/a8efaee.*bbbbbbb.*no entró/);
  });

  it("sin versión informada no se inventa un desfase", () => {
    const r = evaluarAmbiente({ salud: { ...SANA, version: null }, web: WEB_OK, punta: { sha: "zzz", mensaje: "x", fecha: hace(600) }, ahora: AHORA });
    expect(r.nivel).toBe("ok");
  });

  it("scheduler detenido, saldo bajo o chequeo fallido es degradado", () => {
    expect(evaluarAmbiente({ salud: { ...SANA, schedulers: [{ name: "reminder", ok: false, ageSec: 9000 }] }, web: WEB_OK }).nivel).toBe("degradado");
    expect(evaluarAmbiente({ salud: { ...SANA, ia: { openRouter: true, groq: false, credits: "low" } }, web: WEB_OK }).nivel).toBe("degradado");
    const chequeo = { conclusion: "failure", estado: "completed", evento: "schedule", fecha: hace(10), url: "u" };
    expect(evaluarAmbiente({ salud: SANA, web: WEB_OK, ultimoChequeo: chequeo }).motivos).toContain("El último chequeo automático falló");
  });

  it("un deploy fallido se avisa en palabras, aunque el sitio responda (29/9)", () => {
    const r = evaluarAmbiente({
      salud: SANA, web: WEB_OK,
      deploys: [
        { ambiente: "Production", sha: "a8efaee", estado: "success", fecha: hace(30) },
        { ambiente: "molari / beta", sha: "a8efaee", estado: "failure", fecha: hace(30) },
      ],
    });
    expect(r.nivel).toBe("degradado");
    expect(r.motivos).toEqual(["Falló el último deploy de Railway (backend) (a8efaee)"]);
  });

  it("Neon: sobre el 80% de la cuota avisa; cómputo deshabilitado es caído", () => {
    const cerca = evaluarAmbiente({ salud: SANA, web: WEB_OK, neon: { configurado: true, computoHoras: 170, cuota: { computoHoras: 191.9 } } });
    expect(cerca.nivel).toBe("degradado");
    expect(cerca.motivos[0]).toMatch(/Neon: 89% de la cuota de horas de cómputo/);

    const lejos = evaluarAmbiente({ salud: SANA, web: WEB_OK, neon: { configurado: true, computoHoras: 20, cuota: { computoHoras: 191.9 } } });
    expect(lejos.nivel).toBe("ok");

    const apagado = evaluarAmbiente({ salud: SANA, web: WEB_OK, neon: { configurado: true, endpoints: [{ tipo: "read_write", estado: "idle", deshabilitado: true }] } });
    expect(apagado.nivel).toBe("caido");
  });

  it("caído muestra también lo degradado, primero lo grave", () => {
    const r = evaluarAmbiente({ salud: { ...SANA, db: { ok: false }, ia: { openRouter: true, groq: false, credits: "low" } }, web: WEB_OK });
    expect(r.motivos).toEqual(["La base de datos no responde", "Saldo de OpenRouter bajo"]);
  });
});

describe("leerAmbientes", () => {
  it("sin configuración, solo beta", () => {
    const [beta, ...resto] = leerAmbientes(undefined);
    expect(beta.nombre).toBe("beta");
    expect(beta.deploys).toContain("molari / beta");
    expect(resto).toEqual([]);
  });

  it("ESTADO_AMBIENTES agrega producción cuando exista", () => {
    const raw = JSON.stringify([
      { nombre: "beta", api: "https://b", web: "https://bw", rama: "beta", deploys: ["x"] },
      { nombre: "producción", api: "https://p", web: "https://pw", rama: "main", deploys: ["y"] },
    ]);
    expect(leerAmbientes(raw).map((a) => a.nombre)).toEqual(["beta", "producción"]);
  });

  it("una configuración rota no deja la página en blanco: vuelve a beta", () => {
    expect(leerAmbientes("{no es json")[0].nombre).toBe("beta");
    expect(leerAmbientes(JSON.stringify([{ nombre: "sin campos" }]))[0].nombre).toBe("beta");
  });
});
