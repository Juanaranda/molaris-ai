"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button, Dialogo } from "@/components/ui";
import { cx } from "@/lib/cx";
import { PORTADAS, esColorPropio, fondoPortada } from "@/lib/portada";

/**
 * Elegir el color de la portada de "Mi clínica": una de las predefinidas o un
 * color propio. Se ve el resultado antes de guardar.
 */
export function ElegirPortada({ actual, onGuardar, onClose }: {
  actual: string | undefined;
  onGuardar: (valor: string) => Promise<void>;
  onClose: () => void;
}) {
  const [valor, setValor] = useState(actual ?? "petroleo");
  const [propio, setPropio] = useState(esColorPropio(actual) ? actual : "#1A5C7A");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  async function guardar() {
    setGuardando(true); setError("");
    try { await onGuardar(valor); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar."); }
    finally { setGuardando(false); }
  }

  const elegido = (id: string) => valor === id;

  return (
    <Dialogo titulo="Color de la portada" subtitulo="Lo ve tu equipo en Mi clínica." onClose={onClose}>
      <div className="flex flex-col gap-5 p-5">
        <div aria-hidden className="h-20 rounded-control" style={{ background: fondoPortada(valor) }} />

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink">Colores</legend>
          <div role="radiogroup" aria-label="Colores de portada" className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {PORTADAS.map((p) => (
              <button key={p.id} type="button" role="radio" aria-checked={elegido(p.id)} onClick={() => setValor(p.id)}
                className={cx("flex flex-col items-center gap-1.5 rounded-control p-1.5 text-[13px] text-ink transition-colors hover:bg-ground",
                  "focus-visible:outline-2 focus-visible:outline-brand", elegido(p.id) && "bg-ground font-semibold")}>
                <span className="relative grid h-11 w-full place-items-center rounded-control" style={{ background: fondoPortada(p.id) }}>
                  {elegido(p.id) && <Check className="h-5 w-5 text-white" aria-hidden />}
                </span>
                {p.nombre}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="flex items-center gap-3">
          <label className={cx("relative flex min-h-11 cursor-pointer items-center gap-3 rounded-control border px-3 text-sm font-semibold text-ink",
            esColorPropio(valor) ? "border-brand bg-ground" : "border-line hover:bg-ground")}>
            <span className="h-6 w-6 rounded-full border border-line" style={{ backgroundColor: propio }} aria-hidden />
            Otro color
            <input type="color" value={propio}
              onChange={(e) => { setPropio(e.target.value.toUpperCase()); setValor(e.target.value.toUpperCase()); }}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
          </label>
          {esColorPropio(valor) && <span className="font-mono text-[13px] text-ink-muted">{valor}</span>}
        </div>

        {error && <p role="alert" className="text-[13px] font-semibold text-danger">{error}</p>}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button loading={guardando} onClick={guardar}>{guardando ? "Guardando…" : "Guardar"}</Button>
        </div>
      </div>
    </Dialogo>
  );
}
