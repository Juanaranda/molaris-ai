"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Search, Upload, X } from "lucide-react";
import { Button, CLASE_CAMPO } from "@/components/ui";
import { getToken } from "@/lib/auth";
import { cx } from "@/lib/cx";
import { nombreCorto } from "@/lib/agendaVista";
import { PatientDetail } from "./pacientes/DetallePaciente";
import { NewPatientModal } from "./pacientes/Formularios";
import { ImportCSVModal } from "./pacientes/ImportarCSV";
import {
  coincide, estadoPago, fmtCLP, fmtDate, iniciales, sinTildes1a1, soloRut, type Patient,
} from "./pacientes/formato";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/** Filas que se dibujan de una vez: con 2.200 pacientes, pintarlos todos trababa el scroll. */
const PAGINA = 100;

/**
 * Resalta el tramo coincidente sin alterar el texto original. La comparación
 * es sin tildes, pero se recorta el ORIGINAL con los índices (ver sinTildes1a1).
 */
function Resaltado({ texto, query }: { texto: string; query: string }) {
  const q = sinTildes1a1(query.trim());
  if (!q) return <>{texto}</>;
  const idx = sinTildes1a1(texto).indexOf(q);
  if (idx < 0) return <>{texto}</>;
  return (
    <>
      {texto.slice(0, idx)}
      <mark className="rounded-[2px] bg-brand-soft text-inherit">{texto.slice(idx, idx + q.length)}</mark>
      {texto.slice(idx + q.length)}
    </>
  );
}

/** Saldo de un paciente en la lista: lo que hay que saber al cobrar, en una línea. */
function Saldo({ p, alineado = "right" }: { p: Patient; alineado?: "right" | "left" }) {
  const pago = estadoPago(p);
  const clase = cx("block tabular-nums", alineado === "right" ? "text-right" : "text-left");
  if (pago.estado === "sin-datos") return <span className={cx(clase, "text-sm text-ink-muted")} aria-label="Sin pagos registrados">—</span>;
  if (pago.estado === "pagado") return <span className={cx(clase, "text-sm font-semibold text-ok")}>Al día</span>;
  return (
    <span className={cx(clase, "flex flex-col", alineado === "right" ? "items-end" : "items-start")}>
      <span className="text-sm font-semibold text-danger">Debe {fmtCLP(pago.saldo)}</span>
      {pago.estado === "abonado" && <span className="text-[13px] text-ink-muted">pagó el {pago.porcentaje}%</span>}
    </span>
  );
}

const COLUMNAS = "sm:grid-cols-[minmax(200px,1fr)_110px_130px_110px_140px_130px]";

export function PatientsTab() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);
  const [search, setSearch]     = useState("");
  const [showImport, setShowImport] = useState(false);
  const [showNewPatient, setShowNewPatient] = useState(false);
  const [selected, setSelected] = useState<Patient | null>(null);
  const [cursor, setCursor]     = useState(0);
  const [visibles, setVisibles] = useState(PAGINA);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [doctorFilter, setDoctorFilter] = useState<string>("");
  const [payFilter, setPayFilter]   = useState<"todos" | "deuda" | "aldia" | "sinregistro">("todos");
  const [dateFilter, setDateFilter] = useState<"todos" | "30" | "90" | "180+">("todos");
  const searchRef = useRef<HTMLInputElement>(null);

  /**
   * Descarga el CSV. Va por fetch y no por un <a href> directo porque el
   * endpoint pide el token en el header: un link plano llegaría sin auth.
   */
  async function exportCsv() {
    const token = getToken(); if (!token) return;
    setExporting(true); setExportError("");
    try {
      const res = await fetch(`${API}/api/patients/export`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("No se pudo exportar");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pacientes-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // Antes era un alert(): se mostraba fuera del panel y bloqueaba la pantalla.
      setExportError("No pudimos descargar el CSV. Vuelve a intentar.");
    } finally {
      setExporting(false);
    }
  }

  const loadPatients = useCallback(() => {
    const token = getToken(); if (!token) return;
    setLoading(true);
    fetch(`${API}/api/patients`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (!r.ok) throw new Error("non-200");
        return r.json();
      })
      .then((ps) => { setPatients(ps); setError(false); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadPatients(); }, [loadPatients]);

  // Profesionales presentes en la base, para el desplegable. Sale de los datos
  // y no del equipo configurado: hay fichas antiguas con profesionales que ya
  // no atienden y también se deben poder filtrar.
  const doctorOptions = useMemo(() => {
    const s = new Set<string>();
    for (const p of patients) if (p.lastDoctor && p.lastDoctor !== "Sin asignar") s.add(p.lastDoctor);
    return [...s].sort((a, b) => a.localeCompare(b, "es"));
  }, [patients]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const DIA = 86_400_000;
    return patients.filter((p) => {
      if (!coincide(p, search)) return false;
      if (doctorFilter && p.lastDoctor !== doctorFilter) return false;
      // Se filtra por deuda real (monto), no por "citas sin registrar pago":
      // con datos importados sin montos, eso marcaba a todos como deudores.
      if (payFilter !== "todos") {
        const e = estadoPago(p).estado;
        if (payFilter === "deuda"      && e !== "pendiente" && e !== "abonado") return false;
        if (payFilter === "aldia"      && e !== "pagado")    return false;
        if (payFilter === "sinregistro" && e !== "sin-datos") return false;
      }
      if (dateFilter !== "todos") {
        const dias = (now - new Date(p.lastVisit).getTime()) / DIA;
        // "Sin venir hace 6+ meses" es el filtro de recall: a quién hay que
        // llamar de vuelta. Los otros dos acotan a actividad reciente.
        if (dateFilter === "30"   && dias > 30)  return false;
        if (dateFilter === "90"   && dias > 90)  return false;
        if (dateFilter === "180+" && dias < 180) return false;
      }
      return true;
    });
  }, [patients, search, doctorFilter, payFilter, dateFilter]);

  const deudores = useMemo(() => patients.filter((p) => {
    const e = estadoPago(p).estado; return e === "pendiente" || e === "abonado";
  }).length, [patients]);

  const hayFiltros = Boolean(doctorFilter) || payFilter !== "todos" || dateFilter !== "todos";
  const enPantalla = filtered.slice(0, visibles);
  const limpiarTodo = () => { setSearch(""); setDoctorFilter(""); setPayFilter("todos"); setDateFilter("todos"); };

  // "/" enfoca el buscador desde cualquier parte, como en Gmail o GitHub: el
  // doctor llega con el paciente al lado y no quiere ir al mouse.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const escribiendo = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (e.key === "/" && !escribiendo) { e.preventDefault(); searchRef.current?.focus(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Al cambiar el filtro, el cursor vuelve al primer resultado para que Enter
  // siempre abra lo que se está viendo arriba; y la lista vuelve a la primera página.
  useEffect(() => { setCursor(0); setVisibles(PAGINA); }, [search, doctorFilter, payFilter, dateFilter]);

  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (enPantalla.length === 0) return;
    if (e.key === "ArrowDown")      { e.preventDefault(); setCursor((c) => Math.min(c + 1, enPantalla.length - 1)); }
    else if (e.key === "ArrowUp")   { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    else if (e.key === "Enter")     { e.preventDefault(); setSelected(enPantalla[cursor] ?? enPantalla[0]); }
    else if (e.key === "Escape")    { setSearch(""); searchRef.current?.blur(); }
  }

  // Los filtros no van a todo el ancho (CLASE_CAMPO es w-full): cada uno mide lo que su texto.
  const filtro = "min-h-11 shrink-0 rounded-control border border-line bg-surface pr-8 pl-3 text-sm text-ink focus:border-brand focus:ring-2 focus:ring-brand/30 focus:outline-none sm:min-h-10";

  return (
    <div className="flex flex-col gap-5">
      {/* Título: cuántos son y a cuántos hay que cobrarles */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-2xl font-bold text-brand-strong">Pacientes</h2>
            <p className="text-sm text-ink-muted tabular-nums">
              {loading && patients.length === 0 ? "Cargando…" : error ? "No pudimos cargar la lista" : (
                <>{patients.length.toLocaleString("es-CL")} pacientes
                  {deudores > 0 && <> · {deudores.toLocaleString("es-CL")} con saldo pendiente</>}</>
              )}
            </p>
          </div>
          <Button className="shrink-0 sm:hidden" onClick={() => setShowNewPatient(true)}>+ Nuevo paciente</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" className="max-sm:min-h-11 max-sm:flex-1" onClick={() => setShowImport(true)}>
            <Download className="h-4 w-4" aria-hidden /> Importar CSV
          </Button>
          <Button size="sm" variant="secondary" className="max-sm:min-h-11 max-sm:flex-1" onClick={exportCsv} loading={exporting}
            title="Descarga la base de pacientes en CSV">
            <Upload className="h-4 w-4" aria-hidden /> {exporting ? "Exportando…" : "Exportar CSV"}
          </Button>
          <Button size="sm" className="max-sm:hidden" onClick={() => setShowNewPatient(true)}>+ Nuevo paciente</Button>
        </div>
      </div>
      {exportError && <p role="alert" className="-mt-2 text-sm font-semibold text-danger">{exportError}</p>}

      {/* Buscar y filtrar: los mismos ejes que muestran las columnas */}
      <div className="flex flex-col gap-2">
        <div className="relative sm:max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
          <input
            ref={searchRef}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={onSearchKeyDown}
            aria-label="Buscar paciente por nombre, RUT o teléfono"
            placeholder="Nombre, RUT o teléfono…"
            autoComplete="off"
            spellCheck={false}
            className={cx(CLASE_CAMPO, "pr-12 pl-9 [&::-webkit-search-cancel-button]:hidden")}
          />
          {search ? (
            <button type="button" onClick={() => { setSearch(""); searchRef.current?.focus(); }} aria-label="Limpiar búsqueda"
              className="absolute top-0 right-0 grid h-11 w-11 place-items-center text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-brand">
              <X className="h-4 w-4" aria-hidden />
            </button>
          ) : (
            <kbd className="absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border border-line bg-ground px-1.5 text-xs font-semibold text-ink-muted sm:block"
              title="Presiona / para buscar">/</kbd>
          )}
        </div>
        <div role="group" aria-label="Filtros" className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0" style={{ scrollbarWidth: "none" }}>
          <select value={doctorFilter} onChange={(e) => setDoctorFilter(e.target.value)} aria-label="Filtrar por profesional" className={filtro}>
            <option value="">Todos los profesionales</option>
            {doctorOptions.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={payFilter} onChange={(e) => setPayFilter(e.target.value as typeof payFilter)} aria-label="Filtrar por estado de pago" className={filtro}>
            <option value="todos">Cualquier pago</option>
            <option value="deuda">Con saldo pendiente</option>
            <option value="aldia">Al día</option>
            <option value="sinregistro">Sin pago registrado</option>
          </select>
          <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as typeof dateFilter)} aria-label="Filtrar por última visita" className={filtro}>
            <option value="todos">Cualquier fecha</option>
            <option value="30">Vino en los últimos 30 días</option>
            <option value="90">Vino en los últimos 90 días</option>
            <option value="180+">Sin venir hace 6 meses o más</option>
          </select>
          {hayFiltros && (
            <Button size="sm" variant="ghost" className="shrink-0 max-sm:min-h-11"
              onClick={() => { setDoctorFilter(""); setPayFilter("todos"); setDateFilter("todos"); }}>
              Limpiar filtros
            </Button>
          )}
        </div>
      </div>

      {/* La lista */}
      <section aria-label="Lista de pacientes" className="overflow-hidden rounded-card border border-line bg-surface">
        {loading && patients.length === 0 ? (
          <div className="flex flex-col gap-2 p-4" aria-hidden>
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 rounded-control bg-gray-100" />)}
          </div>
        ) : error ? (
          <p className="px-5 py-4 text-sm text-ink">
            No pudimos cargar los pacientes.{" "}
            <button type="button" onClick={loadPatients} className="min-h-11 font-semibold text-brand underline underline-offset-2">Reintentar</button>
          </p>
        ) : patients.length === 0 ? (
          <div className="flex flex-col items-start gap-3 px-5 py-6">
            <p className="text-sm text-ink">Todavía no hay pacientes registrados. Agrega el primero o tráelos desde tu sistema anterior con un CSV.</p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setShowNewPatient(true)}>+ Nuevo paciente</Button>
              <Button variant="secondary" onClick={() => setShowImport(true)}>Importar CSV</Button>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-start gap-2 px-5 py-6">
            <p className="text-sm text-ink">
              {search ? <>Ningún paciente coincide con «{search}»{hayFiltros ? " con estos filtros" : ""}.</> : "Ningún paciente cumple estos filtros."}
            </p>
            <Button size="sm" variant="secondary" className="max-sm:min-h-11" onClick={limpiarTodo}>Limpiar búsqueda y filtros</Button>
          </div>
        ) : (
          <>
            <div className={cx("hidden gap-4 border-b border-line px-5 pt-3 pb-2 text-xs text-ink-muted sm:grid", COLUMNAS)}>
              <span>Paciente</span><span>RUT</span><span>Teléfono</span><span>Última visita</span><span>Profesional</span>
              <span className="text-right">Saldo</span>
            </div>
            <ul>
              {enPantalla.map((p, idx) => {
                const isCursor = idx === cursor && search.length > 0;
                const doctor = p.lastDoctor && p.lastDoctor !== "Sin asignar" ? nombreCorto(p.lastDoctor) : "—";
                const detalle = p.email ?? (p.services.length > 0 ? p.services.slice(0, 2).join(", ") : null);
                return (
                  <li key={p.key} className="border-t border-line-soft first:border-t-0">
                    <button type="button" onClick={() => setSelected(p)} aria-current={isCursor || undefined}
                      className={cx(
                        "grid w-full grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-2.5 text-left transition-colors sm:min-h-14 sm:gap-x-4 sm:px-5",
                        COLUMNAS,
                        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand",
                        isCursor ? "bg-brand-soft" : "hover:bg-ground",
                      )}>
                      {/* Celular: avatar, nombre con RUT y fecha debajo, saldo a la derecha */}
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-gray-100 text-xs font-bold text-ink sm:hidden" aria-hidden>
                        {iniciales(p.name)}
                      </span>
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="hidden h-8 w-8 shrink-0 place-items-center rounded-full bg-gray-100 text-xs font-bold text-ink sm:grid" aria-hidden>
                          {iniciales(p.name)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-ink"><Resaltado texto={p.name} query={search} /></span>
                          <span className="block truncate text-[13px] text-ink-muted sm:hidden tabular-nums">
                            {[p.rut, fmtDate(p.lastVisit)].filter(Boolean).join(" · ")}
                          </span>
                          {detalle && <span className="hidden truncate text-[13px] text-ink-muted sm:block">{detalle}</span>}
                        </span>
                      </span>
                      <span className="sm:hidden"><Saldo p={p} /></span>
                      <span className="hidden truncate text-sm text-ink tabular-nums sm:block">
                        {p.rut ? <Resaltado texto={p.rut} query={soloRut(search)} /> : <span className="text-ink-muted">—</span>}
                      </span>
                      <span className="hidden truncate text-sm text-ink tabular-nums sm:block">
                        {p.phone ? <Resaltado texto={p.phone} query={search.replace(/\D/g, "")} /> : <span className="text-ink-muted">—</span>}
                      </span>
                      <span className="hidden text-sm text-ink tabular-nums sm:block">{fmtDate(p.lastVisit)}</span>
                      <span className="hidden truncate text-sm text-ink sm:block">{doctor}</span>
                      <span className="hidden sm:block"><Saldo p={p} /></span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3 text-[13px] text-ink-muted tabular-nums">
              <span>
                {filtered.length > enPantalla.length
                  ? `Mostrando ${enPantalla.length.toLocaleString("es-CL")} de ${filtered.length.toLocaleString("es-CL")}`
                  : `${filtered.length.toLocaleString("es-CL")} ${filtered.length === 1 ? "paciente" : "pacientes"}`}
              </span>
              {filtered.length > enPantalla.length && (
                <Button size="sm" variant="secondary" className="max-sm:min-h-11" onClick={() => setVisibles((v) => v + PAGINA)}>
                  Mostrar {Math.min(PAGINA, filtered.length - enPantalla.length)} más
                </Button>
              )}
            </div>
          </>
        )}
      </section>

      {selected && <PatientDetail patient={selected} onClose={() => setSelected(null)} />}

      {showNewPatient && (
        <NewPatientModal
          onClose={() => setShowNewPatient(false)}
          onCreated={() => { setShowNewPatient(false); loadPatients(); }}
        />
      )}

      {showImport && (
        <ImportCSVModal
          onClose={() => setShowImport(false)}
          onSuccess={() => { setShowImport(false); loadPatients(); }}
        />
      )}
    </div>
  );
}
