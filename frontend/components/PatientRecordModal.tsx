"use client";

import { useCallback, useEffect, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { BotonCerrar, Button, Tabs, useDialogo } from "@/components/ui";
import { cx } from "@/lib/cx";
import { getClinicalRecord, type ClinicalRecord } from "@/lib/clinicalRecord";
import { OdontogramPanel } from "@/components/OdontogramPanel";
import { AnamnesisPanel } from "@/components/AnamnesisPanel";
import { ConsentsPanel } from "@/components/ConsentsPanel";
import { GENDER_LABEL, ResumenTab } from "./ficha/Resumen";
import { ImagenesTab, SesionesTab } from "./ficha/Evoluciones";

interface Props {
  patientId: string;
  onClose: () => void;
}

type Tab = "resumen" | "anamnesis" | "odontograma" | "sesiones" | "imagenes" | "consentimientos";

const TAB_LABELS: Record<Tab, string> = {
  resumen: "Resumen", anamnesis: "Anamnesis", odontograma: "Odontograma",
  sesiones: "Evoluciones", imagenes: "Imágenes", consentimientos: "Consentimientos",
};

/** Edad en años a partir de la fecha de nacimiento ISO; null si no hay dato. */
function edadDe(birthDate?: string | null): number | null {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (isNaN(b.getTime())) return null;
  const hoy = new Date();
  let años = hoy.getFullYear() - b.getFullYear();
  const m = hoy.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < b.getDate())) años--;
  return años;
}

function inicialesDe(nombre: string): string {
  return nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("") || "?";
}

/**
 * Ficha clínica embebible: el mismo contenido sirve para la página completa
 * (/partners/pacientes/[id]) y para el modal legado.
 *
 * Arriba siempre: quién es, quién lo atiende y sus alertas clínicas. Lo
 * crítico (una alergia) no puede depender de abrir una pestaña.
 */
export function PatientRecordView({
  patientId, variant = "page", onClose,
}: {
  patientId: string;
  variant?: "page" | "modal";
  onClose?: () => void;
}) {
  const [record, setRecord] = useState<ClinicalRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [tab,     setTab]     = useState<Tab>("resumen");

  const fetchRecord = useCallback(async () => {
    setLoading(true); setError("");
    try { setRecord(await getClinicalRecord(patientId)); }
    catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally   { setLoading(false); }
  }, [patientId]);

  useEffect(() => { fetchRecord(); }, [fetchRecord]);

  const nombre = record?.identity
    ? `${record.identity.firstName} ${record.identity.lastName}`
    : (record?.patient.name ?? "Ficha clínica");
  const edad = edadDe(record?.identity?.birthDate);
  const telefono = record?.identity?.phone ?? record?.patient.phone;
  const email = record?.identity?.email ?? record?.patient.email;
  const datos = [
    record?.identity?.rut ? `RUT ${record.identity.rut}` : null,
    edad != null ? `${edad} años` : null,
    record?.identity?.gender ? GENDER_LABEL[record.identity.gender] ?? record.identity.gender : null,
    telefono, email,
  ].filter(Boolean).join(" · ");
  const ultima = record?.lastVisit ? [
    record.lastVisit.doctor && record.lastVisit.doctor !== "Sin asignar" ? `Lo atiende ${record.lastVisit.doctor}` : null,
    `última atención el ${new Date(record.lastVisit.date).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })}`,
    record.lastVisit.service,
    record.lastVisit.sede,
  ].filter(Boolean).join(" · ") : null;

  return (
    <div className={cx("flex flex-col", variant === "modal" ? "h-full overflow-hidden" : "gap-4")}>
      {/* ── Quién es ── */}
      <header className={cx("shrink-0 bg-surface", variant === "page" ? "rounded-card border border-line p-5" : "border-b border-line px-5 py-3")}>
        <div className="flex items-start gap-4">
          {variant === "page" && (
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gray-100 text-base font-bold text-ink" aria-hidden>
              {inicialesDe(nombre)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold leading-tight text-brand-strong sm:text-2xl">{nombre}</h1>
            {datos && <p className="mt-0.5 text-[13px] text-ink-muted tabular-nums">{datos}</p>}
            {ultima && <p className="text-[13px] text-ink-muted">{ultima.charAt(0).toUpperCase() + ultima.slice(1)}</p>}
          </div>
          {variant === "modal" && onClose && <BotonCerrar onClick={onClose} />}
        </div>

        {/* Lo clínicamente crítico, visible sin abrir nada */}
        {record && record.alerts.length > 0 && (
          <div role="note" aria-label="Alertas clínicas" className="mt-4 flex flex-wrap items-start gap-x-3 gap-y-2 rounded-control border border-danger/25 bg-danger-soft px-3.5 py-2.5">
            <span className="flex items-center gap-1.5 text-sm font-bold text-danger">
              <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden /> Alertas clínicas
            </span>
            <ul className="flex flex-wrap gap-x-3 gap-y-1">
              {/* Las alertas llegan con un "⚠️" adelante; el ícono ya lo dice. */}
              {record.alerts.map((a, i) => <li key={i} className="text-sm font-semibold text-ink">{a.replace(/^\s*\u26a0\ufe0f?\s*/u, "")}</li>)}
            </ul>
          </div>
        )}
      </header>

      {/* ── Pestañas ── */}
      <Tabs label="Secciones de la ficha" value={tab} onChange={(t) => setTab(t as Tab)}
        className={cx("shrink-0", variant === "page" ? "-mx-4 px-4 sm:mx-0 sm:px-0" : "px-3")}
        items={(Object.keys(TAB_LABELS) as Tab[]).map((t) => ({ id: t, label: TAB_LABELS[t] }))} />

      {/* ── Contenido ── */}
      <div className={variant === "modal" ? "flex-1 overflow-y-auto overscroll-contain bg-ground p-5" : ""}>
        {loading && !record && (
          <div className="flex flex-col gap-3" aria-hidden>
            <div className="h-40 rounded-card bg-gray-100" /><div className="h-24 rounded-card bg-gray-100" />
          </div>
        )}
        {error && (
          <div className="rounded-card border border-line bg-surface px-5 py-4 text-sm text-ink">
            <p className="font-semibold">No pudimos abrir la ficha: {error}.</p>
            <Button size="sm" variant="secondary" className="mt-3 max-sm:min-h-11" onClick={fetchRecord}>Reintentar</Button>
          </div>
        )}
        {record && !error && (
          <>
            {tab === "resumen"     && <ResumenTab record={record} patientId={patientId} onRefresh={fetchRecord} />}
            {tab === "anamnesis"   && <AnamnesisPanel patientId={patientId} />}
            {tab === "odontograma" && <OdontogramPanel patientId={patientId} />}
            {tab === "sesiones"    && <SesionesTab record={record} patientId={patientId} onCreated={fetchRecord} />}
            {tab === "imagenes"    && <ImagenesTab record={record} />}
            {tab === "consentimientos" && <ConsentsPanel patientId={patientId} />}
          </>
        )}
      </div>
    </div>
  );
}

export function PatientRecordModal({ patientId, onClose }: Props) {
  const ref = useDialogo(onClose);
  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center bg-ink/40 sm:items-center sm:p-2">
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Ficha clínica"
        className="h-dvh w-full overflow-hidden bg-surface shadow-2xl outline-none sm:h-[98vh] sm:w-[98vw] sm:max-w-[1600px] sm:rounded-card">
        <PatientRecordView patientId={patientId} variant="modal" onClose={onClose} />
      </div>
    </div>
  );
}
