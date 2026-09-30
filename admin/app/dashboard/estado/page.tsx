"use client";
import { useEffect, useState } from "react";
import { api, type Estado, type EstadoAmbiente, type Nivel } from "@/lib/api";

const REFRESCO_MS = 60_000;

const NIVEL: Record<Nivel, { texto: string; punto: string; caja: string }> = {
  ok:        { texto: "Todo bien",  punto: "bg-emerald-500", caja: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  degradado: { texto: "Con avisos", punto: "bg-amber-500",   caja: "border-amber-200 bg-amber-50 text-amber-800" },
  caido:     { texto: "Caído",      punto: "bg-red-500",     caja: "border-red-200 bg-red-50 text-red-800" },
};

function hace(iso?: string | null) {
  if (!iso) return "—";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return h < 48 ? `hace ${h} h` : `hace ${Math.round(h / 24)} días`;
}

function duracion(seg?: number) {
  if (seg === undefined) return "—";
  const h = Math.floor(seg / 3600);
  return h >= 48 ? `${Math.floor(h / 24)} días` : h >= 1 ? `${h} h` : `${Math.floor(seg / 60)} min`;
}

function Fila({ label, children, mal }: { label: string; children: React.ReactNode; mal?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-sm text-right tabular-nums ${mal ? "text-red-600 font-semibold" : "text-gray-900"}`}>{children}</span>
    </div>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">{titulo}</p>
      {children}
    </div>
  );
}

function Uso({ label, uso, cuota, unidad }: { label: string; uso?: number; cuota?: number; unidad: string }) {
  if (uso === undefined) return null;
  const pct = cuota ? Math.min(100, Math.round((uso / cuota) * 100)) : null;
  return (
    <div className="py-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-gray-500">{label}</span>
        <span className="text-gray-900 tabular-nums">{uso} {unidad}{cuota ? ` de ${cuota}` : ""}{pct !== null ? ` · ${pct}%` : ""}</span>
      </div>
      {pct !== null && (
        <div className="h-1.5 rounded-full bg-gray-100 mt-1 overflow-hidden">
          <div className={`h-full rounded-full ${pct >= 80 ? "bg-red-500" : pct >= 60 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

function Ambiente({ a }: { a: EstadoAmbiente }) {
  const n = NIVEL[a.nivel];
  const s = a.salud;
  const desfase = s.version && a.punta && !a.punta.sha.startsWith(s.version);

  return (
    <section className="space-y-3">
      <div className={`rounded-xl border px-4 py-3 ${n.caja}`}>
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${n.punto}`} aria-hidden />
          <h2 className="text-base font-bold capitalize">{a.nombre}</h2>
          <span className="text-sm">· {n.texto}</span>
        </div>
        {a.motivos.length > 0 && (
          <ul className="mt-1.5 text-sm list-disc pl-5 space-y-0.5">
            {a.motivos.map((m) => <li key={m}>{m}</li>)}
          </ul>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Bloque titulo="Backend">
          <Fila label="Responde" mal={!s.alcanzable}>{s.alcanzable ? `sí · ${s.ms} ms` : "no"}</Fila>
          <Fila label="Base de datos" mal={s.db ? !s.db.ok : false}>{s.db ? (s.db.ok ? `ok · ${s.db.latencyMs} ms` : "no responde") : "—"}</Fila>
          <Fila label="IA" mal={s.ia?.credits === "low"}>{s.ia ? `${s.ia.openRouter ? "OpenRouter" : ""}${s.ia.groq ? " + Groq" : ""} · saldo ${s.ia.credits}` : "—"}</Fila>
          <Fila label="Arriba hace">{duracion(s.uptimeSec)}</Fila>
          {(s.schedulers ?? []).map((sc) => (
            <Fila key={sc.name} label={`Scheduler ${sc.name}`} mal={!sc.ok}>{sc.ok ? "ok" : "detenido"}{sc.ageSec !== null ? ` · ${duracion(sc.ageSec)}` : ""}</Fila>
          ))}
        </Bloque>

        <Bloque titulo="Frontend">
          <Fila label="Responde" mal={!a.frontend.alcanzable || (a.frontend.status ?? 0) >= 400}>
            {a.frontend.alcanzable ? `${a.frontend.status} · ${a.frontend.ms} ms` : "no"}
          </Fila>
          <a href={a.web} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline break-all">{a.web}</a>
        </Bloque>

        <Bloque titulo={`Versión · rama ${a.rama}`}>
          <Fila label="Backend sirve" mal={Boolean(desfase)}>{s.version ?? "no informa"}</Fila>
          <Fila label="Punta de la rama">{a.punta ? a.punta.sha.slice(0, 7) : "—"}</Fila>
          {a.punta && <p className="text-xs text-gray-500 mt-1 truncate" title={a.punta.mensaje}>{a.punta.mensaje} · {hace(a.punta.fecha)}</p>}
          {a.deploys.map((d) => (
            <Fila key={d.ambiente} label={d.ambiente === "Production" ? "Deploy Vercel" : d.ambiente === "molari / beta" ? "Deploy Railway" : d.ambiente}
              mal={d.estado === "failure" || d.estado === "error"}>
              {d.sha} · {d.estado} · {hace(d.fecha)}
            </Fila>
          ))}
        </Bloque>

        <Bloque titulo="Base de datos (Neon)">
          {!a.neon.configurado ? (
            <p className="text-xs text-gray-500">
              Sin datos de consumo: falta configurar <code>NEON_API_KEY</code> y <code>NEON_PROJECT_ID_BETA</code> en el backend del panel.
            </p>
          ) : a.neon.error ? (
            <p className="text-xs text-red-600">{a.neon.error}</p>
          ) : (
            <>
              <Uso label="Horas de cómputo" uso={a.neon.computoHoras} cuota={a.neon.cuota?.computoHoras} unidad="h" />
              <Uso label="Horas activas" uso={a.neon.activoHoras} cuota={a.neon.cuota?.activoHoras} unidad="h" />
              <Uso label="Almacenamiento" uso={a.neon.almacenamientoMB} cuota={a.neon.cuota?.almacenamientoMB} unidad="MB" />
              {a.neon.finPeriodo && <Fila label="El período se reinicia">{new Date(a.neon.finPeriodo).toLocaleDateString("es-CL")}</Fila>}
              {(a.neon.endpoints ?? []).map((e, i) => (
                <Fila key={i} label={`Cómputo ${e.tipo === "read_write" ? "principal" : "réplica"}`} mal={e.deshabilitado}>
                  {e.deshabilitado ? "deshabilitado" : e.estado === "idle" ? "dormido" : e.estado}
                </Fila>
              ))}
            </>
          )}
        </Bloque>
      </div>
    </section>
  );
}

export default function EstadoPage() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let vigente = true;
    const cargar = () => api.estado()
      .then((e) => { if (vigente) { setEstado(e); setError(""); } })
      .catch((e) => { if (vigente) setError(e instanceof Error ? e.message : "No se pudo consultar"); });
    cargar();
    const t = setInterval(cargar, REFRESCO_MS);
    return () => { vigente = false; clearInterval(t); };
  }, []);

  if (!estado && !error) return <p className="text-sm text-gray-400 animate-pulse">Consultando los ambientes…</p>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-bold text-gray-900">Estado de los ambientes</h1>
        {estado && <span className="text-xs text-gray-400">Actualizado {hace(estado.generado)} · se refresca cada minuto</span>}
      </div>

      {error && (
        <p className="text-sm rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3">
          No se pudo consultar el estado: {error}
        </p>
      )}

      {estado?.ambientes.map((a) => <Ambiente key={a.nombre} a={a} />)}

      {estado && (
        <Bloque titulo="Chequeos automáticos de beta">
          {estado.chequeos.length === 0 ? (
            <p className="text-xs text-gray-500">Todavía no hay corridas. El workflow empieza a correr cuando llegue a beta.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {estado.chequeos.map((c) => (
                  <tr key={c.url} className="border-b border-gray-50 last:border-0">
                    <td className="py-1.5">
                      <span className={c.conclusion === "success" ? "text-emerald-600" : c.conclusion === "failure" ? "text-red-600" : "text-gray-400"}>
                        {c.conclusion === "success" ? "✓ ok" : c.conclusion === "failure" ? "✗ falló" : c.estado === "completed" ? c.conclusion : "en curso"}
                      </span>
                    </td>
                    <td className="py-1.5 text-gray-500">{c.evento === "schedule" ? "cada 30 min" : c.evento === "deployment_status" ? "tras un deploy" : "manual"}</td>
                    <td className="py-1.5 text-gray-500">{hace(c.fecha)}</td>
                    <td className="py-1.5 text-right"><a href={c.url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">ver detalle</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Bloque>
      )}
    </div>
  );
}
