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
import { Badge, Button, Dialogo, Select, CLASE_CAMPO, CLASE_ETIQUETA } from "@/components/ui";
import { STATE_META, stateOf } from "@/lib/odontogramPaint";
import { ArrowUpDown } from "lucide-react";

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

/**
 * Chip de una condición. Antes cada condición tenía su propio color (13) y
 * contradecían al diagrama: la obturación salía azul en el diente y verde acá.
 * Ahora el chip es neutro y, si es un hallazgo activo, lleva el punto de su
 * estado: el mismo color con que se pinta la pieza.
 */
function ChipCondicion({ label, estado, children }: {
  label: string; estado?: keyof typeof STATE_META; children?: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-ink justify-self-start">
      {estado && <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${STATE_META[estado].dot}`} />}
      {label}
      {children}
    </span>
  );
}

/** El tipo de registro con la palabra completa ("DIAG" no lo lee nadie). */
const TIPO_EVENTO: Record<DentalEventType, string> = {
  DIAGNOSIS: "Diagnóstico", TREATMENT: "Tratamiento", OBSERVATION: "Observación",
};

/** Severidad con el nombre de su escala: "ICDAS 2", no "sev 2". */
function textoSeveridad(meta: ConditionMeta | undefined, v: number): string {
  if (meta?.code === "periodontal_bolsa") return `${v} mm`;
  const escala = meta?.severityScale?.split(" ")[0];   // "ICDAS 0-6" → "ICDAS"
  return escala && /^[A-Za-z]/.test(escala) ? `${escala} ${v}` : `grado ${v}`;
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
  /**
   * Registro que se está anulando. Se pide el motivo en un diálogo propio
   * (antes era window.prompt) porque queda en la ficha: el evento no se borra,
   * se marca como anulado con quién y por qué.
   */
  const [porAnular, setPorAnular] = useState<{ id: string; resumen: string } | null>(null);
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

  if (loading) return <div className="py-8 text-sm text-ink-muted text-center">Cargando odontograma…</div>;
  if (error)   return <div role="alert" className="py-8 text-sm text-danger text-center">{error}</div>;
  if (!catalog) return null;

  const labelDe = (code: string) => catalog.conditions.find((c) => c.code === code)?.label ?? code;
  const metaDe = (code: string) => catalog.conditions.find((c) => c.code === code);
  const resumenEvento = (site: string, e: ToothProjection["events"][number]) =>
    `${labelDe(e.conditionCode)} en ${etiquetaSitio(site, catalog.sites).replace("Pieza ", "pieza ")}` +
    (e.surfaces.length > 0 ? ` (${e.surfaces.map((x) => x.surface).join("·")})` : "");

  return (
    <div className="flex flex-col gap-4">
      {/* Header con la acción primaria siempre visible. Antes "Registrar
          evento" solo existía después de elegir una pieza, así que la acción
          principal del odontograma estaba escondida tras un paso previo. */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-bold text-brand-strong">Odontograma</h3>
          <p className="text-[13px] text-ink-muted">Notación FDI · {Object.keys(teeth).length} pieza{Object.keys(teeth).length !== 1 ? "s" : ""} con registros</p>
        </div>
        <Button size="sm" onClick={() => selected ? setShowAddFor(selected) : setPidiendoPieza(true)}>
          <span aria-hidden className="text-base leading-none">+</span>
          {selected ? `Registrar en ${etiquetaSitio(selected, catalog?.sites).replace("Pieza ", "")}` : "Registrar hallazgo"}
        </Button>
      </div>

      {/* Odontograma estándar — grid simple y profesional */}
      <div className={`bg-white rounded-2xl border p-4 overflow-x-auto transition ${
        pidiendoPieza ? "border-brand ring-2 ring-brand/20" : "border-line"
      }`}>
        {pidiendoPieza && (
          <div role="status" className="flex items-center gap-2 mb-3 px-3 py-1 rounded-xl bg-brand-soft text-brand-ink">
            <span className="text-sm font-bold">Elige la pieza donde registrar el hallazgo</span>
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setPidiendoPieza(false)}>Cancelar</Button>
          </div>
        )}

        {/* Cómo se usa. Los dos gestos son descubribles solo por accidente:
            nadie adivina que la cara del diente es clickeable, ni que tocar la
            raíz sirve para lo periodontal. Una línea evita esa fricción. */}
        <p className="text-[13px] text-ink-muted mb-3 leading-relaxed">
          Toca una <b className="font-semibold text-ink">cara</b> del diagrama para registrar en esa
          superficie (caries, obturación) · toca la <b className="font-semibold text-ink">silueta del diente</b> para
          lo que es de la pieza completa (movilidad, bolsa periodontal, endodoncia). Con teclado: elige la pieza
          y usa &quot;Registrar&quot;.
        </p>

        {/* Sextantes y arcadas: una limpieza es de boca completa y una
            panorámica no tiene pieza. Sin esto había que inventar un diente
            o no registrar la prestación. */}
        {(catalog?.sites?.length ?? 0) > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted mr-1"
              title="Para prestaciones que no son de un diente: limpieza, destartraje por sector, radiografía panorámica">
              Por sector:
            </span>
            {catalog!.sites!.map((s) => (
              <button key={s.code}
                onClick={() => { setSelected(s.code); setPidiendoPieza(false); setCaraInicial([]); setShowAddFor(s.code); }}
                title={s.label}
                className="min-h-9 text-xs font-semibold px-3 rounded-lg border border-line text-ink-muted hover:border-brand hover:text-brand transition">
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
        <div className="bg-white rounded-2xl border border-line overflow-hidden">
          <div className="px-4 py-3 border-b border-line-soft">
            <h4 className="text-base font-bold text-brand-strong">Registro clínico</h4>
            <p className="text-[13px] text-ink-muted">
              {todosLosEventos.length} registro{todosLosEventos.length !== 1 ? "s" : ""} · anular un registro no lo borra:
              queda en la ficha con el motivo y quién lo anuló
            </p>
          </div>
          {/* relative: sin esto el "Acciones" oculto del encabezado (sr-only,
              absoluto) se sale del scroll y la página se ensancha en el celular. */}
          <div className="relative overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-xs font-bold text-ink-muted border-b border-line-soft">
                  <th className="px-4 py-2 font-bold">Fecha</th>
                  <th className="px-3 py-2 font-bold">Sitio</th>
                  <th className="px-3 py-2 font-bold">Caras</th>
                  <th className="px-3 py-2 font-bold">Registro</th>
                  <th className="px-3 py-2 font-bold">Tipo</th>
                  <th className="px-3 py-2 font-bold">Registró</th>
                  <th className="px-3 py-2 font-bold text-right"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {todosLosEventos.map(({ site, e }) => (
                  <tr key={e.id} className="hover:bg-gray-50/60 transition">
                    <td className="px-4 py-2 text-ink-muted tabular-nums whitespace-nowrap">
                      {new Date(e.occurredAt).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "2-digit" })}
                    </td>
                    <td className="px-3 py-2 font-semibold text-ink whitespace-nowrap">
                      {etiquetaSitio(site, catalog.sites).replace("Pieza ", "")}
                    </td>
                    <td className="px-3 py-2 text-ink-muted">
                      {e.surfaces.length > 0 ? e.surfaces.map((x) => x.surface).join("·") : "—"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <ChipCondicion label={labelDe(e.conditionCode)} />
                    </td>
                    <td className="px-3 py-2"><Badge>{TIPO_EVENTO[e.eventType]}</Badge></td>
                    <td className="px-3 py-2 text-ink-muted truncate max-w-[160px]">
                      {e.professional?.name ?? "—"}
                    </td>
                    <td className="px-1 py-0.5 text-right">
                      <BotonAnular onClick={() => setPorAnular({ id: e.id, resumen: resumenEvento(site, e) })} />
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
        <div className="bg-white rounded-2xl border border-line p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Vista anatómica: la grilla usa el diagrama de superficies (denso,
                  para escanear); acá se ve la pieza real al analizarla. */}
              <ToothFrontView
                type={toothTypeOf(selected)}
                jaw={isUpperFdi(selected) ? "upper" : "lower"}
                size={34}
                tint={selectedProjection?.isExtracted ? STATE_META.extracted.color : undefined}
              />
              <div>
                <h4 className="text-base font-bold text-brand-strong">{etiquetaSitio(selected, catalog?.sites)}</h4>
                {selectedProjection?.isExtracted && (
                  <span className={`text-xs font-bold ${STATE_META.extracted.text}`}>Extraída</span>
                )}
              </div>
            </div>
            {/* Secundario: la acción principal es el botón de arriba. */}
            <Button variant="secondary" size="sm" onClick={() => setShowAddFor(selected)}>
              + Registrar evento
            </Button>
          </div>

          {/* Condiciones activas */}
          {(selectedProjection?.activeConditions?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedProjection!.activeConditions.map((c) => (
                <ChipCondicion key={c.eventId} label={labelDe(c.conditionCode)} estado={stateOf(c.conditionCode)}>
                  {c.surfaces.length > 0 && <span className="text-ink-muted">{c.surfaces.join("·")}</span>}
                  {c.severity != null && <span className="text-ink-muted">{textoSeveridad(metaDe(c.conditionCode), c.severity)}</span>}
                </ChipCondicion>
              ))}
            </div>
          )}

          {/* Historial completo */}
          {(selectedProjection?.events?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs font-bold text-ink-muted mb-1">Historial</p>
              <div className="flex flex-col divide-y divide-line-soft">
                {selectedProjection!.events.map((e) => (
                  <div key={e.id} className="py-1 flex items-center gap-2 text-[13px] flex-wrap">
                    <span className="text-xs text-ink-muted tabular-nums w-20 shrink-0">
                      {new Date(e.occurredAt).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "2-digit" })}
                    </span>
                    <Badge>{TIPO_EVENTO[e.eventType]}</Badge>
                    <ChipCondicion label={labelDe(e.conditionCode)} />
                    {e.surfaces.length > 0 && (
                      <span className="text-xs text-ink-muted">{e.surfaces.map((s) => s.surface).join("·")}</span>
                    )}
                    <span className="ml-auto text-xs text-ink-muted truncate">{e.professional?.name ?? "—"}</span>
                    <BotonAnular onClick={() => setPorAnular({ id: e.id, resumen: resumenEvento(selected, e) })} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {(selectedProjection?.events?.length ?? 0) === 0 && (
            <p className="text-sm text-ink-muted py-4 text-center">Sin registros para esta pieza</p>
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

      {porAnular && (
        <DialogoAnular
          resumen={porAnular.resumen}
          onClose={() => setPorAnular(null)}
          onAnular={async (motivo) => {
            await voidDentalEvent(patientId, porAnular.id, motivo);
            setPorAnular(null);
            await fetchAll();
          }}
        />
      )}
    </div>
  );
}

/** "Anular" con área de toque de 44px y contraste legible (era gris-300, 1,6:1). */
function BotonAnular({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      title="Anular este registro (queda en la ficha con el motivo)"
      className="min-h-11 px-3 text-xs font-bold text-ink-muted rounded-control hover:text-danger hover:bg-danger-soft transition shrink-0 focus-visible:outline-2 focus-visible:outline-brand">
      Anular
    </button>
  );
}

/**
 * Pide el motivo de una anulación. Anular no borra: el registro queda en la
 * ficha marcado como anulado, con el motivo y quién lo anuló (Ley 20.584).
 */
function DialogoAnular({ resumen, onClose, onAnular }: {
  resumen: string;
  onClose: () => void;
  onAnular: (motivo: string) => Promise<void>;
}) {
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!motivo.trim()) { setError("Escribe el motivo: queda en la ficha junto al registro anulado."); return; }
    setGuardando(true); setError("");
    try { await onAnular(motivo.trim()); }
    catch (err) { setError(err instanceof Error ? err.message : "No se pudo anular. Intenta de nuevo."); setGuardando(false); }
  }

  return (
    <Dialogo titulo="Anular registro" subtitulo={resumen} onClose={onClose} ancho="sm" capa={70}>
      <form onSubmit={enviar} className="p-5 flex flex-col gap-4">
        <p className="text-sm text-ink-muted">
          El registro no se borra: queda en la ficha marcado como anulado, con el motivo y quién lo anuló.
        </p>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="motivo-anulacion" className={CLASE_ETIQUETA}>Motivo</label>
          <textarea id="motivo-anulacion" value={motivo} rows={3}
            onChange={(e) => setMotivo(e.target.value.slice(0, 500))}
            aria-invalid={Boolean(error) || undefined} aria-describedby={error ? "motivo-error" : undefined}
            placeholder="Ej: lo registré en la pieza equivocada"
            className={`${CLASE_CAMPO} py-2 resize-none`} />
          {error && <p id="motivo-error" role="alert" className="text-sm text-danger">{error}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" block onClick={onClose}>Cancelar</Button>
          <Button variant="danger" type="submit" block loading={guardando}>Anular registro</Button>
        </div>
      </form>
    </Dialogo>
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
        const ev = proj.events.find((e) =>
          (e.conditionCode === "extraccion" && e.eventType === "TREATMENT") || e.conditionCode === "ausente");
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
      ? out.filter((f) => !f.isExtracted && stateOf(f.conditionCode) === "pending")
      : out;
    return visibles.sort((a, b) =>
      orden === "pieza"
        ? ordenFdi(a.fdi, b.fdi)
        : (b.occurredAt ?? "").localeCompare(a.occurredAt ?? ""),
    );
  }, [teeth, orden, soloPendientes]);

  const pendientes = useMemo(
    () => Object.values(teeth).reduce(
      (n, p) => n + (p.isExtracted ? 0 : p.activeConditions.filter((c) => stateOf(c.conditionCode) === "pending").length),
      0,
    ),
    [teeth],
  );

  const labelDe = (code: string) =>
    catalog.conditions.find((c) => c.code === code)?.label ?? code;
  const metaDe = (code: string) => catalog.conditions.find((c) => c.code === code);

  if (Object.keys(teeth).length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-line p-6 text-center">
        <p className="text-sm font-semibold text-ink">Este paciente aún no tiene registros en el odontograma</p>
        <p className="text-[13px] text-ink-muted mt-1">Toca una cara o un diente para registrar el primero</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-line overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-3 flex-wrap border-b border-line-soft">
        <h4 className="text-base font-bold text-brand-strong">Hallazgos</h4>
        <span className="text-[13px] text-ink-muted">
          {filas.length} registro{filas.length !== 1 ? "s" : ""}
          {pendientes > 0 && <span className={`font-bold ${STATE_META.pending.text}`}> · {pendientes} pendiente{pendientes !== 1 ? "s" : ""}</span>}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {pendientes > 0 && (
            <button onClick={() => setSoloPendientes((v) => !v)} aria-pressed={soloPendientes}
              className={`min-h-9 text-xs font-bold px-3 rounded-lg border transition ${
                soloPendientes
                  ? `${STATE_META.pending.bgSoft} ${STATE_META.pending.text} border-clinical-pending/30`
                  : "bg-white text-ink-muted border-line hover:border-brand hover:text-brand"
              }`}>
              Solo pendientes
            </button>
          )}
          <button onClick={() => setOrden((o) => (o === "pieza" ? "fecha" : "pieza"))}
            className="min-h-9 inline-flex items-center gap-1.5 text-xs font-bold px-3 rounded-lg border border-line text-ink-muted hover:border-brand hover:text-brand transition"
            title="Cambiar el orden de la tabla">
            <ArrowUpDown className="h-3.5 w-3.5" aria-hidden />
            {orden === "pieza" ? "Por pieza" : "Por fecha"}
          </button>
        </div>
      </div>

      {filas.length === 0 ? (
        <p className="text-sm text-ink-muted text-center py-6">Sin hallazgos con este filtro</p>
      ) : (
        <>
          <div className="hidden sm:grid grid-cols-[70px_1fr_120px_90px_90px] gap-3 px-4 py-2 border-b border-line-soft">
            {["Pieza", "Hallazgo", "Caras", "Estado", "Fecha"].map((h) => (
              <span key={h} className="text-xs font-bold text-ink-muted">{h}</span>
            ))}
          </div>
          <div className="divide-y divide-line-soft max-h-80 overflow-y-auto">
            {filas.map((f, i) => {
              const estado = f.isExtracted ? "extracted" : stateOf(f.conditionCode);
              const isSel = selected === f.fdi;
              return (
                <button key={`${f.fdi}-${f.conditionCode}-${i}`}
                  onClick={() => onSelect(f.fdi)} aria-pressed={isSel}
                  className={`w-full text-left px-4 py-2.5 flex sm:grid sm:grid-cols-[70px_1fr_120px_90px_90px] sm:gap-3 items-center gap-2 flex-wrap transition ${
                    isSel ? "bg-brand-soft" : "hover:bg-gray-50"
                  }`}>
                  <span className={`text-sm font-black tabular-nums ${isSel ? "text-brand" : "text-ink"}`}>
                    {f.fdi[0]}.{f.fdi[1]}
                  </span>
                  <ChipCondicion label={labelDe(f.conditionCode)} estado={estado}>
                    {f.severity != null && <span className="text-ink-muted">{textoSeveridad(metaDe(f.conditionCode), f.severity)}</span>}
                  </ChipCondicion>
                  <span className="text-[13px] text-ink-muted tabular-nums">
                    {f.surfaces.length > 0 ? f.surfaces.join("·") : "—"}
                  </span>
                  <span className={`text-xs font-bold ${STATE_META[estado].text}`}>
                    {STATE_META[estado].label}
                  </span>
                  <span className="text-xs text-ink-muted tabular-nums">
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

  const botonOpcion = (activo: boolean) =>
    `min-h-11 px-2 text-sm font-bold rounded-control border transition focus-visible:outline-2 focus-visible:outline-brand ${
      activo ? "bg-brand text-white border-brand" : "bg-white text-ink-muted border-line hover:border-brand hover:text-brand"
    }`;

  return (
    // capa 70: la ficha también se abre como modal (PatientRecordModal, z 60).
    <Dialogo titulo={`Registrar en ${etiquetaSitio(toothFDI, catalog.sites).replace("Pieza ", "pieza ")}`} onClose={onClose} capa={70}>
      <form onSubmit={submit} className="p-5 flex flex-col gap-4">
        <fieldset>
          <legend className={`${CLASE_ETIQUETA} mb-1.5`}>¿Qué registras?</legend>
          <div className="grid grid-cols-3 gap-1">
            {(["DIAGNOSIS","TREATMENT","OBSERVATION"] as DentalEventType[]).map((t) => (
              <button key={t} type="button" onClick={() => setEventType(t)} aria-pressed={eventType === t}
                className={botonOpcion(eventType === t)}>
                {TIPO_EVENTO[t]}
              </button>
            ))}
          </div>
        </fieldset>

        <Select label="Hallazgo o tratamiento" value={conditionCode} onChange={(e) => setCondition(e.target.value)}>
          {catalog.conditions.map((c) => (
            <option key={c.code} value={c.code}>{c.label}</option>
          ))}
        </Select>

        {/* La rueda aparece solo si hay caras que elegir: una pieza concreta
            (un sextante no tiene mesial) Y una condición de corona. Una bolsa
            periodontal se mide alrededor de la raíz — preguntarle al dentista
            "¿qué cara?" no tiene respuesta clínica. */}
        {esPieza(toothFDI) && conditionMeta?.scope !== "tooth" && (
          <fieldset>
            <legend className={`${CLASE_ETIQUETA} mb-1.5`}>Caras</legend>
            <div className="flex justify-center bg-gray-50 rounded-xl py-3">
              <ToothSurfaceWheel
                toothFDI={toothFDI}
                selected={surfaces}
                onToggle={toggleSurface}
                size={170}
              />
            </div>
            <p className="text-[13px] text-ink-muted mt-2 text-center">
              Toca cada cara afectada; puede ser más de una (ej: caries MOD).
            </p>
          </fieldset>
        )}

        {conditionMeta?.allowsSeverity && (
          conditionMeta.severityMin != null && conditionMeta.severityMax != null ? (
            <fieldset>
              <legend className={`${CLASE_ETIQUETA} mb-1.5`}>
                Severidad {conditionMeta.severityScale ? <span className="font-normal text-ink-muted">({conditionMeta.severityScale})</span> : null}
              </legend>
              <div className="flex flex-col gap-2">
                <div className="flex gap-1 flex-wrap">
                  {Array.from({ length: conditionMeta.severityMax - conditionMeta.severityMin + 1 }, (_, i) => {
                    const v = (conditionMeta.severityMin ?? 0) + i;
                    const label = conditionMeta.severityLabels?.[String(v)];
                    const selected = severity === String(v);
                    return (
                      <button key={v} type="button" onClick={() => setSeverity(String(v))}
                        title={label} aria-pressed={selected} aria-label={label ? `${v}: ${label}` : String(v)}
                        className={`w-11 ${botonOpcion(selected)}`}>
                        {v}
                      </button>
                    );
                  })}
                </div>
                {severity && conditionMeta.severityLabels?.[severity] && (
                  <p className="text-[13px] text-ink-muted">{conditionMeta.severityLabels[severity]}</p>
                )}
              </div>
            </fieldset>
          ) : (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="severidad" className={CLASE_ETIQUETA}>
                Severidad {conditionMeta.severityScale ? <span className="font-normal text-ink-muted">({conditionMeta.severityScale})</span> : null}
              </label>
              <input id="severidad" type="number" min="0" max="20" value={severity} onChange={(e) => setSeverity(e.target.value)}
                className={CLASE_CAMPO} />
            </div>
          )
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="notas-evento" className={CLASE_ETIQUETA}>Notas</label>
          <textarea id="notas-evento" value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 2000))}
            rows={2} className={`${CLASE_CAMPO} py-2 resize-none`} />
        </div>

        {error && <p role="alert" className="text-sm text-danger">{error}</p>}

        <div className="flex gap-2 pt-1">
          <Button variant="secondary" block onClick={onClose}>Cancelar</Button>
          <Button type="submit" block loading={saving}>{saving ? "Guardando…" : "Registrar"}</Button>
        </div>
      </form>
    </Dialogo>
  );
}
