"use client";

import { useId, type ReactNode } from "react";
import { Badge, Button } from "@/components/ui";
import { cx } from "@/lib/cx";

/**
 * Lo que repiten las secciones de configuración: el encabezado con su estado
 * (prendido o apagado se ve sin abrir nada), los botones Editar / Cancelar /
 * Guardar y el aviso de "Guardado" o del error.
 */
export function Seccion({
  id, titulo, descripcion, estado, edicion, acciones, mensaje, mensajeOk, children,
}: {
  /** Ancla para el índice de la página. */
  id: string;
  titulo: string;
  descripcion: ReactNode;
  /** Prendido o apagado; sin esto no se muestra la etiqueta. */
  estado?: { activo: boolean; si?: string; no?: string };
  /** Si viene, la sección se edita con Editar → Guardar. */
  edicion?: {
    puede: boolean; editando: boolean; guardando: boolean;
    onEditar: () => void; onCancelar: () => void; onGuardar: () => void;
  };
  /** Botones propios a la derecha del título (en vez de, o además de, Editar). */
  acciones?: ReactNode;
  mensaje?: string;
  /** Si el mensaje es una buena noticia; por defecto, solo "Guardado". */
  mensajeOk?: boolean;
  children: ReactNode;
}) {
  const idTitulo = useId();
  const ok = mensajeOk ?? mensaje === "Guardado";
  return (
    <section id={id} aria-labelledby={idTitulo} className="scroll-mt-24 rounded-card border border-line bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        {/* basis-48: con poco ancho los botones bajan a su propia línea en
            vez de dejar el título en una columna de una palabra. */}
        <div className="min-w-0 flex-1 basis-48">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id={idTitulo} className="text-base font-bold text-brand-strong">{titulo}</h3>
            {estado && (
              <Badge tone={estado.activo ? "ok" : "neutral"}>
                {estado.activo ? (estado.si ?? "Activo") : (estado.no ?? "Apagado")}
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-[13px] text-ink-muted">{descripcion}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {acciones}
          {edicion?.puede && !edicion.editando && (
            <Button size="sm" variant="secondary" className="max-sm:min-h-11" onClick={edicion.onEditar}>Editar</Button>
          )}
          {edicion?.puede && edicion.editando && (
            <>
              <Button size="sm" variant="ghost" className="max-sm:min-h-11" onClick={edicion.onCancelar}>Cancelar</Button>
              <Button size="sm" className="max-sm:min-h-11" loading={edicion.guardando} onClick={edicion.onGuardar}>
                {edicion.guardando ? "Guardando…" : "Guardar"}
              </Button>
            </>
          )}
        </div>
      </div>
      <p role="status" className={cx("text-[13px] font-semibold", mensaje ? "mt-3" : "sr-only", ok ? "text-ok" : "text-danger")}>
        {mensaje}
      </p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Un dato en modo lectura: etiqueta arriba, valor abajo. */
export function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[13px] text-ink-muted">{etiqueta}</dt>
      <dd className="text-sm font-semibold text-ink">{children}</dd>
    </div>
  );
}

/**
 * Cómo le llega el mensaje al paciente. Los colores imitan a WhatsApp a
 * propósito: es una vista previa de ese canal, no parte de la paleta.
 */
export function VistaPreviaWhatsApp({ mensaje, clinica, pie }: { mensaje: string; clinica: string; pie?: string }) {
  // replace y no replaceAll: el servidor cambia solo la primera aparición, y
  // la vista previa tiene que mostrar lo mismo que recibe el paciente.
  const texto = mensaje.replace("{nombre}", "María").replace("{clinica}", clinica);
  return (
    <figure className="flex flex-col gap-1.5">
      <figcaption className="text-sm font-semibold text-ink">Así le llega al paciente</figcaption>
      <div className="rounded-control bg-[#ECE5DD] p-3">
        <div className="ml-auto max-w-[85%] rounded-xl rounded-tr-sm bg-[#DCF8C6] px-3.5 py-2 shadow-sm">
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-[#111B21]">{texto || "…"}</p>
          {pie && <p className="mt-1 text-right text-[11px] text-[#667781]">{pie}</p>}
        </div>
      </div>
    </figure>
  );
}

/** Ayuda de los mensajes con variables. */
export const AYUDA_VARIABLES = "Escribe {nombre} y {clinica}: se cambian solos por el nombre del paciente y el de tu clínica.";
