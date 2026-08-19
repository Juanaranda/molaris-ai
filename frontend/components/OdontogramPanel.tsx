"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DentalSurface, DentalEventType, ToothProjection, ConditionMeta,
  getCatalog, getOdontogram, createDentalEvent, voidDentalEvent,
  type CatalogResponse, type DentalSite,
} from "@/lib/odontogram";
import { StandardOdontogram } from "@/components/StandardOdontogram";
import { ToothFrontView } from "@/components/ToothFrontView";
import { toothTypeOf, isUpperFdi } from "@/lib/tooth";
import { ToothSurfaceWheel } from "@/components/ToothSurfaceWheel";
import { ArrowUpDown, X } from "lucide-react";

interface Props {
  patientId: string;
}

/**
 * Panel mínimo del odontograma event-sourced (Issue #13).
 * Pensado para embeber en cualquier vista de paciente. NO reemplaza la UI
 * visual del odontograma anatómico — provee el data layer + flujo de registro.
 *
 * Decisiones del discovery #11 aplicadas:
 *   - Dientes en notación FDI (cuadrantes 1-4, piezas 1-8)
 *   - Múltiples condiciones simultáneas por diente (M:N)
 *   - Eventos inmutables vía POST (no edit)
 *   - Superficies multi-select
 */

/** ¿Es una pieza dental o un sitio (sextante/arcada)? */
function esPieza(code: string | null): boolean {
  return !!code && /^\d{2}$/.test(code);
}

/** Etiqueta legible: "Pieza 1.6" o "Arcada superior". */
function etiquetaSitio(code: string, sites?: DentalSite[]): string {
  if (esPieza(code)) return `Pieza ${code[0]}.${code[1]}`;
  return sites?.find((s) => s.code === code)?.label ?? code;
}

const SURFACE_LABELS: Record<DentalSurface, string> = {
  V: "Vestibular", P: "Palatino", L: "Lingual",
  M: "Mesial",     D: "Distal",   O: "Oclusal",   I: "Incisal",
};

function conditionChipColor(code: string): string {
  switch (code) {
    case "caries":            return "bg-red-100 text-red-800";
    case "obturacion":        return "bg-emerald-100 text-emerald-800";
    case "endodoncia":        return "bg-amber-100 text-amber-800";
    case "corona":            return "bg-blue-100 text-blue-800";
    case "implante":          return "bg-violet-100 text-violet-800";
    case "extraccion":        return "bg-gray-200 text-gray-700 line-through";
    case "ortodoncia":        return "bg-pink-100 text-pink-800";
    case "fractura":          return "bg-orange-100 text-orange-800";
    case "perno":             return "bg-cyan-100 text-cyan-800";
    case "sellante":          return "bg-teal-100 text-teal-800";
    case "movilidad":         return "bg-yellow-100 text-yellow-800";
    case "periodontal_bolsa": return "bg-rose-100 text-rose-800";
    case "sano":              return "bg-green-100 text-green-700";
    default:                  return "bg-gray-100 text-gray-700";
  }
}

export function OdontogramPanel({ patientId }: Props) {
  const [teeth,   setTeeth]   = useState<Record<string, ToothProjection>>({});
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [showAddFor, setShowAddFor] = useState<string | null>(null);
  // Cara elegida al clickear directo sobre el diagrama: el modal abre con
  // ella ya marcada en vez de pedirla de nuevo.
  const [caraInicial, setCaraInicial] = useState<DentalSurface[]>([]);
  const [anulando, setAnulando] = useState<string | null>(null);

  /**
   * Anula un hallazgo mal registrado. Pide motivo porque queda en la ficha:
   * el evento no se borra, se marca como anulado con quién y por qué.
   */
  async function anularEvento(eventId: string) {
    const motivo = window.prompt(
      "Motivo de la anulación (queda registrado en la ficha):"
    );
    if (motivo === null) return;              // canceló
    if (!motivo.trim()) { alert("Necesitas indicar un motivo."); return; }
    setAnulando(eventId);
    try {
      await voidDentalEvent(patientId, eventId, motivo.trim());
      await fetchAll();
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo anular");
    } finally {
      setAnulando(null);
    }
  }
  /** El usuario pidió registrar sin tener pieza elegida: el diagrama entra en modo selección. */
  const [pidiendoPieza, setPidiendoPieza] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [cat, odo] = await Promise.all([getCatalog(), getOdontogram(patientId)]);
      setCatalog(cat);
      setTeeth(odo.teeth);
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally     { setLoading(false); }
  }, [patientId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const selectedProjection = useMemo(
    () => selected ? teeth[selected] : null,
    [selected, teeth]
  );

  /** Todos los eventos del paciente, de cualquier pieza o sitio, más recientes primero. */
  const todosLosEventos = useMemo(() => {
    const out: { site: string; e: ToothProjection["events"][number] }[] = [];
    for (const [site, proj] of Object.entries(teeth)) {
      for (const e of proj.events) out.push({ site, e });
    }
    return out.sort((a, b) => new Date(b.e.occurredAt).getTime() - new Date(a.e.occurredAt).getTime());
  }, [teeth]);

  if (loading) return <div className="py-8 text-sm text-gray-400 text-center">Cargando odontograma…</div>;
  if (error)   return <div className="py-8 text-sm text-red-500 text-center">{error}</div>;
  if (!catalog) return null;

  return (
    <div className="flex flex-col gap-4">
      {/* Header con la acción primaria siempre visible. Antes "Registrar
          evento" solo existía después de elegir una pieza, así que la acción
          principal del odontograma estaba escondida tras un paso previo. */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Odontograma</h3>
          <p className="text-[11px] text-gray-400">Notación FDI · {Object.keys(teeth).length} pieza{Object.keys(teeth).length !== 1 ? "s" : ""} con eventos</p>
        </div>
        <button
          onClick={() => selected ? setShowAddFor(selected) : setPidiendoPieza(true)}
          className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl bg-[#1A5C7A] text-white hover:bg-[#0e4560] shadow-sm transition">
          <span className="text-sm leading-none">+</span>
          {selected ? `Registrar en ${etiquetaSitio(selected, catalog?.sites).replace("Pieza ", "")}` : "Registrar hallazgo"}
        </button>
      </div>

      {/* Odontograma estándar — grid simple y profesional */}
      <div className={`bg-white rounded-2xl border p-4 overflow-x-auto transition ${
        pidiendoPieza ? "border-[#1A5C7A] ring-2 ring-[#1A5C7A]/20" : "border-gray-100"
      }`}>
        {pidiendoPieza && (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl bg-[#1A5C7A]/5 text-[#1A5C7A]">
            <span className="text-xs font-bold">Elige la pieza donde registrar el hallazgo</span>
            <button onClick={() => setPidiendoPieza(false)}
              className="ml-auto text-[11px] font-semibold text-gray-400 hover:text-gray-600">Cancelar</button>
          </div>
        )}

        {/* Cómo se usa. Los dos gestos son descubribles solo por accidente:
            nadie adivina que la cara del diente es clickeable, ni que tocar la
            raíz sirve para lo periodontal. Una línea evita esa fricción. */}
        <p className="text-[11px] text-gray-400 mb-3 leading-relaxed">
          Toca una <b className="font-semibold text-gray-500">cara</b> del diagrama para registrar en esa
          superficie (caries, obturación) · toca la <b className="font-semibold text-gray-500">silueta del diente</b> para
          lo que es de la pieza completa (movilidad, bolsa periodontal, endodoncia).
        </p>

        {/* Sextantes y arcadas: una limpieza es de boca completa y una
            panorámica no tiene pieza. Sin esto había que inventar un diente
            o no registrar la prestación. */}
        {(catalog?.sites?.length ?? 0) > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mr-1"
              title="Para prestaciones que no son de un diente: limpieza, destartraje por sector, radiografía panorámica">
              Sin pieza puntual:
            </span>
            {catalog!.sites!.map((s) => (
              <button key={s.code}
                onClick={() => { setSelected(s.code); setPidiendoPieza(false); setCaraInicial([]); setShowAddFor(s.code); }}
                title={s.label}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-gray-200 text-gray-500 hover:border-[#1A5C7A] hover:text-[#1A5C7A] transition">
                {s.label.replace(/\s*\(.*\)/, "")}
              </button>
            ))}
          </div>
        )}
        <StandardOdontogram
          teeth={teeth}
          selectedFdis={selected}
          mode="single"
          anatomical
          cellSize={56}
          onSelectWholeTooth={(fdi) => {
            // Tocar la silueta (que muestra la raíz) abre el registro sin
            // caras: es el gesto natural para movilidad, bolsa periodontal o
            // endodoncia, que son de la pieza completa y no de una cara.
            setSelected(fdi);
            setPidiendoPieza(false);
            setCaraInicial([]);
            setShowAddFor(fdi);
          }}
          onSelectSurface={(fdi, cara) => {
            setSelected(fdi);
            setPidiendoPieza(false);
            setCaraInicial([cara]);
            setShowAddFor(fdi);
          }}
          onSelectTooth={(fdi) => {
            setSelected(fdi);
            // Si el usuario pidió registrar antes de elegir pieza, el click en
            // el diente encadena directo al formulario en vez de dejarlo a
            // medio camino.
            if (pidiendoPieza) { setPidiendoPieza(false); setShowAddFor(fdi); }
          }}
        />
      </div>

      {/* Tabla de hallazgos — la lectura auditable del odontograma */}
      <FindingsTable
        teeth={teeth}
        catalog={catalog}
        selected={selected}
        onSelect={setSelected}
      />

      {/* Tabla de todos los eventos — sin esto había que ir pieza por pieza
          para saber qué se registró y quién lo hizo. */}
      {todosLosEventos.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <h4 className="text-sm font-bold text-gray-900">Registro clínico</h4>
            <p className="text-[11px] text-gray-400">
              {todosLosEventos.length} evento{todosLosEventos.length !== 1 ? "s" : ""} · anular un registro no lo borra:
              queda en la ficha con el motivo y quién lo anuló
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-50">
                  <th className="px-4 py-2 font-bold">Fecha</th>
                  <th className="px-3 py-2 font-bold">Sitio</th>
                  <th className="px-3 py-2 font-bold">Caras</th>
                  <th className="px-3 py-2 font-bold">Estado</th>
                  <th className="px-3 py-2 font-bold">Registró</th>
                  <th className="px-3 py-2 font-bold text-right">Anular</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {todosLosEventos.map(({ site, e }) => (
                  <tr key={e.id} className="hover:bg-gray-50/60 transition">
                    <td className="px-4 py-2 text-gray-500 tabular-nums whitespace-nowrap">
                      {new Date(e.occurredAt).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" })}
                    </td>
                    <td className="px-3 py-2 font-semibold text-gray-700 whitespace-nowrap">
                      {etiquetaSitio(site, catalog.sites).replace("Pieza ", "")}
                    </td>
                    <td className="px-3 py-2 text-gray-400">
                      {e.surfaces.length > 0 ? e.surfaces.map((x) => x.surface).join("·") : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${conditionChipColor(e.conditionCode)}`}>
                        {catalog.conditions.find((x) => x.code === e.conditionCode)?.label ?? e.conditionCode}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-500 truncate max-w-[160px]">
                      {e.professional?.name ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => anularEvento(e.id)} disabled={anulando === e.id}
                        title="Anular este registro (queda en la ficha con el motivo)"
                        className="text-[11px] font-bold text-gray-300 hover:text-red-600 transition disabled:opacity-50">
                        {anulando === e.id ? "…" : "Anular"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detalle del diente seleccionado */}
      {selected && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Vista anatómica: la grilla usa el diagrama de superficies (denso,
                  para escanear); acá se ve la pieza real al analizarla. */}
              <ToothFrontView
                type={toothTypeOf(selected)}
                jaw={isUpperFdi(selected) ? "upper" : "lower"}
                size={34}
                tint={selectedProjection?.isExtracted ? "#9CA3AF" : undefined}
              />
              <div>
                <h4 className="text-sm font-bold text-gray-900">{etiquetaSitio(selected, catalog?.sites)}</h4>
                {selectedProjection?.isExtracted && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-red-600">Extraída</span>
                )}
              </div>
            </div>
            <button onClick={() => setShowAddFor(selected)}
              className="text-xs font-bold px-3 py-1.5 rounded-xl bg-[#1A5C7A] text-white hover:bg-[#0e4560] transition">
              + Registrar evento
            </button>
          </div>

          {/* Condiciones activas */}
          {(selectedProjection?.activeConditions?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedProjection!.activeConditions.map((c) => (
                <span key={c.eventId}
                  className={`text-[11px] font-semibold px-2 py-1 rounded-full ${conditionChipColor(c.conditionCode)}`}>
                  {catalog.conditions.find((x) => x.code === c.conditionCode)?.label ?? c.conditionCode}
                  {c.surfaces.length > 0 && <span className="opacity-60 ml-1">{c.surfaces.join("·")}</span>}
                  {c.severity != null && <span className="opacity-60 ml-1">sev {c.severity}</span>}
                </span>
              ))}
            </div>
          )}

          {/* Historial completo */}
          {(selectedProjection?.events?.length ?? 0) > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Historial</p>
              <div className="flex flex-col divide-y divide-gray-50">
                {selectedProjection!.events.map((e) => (
                  <div key={e.id} className="py-2 flex items-center gap-2 text-xs">
                    <span className="text-[10px] text-gray-400 tabular-nums w-20 shrink-0">
                      {new Date(e.occurredAt).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "2-digit" })}
                    </span>
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      e.eventType === "DIAGNOSIS"  ? "bg-amber-50 text-amber-700"
                      : e.eventType === "TREATMENT" ? "bg-emerald-50 text-emerald-700"
                                                    : "bg-gray-50 text-gray-500"
                    }`}>{e.eventType.slice(0, 4)}</span>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${conditionChipColor(e.conditionCode)}`}>
                      {catalog.conditions.find((x) => x.code === e.conditionCode)?.label ?? e.conditionCode}
                    </span>
                    {e.surfaces.length > 0 && (
                      <span className="text-[10px] text-gray-400">{e.surfaces.map((s) => s.surface).join("·")}</span>
                    )}
                    <span className="ml-auto text-[10px] text-gray-400 truncate">{e.professional?.name?.split(" ")[0] ?? "—"}</span>
                    <button
                      onClick={() => anularEvento(e.id)}
                      disabled={anulando === e.id}
                      title="Anular este registro (queda en la ficha con el motivo)"
                      className="text-[10px] font-bold text-gray-300 hover:text-red-600 transition shrink-0 disabled:opacity-50">
                      {anulando === e.id ? "…" : "Anular"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(selectedProjection?.events?.length ?? 0) === 0 && (
            <p className="text-xs text-gray-400 py-4 text-center">Sin eventos registrados para esta pieza</p>
          )}
        </div>
      )}

      {/* Modal registrar evento */}
      {showAddFor && catalog && (
        <AddEventModal
          toothFDI={showAddFor}
          patientId={patientId}
          catalog={catalog}
          initialSurfaces={caraInicial}
          onClose={() => { setShowAddFor(null); setCaraInicial([]); }}
          onCreated={() => { setShowAddFor(null); setCaraInicial([]); fetchAll(); }}
        />
      )}
    </div>
  );
}

/* ─── Tabla de hallazgos ───────────────────────────────────────────────────
 * El odontograma se lee rápido pero no se audita: no permite ordenar por
 * fecha, ni contar cuántas caries hay pendientes, ni leerlo en voz alta al
 * paciente. Esta tabla es la misma información en forma de lista —el patrón
 * que las clínicas ya usan bajo el gráfico— y mantiene la selección
 * sincronizada con el diagrama en ambos sentidos.
 */
type FindingRow = {
  fdi:           string;
  conditionCode: string;
  surfaces:      DentalSurface[];
  occurredAt:    string;
  severity:      number | null;
  isExtracted:   boolean;
};

/** Orden anatómico: cuadrantes 1→4, y dentro de cada uno de la línea media hacia atrás. */
function ordenFdi(a: string, b: string): number {
  const qa = Number(a[0]), qb = Number(b[0]);
  if (qa !== qb) return qa - qb;
  return Number(a[1]) - Number(b[1]);
}

function FindingsTable({
  teeth, catalog, selected, onSelect,
}: {
  teeth:    Record<string, ToothProjection>;
  catalog:  { conditions: ConditionMeta[]; surfaces: DentalSurface[] };
  selected: string | null;
  onSelect: (fdi: string) => void;
}) {
  const [orden, setOrden] = useState<"pieza" | "fecha">("pieza");
  const [soloPendientes, setSoloPendientes] = useState(false);

  const filas = useMemo(() => {
    const out: FindingRow[] = [];
    for (const proj of Object.values(teeth)) {
      if (proj.isExtracted) {
        // La extracción se muestra como hallazgo aunque ya no tenga condiciones
        // activas: es el dato más relevante de esa pieza.
        const ev = proj.events.find((e) => e.conditionCode === "extraccion" || e.conditionCode === "ausente");
        out.push({
          fdi: proj.toothFDI, conditionCode: ev?.conditionCode ?? "ausente",
          surfaces: [], occurredAt: ev?.occurredAt ?? "", severity: null, isExtracted: true,
        });
        continue;
      }
      for (const c of proj.activeConditions) {
        if (c.conditionCode === "sano") continue;
        out.push({
          fdi: proj.toothFDI, conditionCode: c.conditionCode, surfaces: c.surfaces,
          occurredAt: c.occurredAt, severity: c.severity, isExtracted: false,
        });
      }
    }
    const visibles = soloPendientes
      ? out.filter((f) => CONDITION_STATE[f.conditionCode] === "pendiente")
      : out;
    return visibles.sort((a, b) =>
      orden === "pieza"
        ? ordenFdi(a.fdi, b.fdi)
        : (b.occurredAt ?? "").localeCompare(a.occurredAt ?? ""),
    );
  }, [teeth, orden, soloPendientes]);

  const pendientes = useMemo(
    () => Object.values(teeth).reduce(
      (n, p) => n + (p.isExtracted ? 0 : p.activeConditions.filter((c) => CONDITION_STATE[c.conditionCode] === "pendiente").length),
      0,
    ),
    [teeth],
  );

  const labelDe = (code: string) =>
    catalog.conditions.find((c) => c.code === code)?.label ?? code;

  if (Object.keys(teeth).length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
        <p className="text-sm text-gray-400">Sin hallazgos registrados</p>
        <p className="text-[11px] text-gray-300 mt-1">Selecciona una pieza en el diagrama para registrar el primero</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-3 flex-wrap border-b border-gray-50">
        <h4 className="text-sm font-bold text-gray-900">Hallazgos</h4>
        <span className="text-[11px] text-gray-400">
          {filas.length} registro{filas.length !== 1 ? "s" : ""}
          {pendientes > 0 && <span className="text-red-600 font-bold"> · {pendientes} pendiente{pendientes !== 1 ? "s" : ""}</span>}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {pendientes > 0 && (
            <button onClick={() => setSoloPendientes((v) => !v)}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition ${
                soloPendientes
                  ? "bg-red-50 text-red-700 border-red-200"
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
              }`}>
              Solo pendientes
            </button>
          )}
          <button onClick={() => setOrden((o) => (o === "pieza" ? "fecha" : "pieza"))}
            className="text-[11px] font-bold px-2.5 py-1 rounded-lg border border-gray-200 text-gray-500 hover:border-gray-300 transition"
            title="Cambiar el orden de la tabla">
   {orden === "pieza" ? " Por pieza" : " Por fecha"}
          </button>
        </div>
      </div>

      {filas.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-6">Sin hallazgos con este filtro</p>
      ) : (
        <>
          <div className="hidden sm:grid grid-cols-[70px_1fr_120px_90px_90px] gap-3 px-4 py-2 border-b border-gray-50">
            {["Pieza", "Hallazgo", "Caras", "Estado", "Fecha"].map((h) => (
              <span key={h} className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{h}</span>
            ))}
          </div>
          <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
            {filas.map((f, i) => {
              const estado = f.isExtracted ? "extraido" : (CONDITION_STATE[f.conditionCode] ?? "tratado");
              const isSel = selected === f.fdi;
              return (
                <button key={`${f.fdi}-${f.conditionCode}-${i}`}
                  onClick={() => onSelect(f.fdi)}
                  className={`w-full text-left px-4 py-2.5 flex sm:grid sm:grid-cols-[70px_1fr_120px_90px_90px] sm:gap-3 items-center gap-2 transition ${
                    isSel ? "bg-[#1A5C7A]/5" : "hover:bg-gray-50"
                  }`}>
                  <span className={`text-xs font-black tabular-nums ${isSel ? "text-[#1A5C7A]" : "text-gray-700"}`}>
                    {f.fdi[0]}.{f.fdi[1]}
                  </span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full justify-self-start ${conditionChipColor(f.conditionCode)}`}>
                    {labelDe(f.conditionCode)}
                    {f.severity != null && <span className="opacity-60 ml-1">sev {f.severity}</span>}
                  </span>
                  <span className="text-[11px] text-gray-500 tabular-nums">
                    {f.surfaces.length > 0 ? f.surfaces.join("·") : <span className="text-gray-300">—</span>}
                  </span>
                  <span className={`text-[10px] font-bold uppercase tracking-wide ${ESTADO_TEXTO[estado].cls}`}>
                    {ESTADO_TEXTO[estado].label}
                  </span>
                  <span className="text-[10px] text-gray-400 tabular-nums">
                    {f.occurredAt
                      ? new Date(f.occurredAt).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "2-digit" })
                      : "—"}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/* Estado clínico por condición — el mismo criterio de color del diagrama. */
const CONDITION_STATE: Record<string, "pendiente" | "tratado" | "protesis" | "extraido"> = {
  caries: "pendiente", fractura: "pendiente", movilidad: "pendiente", periodontal_bolsa: "pendiente",
  obturacion: "tratado", endodoncia: "tratado", sellante: "tratado", limpieza: "tratado", ortodoncia: "tratado",
  corona: "protesis", implante: "protesis", perno: "protesis",
  extraccion: "extraido", ausente: "extraido",
};

const ESTADO_TEXTO: Record<string, { label: string; cls: string }> = {
  pendiente: { label: "Pendiente", cls: "text-red-600" },
  tratado:   { label: "Tratado",   cls: "text-blue-600" },
  protesis:  { label: "Prótesis",  cls: "text-violet-600" },
  extraido:  { label: "Extraído",  cls: "text-gray-400" },
};

/* ─── Modal: registrar evento clínico ─────────────────────────────────── */
interface AddEventModalProps {
  toothFDI:   string;
  patientId:  string;
  catalog:    CatalogResponse;
  /** Caras ya marcadas al abrir (viene del click directo sobre el diagrama). */
  initialSurfaces?: DentalSurface[];
  onClose:    () => void;
  onCreated:  () => void;
}

function AddEventModal({ toothFDI, patientId, catalog, initialSurfaces = [], onClose, onCreated }: AddEventModalProps) {
  const [eventType, setEventType] = useState<DentalEventType>("DIAGNOSIS");
  const [conditionCode, setCondition] = useState<string>(catalog.conditions[0]?.code ?? "");
  const [surfaces, setSurfaces] = useState<DentalSurface[]>(initialSurfaces);
  const [severity, setSeverity] = useState<string>("");
  const [notes,    setNotes]    = useState<string>("");
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState("");

  const conditionMeta = catalog.conditions.find((c) => c.code === conditionCode);

  // Si se pasa a una condición de pieza completa, las caras marcadas dejan de
  // aplicar: enviarlas igual haría que el backend rechace el registro.
  useEffect(() => {
    if (conditionMeta?.scope === "tooth" && surfaces.length > 0) setSurfaces([]);
  }, [conditionMeta?.scope, surfaces.length]);

  function toggleSurface(s: DentalSurface) {
    setSurfaces((cur) => cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      await createDentalEvent(patientId, {
        toothFDI, eventType, conditionCode,
        surfaces: surfaces.length > 0 ? surfaces : undefined,
        severity: severity ? Number(severity) : undefined,
        notes: notes.trim() || undefined,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-800">Registrar evento — {etiquetaSitio(toothFDI, catalog.sites)}</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 text-lg leading-none"><X className="w-4 h-4" aria-hidden /></button>
        </div>

        <form onSubmit={submit} className="p-5 flex flex-col gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Tipo de evento</label>
            <div className="grid grid-cols-3 gap-1">
              {(["DIAGNOSIS","TREATMENT","OBSERVATION"] as DentalEventType[]).map((t) => (
                <button key={t} type="button" onClick={() => setEventType(t)}
                  className={`px-2 py-1.5 text-xs font-bold rounded-lg border transition ${
                    eventType === t
                      ? "bg-[#1A5C7A] text-white border-[#1A5C7A]"
                      : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                  }`}>
                  {t === "DIAGNOSIS" ? "Diagnóstico" : t === "TREATMENT" ? "Tratamiento" : "Observación"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Condición / procedimiento</label>
            <select value={conditionCode} onChange={(e) => setCondition(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1A5C7A]/30 focus:border-[#1A5C7A]">
              {catalog.conditions.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* La rueda aparece solo si hay caras que elegir: una pieza concreta
              (un sextante no tiene mesial) Y una condición de corona. Una bolsa
              periodontal se mide alrededor de la raíz — preguntarle al dentista
              "¿qué cara?" no tiene respuesta clínica. */}
          {esPieza(toothFDI) && conditionMeta?.scope !== "tooth" && (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Superficies afectadas</label>
              <div className="flex justify-center bg-gray-50 rounded-xl py-3">
                <ToothSurfaceWheel
                  toothFDI={toothFDI}
                  selected={surfaces}
                  onToggle={toggleSurface}
                  size={170}
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-2 text-center">
                Click en cada cara para seleccionar (multi). Una condición puede afectar varias (ej: caries MOD).
              </p>
            </div>
          )}

          {conditionMeta?.allowsSeverity && (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                Severidad {conditionMeta.severityScale ? <span className="opacity-60">({conditionMeta.severityScale})</span> : null}
              </label>
              {conditionMeta.severityMin != null && conditionMeta.severityMax != null ? (
                <div className="flex flex-col gap-2">
                  <div className="flex gap-1 flex-wrap">
                    {Array.from({ length: conditionMeta.severityMax - conditionMeta.severityMin + 1 }, (_, i) => {
                      const v = (conditionMeta.severityMin ?? 0) + i;
                      const label = conditionMeta.severityLabels?.[String(v)];
                      const selected = severity === String(v);
                      return (
                        <button key={v} type="button" onClick={() => setSeverity(String(v))}
                          title={label}
                          className={`w-9 h-9 text-xs font-bold rounded-lg border transition ${
                            selected
                              ? "bg-[#1A5C7A] text-white border-[#1A5C7A]"
                              : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                          }`}>
                          {v}
                        </button>
                      );
                    })}
                  </div>
                  {severity && conditionMeta.severityLabels?.[severity] && (
                    <p className="text-[11px] text-gray-500 italic">{conditionMeta.severityLabels[severity]}</p>
                  )}
                </div>
              ) : (
                <input type="number" min="0" max="20" value={severity} onChange={(e) => setSeverity(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1A5C7A]/30 focus:border-[#1A5C7A]" />
              )}
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Notas</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 2000))}
              rows={2}
              className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1A5C7A]/30 focus:border-[#1A5C7A] resize-none" />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-500 text-sm font-bold hover:border-gray-300 transition">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 rounded-xl bg-[#1A5C7A] text-white text-sm font-bold hover:bg-[#0e4560] transition disabled:opacity-50">
              {saving ? "Guardando…" : "Registrar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
