#!/usr/bin/env node
/**
 * Chequeo automático contra beta (MOL-16).
 *
 * Es la capa 1 del QA: lo repetible lo corre la máquina, para que las sesiones
 * de Juan queden para lo que necesita ojos humanos. Revisa solo lo público:
 * no inicia sesión ni crea reservas (dejarían basura en Galana).
 *
 * Uso:
 *   node scripts/chequeo-beta.mjs            # completo (con navegador si hay Playwright)
 *   node scripts/chequeo-beta.mjs --solo-salud
 *
 * Variables opcionales:
 *   BETA_API    backend  (por defecto https://molaris-ai-beta.up.railway.app)
 *   BETA_WEB    frontend (por defecto https://molari-beta.vercel.app)
 *   BETA_SHA    commit que el backend debería estar sirviendo (7+ caracteres)
 *
 * Sale con código 1 si hay alguna FALLA; los AVISOS no hacen fallar.
 */
import { appendFileSync } from "node:fs";

const API = process.env.BETA_API ?? "https://molaris-ai-beta.up.railway.app";
const WEB = process.env.BETA_WEB ?? "https://molari-beta.vercel.app";
const SHA = process.env.BETA_SHA?.slice(0, 7) || null;
const SOLO_SALUD = process.argv.includes("--solo-salud");

// Páginas públicas. Las de /partners y /admin se revisan igual: sin sesión
// deben cargar la pantalla de login, no romperse.
const PAGINAS = [
  "/", "/pricing", "/login", "/register", "/reset-password", "/verificar-correo",
  "/legal/privacidad", "/legal/terminos", "/legal/dpa",
  "/book/galana", "/demo/galana", "/paciente/galana", "/widget",
  "/partners/dashboard",
];

// Afirmaciones que el producto no cumple hoy. Se encontraron en la landing el
// 23/9: el servidor lee los mensajes para la IA (no hay cifrado de extremo a
// extremo) y nada legal está validado por un abogado todavía.
const PROMESAS_FALSAS = [
  { re: /extremo a extremo/i, por: "el servidor lee los mensajes para la IA" },
  { re: /end[- ]to[- ]end/i, por: "el servidor lee los mensajes para la IA" },
  { re: /cumplimiento normativo/i, por: "nada legal está validado por un abogado" },
  { re: /\bHIPAA\b/, por: "no aplica en Chile y no hay certificación" },
  { re: /ISO\s?27001/i, por: "no hay certificación" },
];

const TOQUE_MIN = 44; // px, área de toque mínima recomendada en celular

const fallas = [];
const avisos = [];
const oks = [];
// En una línea: los mensajes de Prisma traen saltos que rompen el informe.
const unaLinea = (m) => String(m).replace(/\s+/g, " ").trim();
const falla = (m) => fallas.push(unaLinea(m));
const aviso = (m) => avisos.push(unaLinea(m));
const ok = (m) => oks.push(m);

async function traer(url, opciones = {}) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(20_000), ...opciones });
    return { res, ms: Date.now() - t0 };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e), ms: Date.now() - t0 };
  }
}

// ── 1. Salud del backend ────────────────────────────────────────────────────
async function salud() {
  const { res, error } = await traer(`${API}/health`);
  if (error) return falla(`Backend no responde (${error})`);
  let h;
  try { h = await res.json(); } catch { return falla(`/health respondió ${res.status} sin JSON`); }

  if (!h.checks?.db?.ok) falla(`Base de datos: ${h.checks?.db?.error ?? "no responde"}`);
  else ok(`Base de datos responde (${h.checks.db.latencyMs} ms)`);

  for (const s of h.checks?.schedulers ?? []) {
    if (!s.ok) falla(`Scheduler "${s.name}" detenido (última corrida hace ${s.ageSec ?? "?"} s)`);
  }
  if ((h.checks?.schedulers ?? []).every((s) => s.ok)) ok("Schedulers corriendo");

  const ai = h.checks?.ai ?? {};
  if (!ai.openRouter && !ai.groq) falla("IA: no hay ningún proveedor configurado");
  else if (ai.credits === "low") falla("IA: saldo de OpenRouter bajo — el agente puede quedar mudo");
  else if (ai.credits === "unknown") aviso("IA: no se pudo consultar el saldo de OpenRouter");
  else ok("IA configurada y con saldo");

  if (SHA) {
    if (!h.version) aviso("El backend no informa su commit (¿falta RAILWAY_GIT_COMMIT_SHA?)");
    else if (h.version !== SHA) falla(`El backend sirve ${h.version} y beta está en ${SHA}: el último deploy no entró`);
    else ok(`Backend sirviendo el commit de beta (${SHA})`);
  }
}

// ── 2. Páginas, links internos y promesas falsas ────────────────────────────
function textoVisible(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
}

async function paginas() {
  const links = new Set();
  for (const p of PAGINAS) {
    const { res, error, ms } = await traer(WEB + p);
    if (error) { falla(`${p} no responde (${error})`); continue; }
    if (!res.ok) { falla(`${p} responde ${res.status}`); continue; }
    if (ms > 8000) aviso(`${p} tardó ${(ms / 1000).toFixed(1)} s`);
    const html = await res.text();

    for (const { re, por } of PROMESAS_FALSAS) {
      const m = textoVisible(html).match(re);
      if (m) falla(`${p} dice "${m[0]}" — ${por}`);
    }
    for (const [, href] of html.matchAll(/href="(\/[^"#?]*)/g)) {
      if (!href.startsWith("/_next") && !href.startsWith("//")) links.add(href);
    }
  }
  ok(`${PAGINAS.length} páginas públicas revisadas`);

  let rotos = 0;
  for (const href of [...links].slice(0, 80)) {
    if (PAGINAS.includes(href)) continue;
    const { res, error } = await traer(WEB + href, { method: "GET" });
    if (error || res.status >= 400) { falla(`Link roto: ${href} (${error ?? res.status})`); rotos++; }
  }
  if (!rotos) ok(`${links.size} links internos sin romper`);
}

// ── 3. En el navegador, tamaño celular ──────────────────────────────────────
async function navegador() {
  let chromium;
  try { ({ chromium } = await import("playwright")); }
  catch { return aviso("Playwright no está instalado: se saltó la revisión en navegador"); }

  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
    for (const p of PAGINAS) {
      const page = await ctx.newPage();
      const errores = [];
      page.on("pageerror", (e) => errores.push(e.message));
      page.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });
      page.on("response", (r) => {
        if (r.url().startsWith(API) && r.status() >= 500) errores.push(`${r.status()} en ${new URL(r.url()).pathname}`);
      });
      try {
        await page.goto(WEB + p, { waitUntil: "networkidle", timeout: 30_000 });
      } catch (e) {
        falla(`${p}: no terminó de cargar en el navegador (${e instanceof Error ? e.message.split("\n")[0] : e})`);
        await page.close();
        continue;
      }

      const r = await page.evaluate((min) => {
        const desborde = document.documentElement.scrollWidth - window.innerWidth;
        // Solo controles "de bloque": un link dentro de un párrafo es texto y
        // tiene su propia excepción en WCAG.
        const chicos = [...document.querySelectorAll("a, button, [role=button], input, select")]
          .filter((el) => {
            const b = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            if (!b.width || !b.height || cs.visibility === "hidden" || cs.display === "inline") return false;
            return b.height < min;
          })
          .map((el) => `${(el.textContent || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 30)} (${Math.round(el.getBoundingClientRect().height)}px)`);
        return { desborde, chicos: [...new Set(chicos)] };
      }, TOQUE_MIN);

      if (r.desborde > 1) falla(`${p}: la página se sale ${r.desborde}px hacia el lado en el celular`);
      if (r.chicos.length) aviso(`${p}: ${r.chicos.length} botones de menos de ${TOQUE_MIN}px — ${r.chicos.slice(0, 4).join(", ")}${r.chicos.length > 4 ? "…" : ""}`);
      for (const e of [...new Set(errores)].slice(0, 3)) falla(`${p}: error en el navegador — ${e.slice(0, 160)}`);
      await page.close();
    }
    ok(`Revisión en navegador a 375px (${PAGINAS.length} páginas)`);
  } finally {
    await browser.close();
  }
}

// ── Informe ────────────────────────────────────────────────────────────────
await salud();
if (!SOLO_SALUD) {
  await paginas();
  await navegador();
}

const lineas = [
  `## Chequeo de beta — ${fallas.length ? `❌ ${fallas.length} falla(s)` : "✅ sin fallas"}`,
  "",
  `Backend \`${API}\` · Frontend \`${WEB}\`${SHA ? ` · commit esperado \`${SHA}\`` : ""}${SOLO_SALUD ? " · solo salud" : ""}`,
  "",
  ...(fallas.length ? ["### Fallas", ...fallas.map((m) => `- ❌ ${m}`), ""] : []),
  ...(avisos.length ? ["### Avisos", ...avisos.map((m) => `- ⚠️ ${m}`), ""] : []),
  "### Bien", ...oks.map((m) => `- ✅ ${m}`),
];
const informe = lineas.join("\n");
console.log(informe);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, informe + "\n");
process.exit(fallas.length ? 1 : 0);
