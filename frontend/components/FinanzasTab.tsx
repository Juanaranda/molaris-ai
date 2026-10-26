"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Card } from "@/components/ui";
import { fmtCLP } from "@/components/pacientes/formato";
import { cx } from "@/lib/cx";
import {
  coberturaDeMontos, getProduccion, moverMes, nombreDelMes, rangoDelMes, type Produccion,
} from "@/lib/finanzas";

/**
 * Finanzas (MOL-58): lo que produjo la clínica y cada profesional en el mes.
 * Es la base de las liquidaciones, que llegan cuando esté definido cómo paga
 * cada clínica (MOL-59).
 */
export function FinanzasTab() {
  const hoy = new Date();
  const [periodo, setPeriodo] = useState({ anio: hoy.getFullYear(), mes: hoy.getMonth() });
  const [datos, setDatos] = useState<Produccion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vigente = true;
    const { desde, hasta } = rangoDelMes(periodo.anio, periodo.mes);
    getProduccion(desde, hasta)
      .then((d) => { if (vigente) setDatos(d); })
      .catch((e) => { if (vigente) setError(e instanceof Error ? e.message : "Error"); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [periodo, intento]);

  const esteMes = periodo.anio === hoy.getFullYear() && periodo.mes === hoy.getMonth();
  // "Cargando" se marca al pedir otro mes, no dentro del efecto.
  const recargar = () => { setCargando(true); setError(""); };
  const mover = (delta: number) => { recargar(); setPeriodo((p) => moverMes(p.anio, p.mes, delta)); };
  const c = datos?.clinica;
  const nombreMes = nombreDelMes(periodo.anio, periodo.mes);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-brand-strong">Finanzas</h2>
          <p className="text-[13px] text-ink-muted">Lo que se atendió, cobró y pagó en el mes, en total y por profesional.</p>
        </div>
        <div className="flex items-center gap-1" role="group" aria-label="Mes">
          <Button variant="secondary" size="sm" onClick={() => mover(-1)} aria-label="Mes anterior">‹</Button>
          <span className="min-w-36 text-center text-sm font-bold text-ink tabular-nums" aria-live="polite">{nombreMes}</span>
          <Button variant="secondary" size="sm" onClick={() => mover(1)} aria-label="Mes siguiente" disabled={esteMes}>›</Button>
        </div>
      </div>

      {error ? (
        <Card>
          <p role="alert" className="text-sm text-danger">{error}</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => { recargar(); setIntento((n) => n + 1); }}>Reintentar</Button>
        </Card>
      ) : cargando && !datos ? (
        <div className="grid gap-3 sm:grid-cols-4" aria-busy>
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-card bg-gray-100" />)}
        </div>
      ) : c ? (
        <div className={cx("flex flex-col gap-5 transition-opacity", cargando && "opacity-60")}>
          {/* Los montos se registran a mano en cada cita, y las importadas de
              otro sistema vienen sin ellos: mostrar ceros como si fueran
              reales engañaría. Se dice cuánto falta. */}
          {c.sinMonto > 0 && (
            <div className="rounded-card border border-warn/30 bg-warn-soft px-4 py-3 text-sm text-ink">
              <p className="font-semibold">
                {c.sinMonto === c.atendidas
                  ? `Ninguna de las ${c.atendidas} atenciones de ${nombreMes.toLowerCase()} tiene monto registrado.`
                  : `${c.sinMonto} de ${c.atendidas} atenciones de ${nombreMes.toLowerCase()} no tienen monto registrado (${coberturaDeMontos(c)} % con monto).`}
              </p>
              <p className="mt-0.5 text-[13px] text-ink-muted">
                Los totales incluyen solo las que tienen monto. Se registra en el detalle de cada cita, en la pestaña Pago.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Cifra etiqueta="Atenciones" valor={String(c.atendidas)} />
            <Cifra etiqueta="Cobrado" valor={fmtCLP(c.cobrado)} />
            <Cifra etiqueta="Pagado" valor={fmtCLP(c.pagado)}
              nota={c.otrosAbonos > 0 ? `Incluye ${fmtCLP(c.otrosAbonos)} en abonos sin atención del mes` : undefined} />
            <Cifra etiqueta="Por cobrar" valor={fmtCLP(c.porCobrar)} destacar={c.porCobrar > 0} />
          </div>

          <Card title="Por profesional" padded={false}>
            {datos!.profesionales.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-ink-muted">No hubo atenciones en {nombreMes.toLowerCase()}.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <caption className="sr-only">Producción por profesional en {nombreMes}</caption>
                  <thead>
                    <tr className="border-y border-line-soft text-left text-xs font-bold text-ink-muted">
                      <th scope="col" className="px-5 py-2">Profesional</th>
                      <th scope="col" className="px-3 py-2 text-right">Atenciones</th>
                      <th scope="col" className="px-3 py-2 text-right">Cobrado</th>
                      <th scope="col" className="px-3 py-2 text-right">Pagado</th>
                      <th scope="col" className="px-3 py-2 text-right">Por cobrar</th>
                      <th scope="col" className="px-5 py-2 text-right">Sin monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft">
                    {datos!.profesionales.map((p) => (
                      <tr key={p.id ?? p.nombre}>
                        <th scope="row" className="px-5 py-3 text-left font-semibold text-ink">
                          <span className="flex flex-wrap items-center gap-2">
                            {p.nombre}
                            {!p.activo && p.id === null && p.nombre !== "Sin profesional asignado" && <Badge>Ya no atiende</Badge>}
                          </span>
                        </th>
                        <td className="px-3 py-3 text-right tabular-nums">{p.atendidas}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{fmtCLP(p.cobrado)}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{fmtCLP(p.pagado)}</td>
                        <td className={cx("px-3 py-3 text-right tabular-nums", p.porCobrar > 0 && "font-semibold text-accent-ink")}>{fmtCLP(p.porCobrar)}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-ink-muted">{p.sinMonto}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      ) : null}
    </div>
  );
}

function Cifra({ etiqueta, valor, nota, destacar = false }: { etiqueta: string; valor: string; nota?: string; destacar?: boolean }) {
  return (
    <Card>
      <p className="text-[13px] text-ink-muted">{etiqueta}</p>
      <p className={cx("mt-1 text-2xl font-extrabold tabular-nums", destacar ? "text-accent-ink" : "text-brand-strong")}>{valor}</p>
      {nota && <p className="mt-1 text-xs text-ink-muted">{nota}</p>}
    </Card>
  );
}
