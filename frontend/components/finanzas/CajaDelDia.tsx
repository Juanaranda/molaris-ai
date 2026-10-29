"use client";

import { useEffect, useId, useState } from "react";
import { Badge, Button, Card, CLASE_CAMPO, CLASE_ETIQUETA } from "@/components/ui";
import { fmtCLP } from "@/components/pacientes/formato";
import { NombrePaciente } from "@/components/pacientes/AbrirPaciente";
import { cx } from "@/lib/cx";
import {
  MEDIOS, NOMBRE_MEDIO, NOMBRE_ORIGEN, abrirPdfBoleta, boletaEmitida, cerrarCaja, diaLocal, emitirBoleta, getCaja,
  moverDia, nombreDelDia, textoDiferencia, type Caja, type MovimientoCaja,
} from "@/lib/finanzas";

const hora = (iso: string) => new Date(iso).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false });

/**
 * Caja del día (MOL-58): lo que entró, por medio de pago y quién lo
 * registró, y el cierre con el efectivo contado. El cierre no se edita.
 * Cada pago puede llevar su boleta electrónica (MOL-63).
 */
export function CajaDelDia() {
  const hoy = diaLocal();
  const [dia, setDia] = useState(hoy);
  const [caja, setCaja] = useState<Caja | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vigente = true;
    getCaja(dia)
      .then((c) => { if (vigente) setCaja(c); })
      .catch((e) => { if (vigente) setError(e instanceof Error ? e.message : "Error"); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [dia, intento]);

  // "Cargando" se marca al pedir otro día, no dentro del efecto.
  const ir = (nuevo: string) => { setCargando(true); setError(""); setDia(nuevo); };
  const recargar = () => { setCargando(true); setError(""); setIntento((n) => n + 1); };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-ink-muted">Lo que entró en el día, por medio de pago, y su cierre.</p>
        <div className="flex items-center gap-1" role="group" aria-label="Día">
          <Button variant="secondary" size="sm" onClick={() => ir(moverDia(dia, -1))} aria-label="Día anterior">‹</Button>
          <span className="min-w-48 text-center text-sm font-bold text-ink" aria-live="polite">
            {dia === hoy ? `Hoy, ${nombreDelDia(dia).toLowerCase()}` : nombreDelDia(dia)}
          </span>
          <Button variant="secondary" size="sm" onClick={() => ir(moverDia(dia, 1))} aria-label="Día siguiente" disabled={dia >= hoy}>›</Button>
        </div>
      </div>

      {error ? (
        <Card>
          <p role="alert" className="text-sm text-danger">{error}</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={recargar}>Reintentar</Button>
        </Card>
      ) : !caja ? (
        <div className="h-40 animate-pulse rounded-card bg-gray-100" aria-busy />
      ) : (
        <div className={cx("flex flex-col gap-5 transition-opacity", cargando && "opacity-60")}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {MEDIOS.map((m) => (
              <Card key={m}>
                <p className="text-[13px] text-ink-muted">{NOMBRE_MEDIO[m]}</p>
                <p className={cx("mt-1 text-xl font-extrabold tabular-nums", caja.resumen.porMedio[m] ? "text-brand-strong" : "text-ink-muted")}>
                  {fmtCLP(caja.resumen.porMedio[m])}
                </p>
              </Card>
            ))}
            <div className="rounded-card border border-brand/30 bg-brand-soft p-5">
              <p className="text-[13px] text-brand-ink">Total del día</p>
              <p className="mt-1 text-xl font-extrabold tabular-nums text-brand-strong">{fmtCLP(caja.resumen.total)}</p>
            </div>
          </div>

          <Card title={`Movimientos (${caja.resumen.cantidad})`} padded={false}
            action={caja.boletaActiva && caja.sinBoleta > 0
              ? <Badge tone="warn">{caja.sinBoleta === 1 ? "1 pago sin boleta" : `${caja.sinBoleta} pagos sin boleta`}</Badge>
              : undefined}>
            {caja.movimientos.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-ink-muted">No se registraron pagos este día.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <caption className="sr-only">Pagos registrados el {nombreDelDia(dia)}</caption>
                  <thead>
                    <tr className="border-y border-line-soft text-left text-xs font-bold text-ink-muted">
                      <th scope="col" className="px-5 py-2">Hora</th>
                      <th scope="col" className="px-3 py-2">Paciente</th>
                      <th scope="col" className="px-3 py-2">Concepto</th>
                      <th scope="col" className="px-3 py-2">Medio</th>
                      <th scope="col" className="px-3 py-2 text-right">Monto</th>
                      <th scope="col" className="px-3 py-2">Registró</th>
                      <th scope="col" className="px-5 py-2">Boleta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft">
                    {caja.movimientos.map((m) => (
                      <tr key={m.id}>
                        <td className="px-5 py-3 tabular-nums text-ink-muted">{hora(m.fecha)}</td>
                        <td className="px-3 py-3 font-semibold text-ink">
                          {m.patientName || m.patientRut
                            ? <NombrePaciente paciente={{ name: m.patientName, rut: m.patientRut }} />
                            : "—"}
                          {m.doctor && <span className="block text-xs font-normal text-ink-muted">{m.doctor}</span>}
                        </td>
                        <td className="px-3 py-3 text-ink">{NOMBRE_ORIGEN[m.origen] ?? m.origen}</td>
                        <td className="px-3 py-3 text-ink">{NOMBRE_MEDIO[m.medio] ?? m.medio}</td>
                        <td className={cx("px-3 py-3 text-right font-semibold tabular-nums", m.monto < 0 ? "text-danger" : "text-ink")}>
                          {m.monto < 0 ? `−${fmtCLP(-m.monto)}` : fmtCLP(m.monto)}
                          {m.monto < 0 && <span className="block text-xs font-normal">Corrección</span>}
                        </td>
                        <td className="px-3 py-3 text-ink-muted">{m.registradoPor ?? "Automático"}</td>
                        <td className="px-5 py-3"><CeldaBoleta mov={m} activa={caja.boletaActiva} onEmitida={recargar} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!caja.boletaActiva && caja.movimientos.length > 0 && (
              <p className="border-t border-line-soft px-5 py-3 text-[13px] text-ink-muted">
                Para emitir la boleta electrónica de cada pago, conecta OpenFactura en Configuración → Integraciones.
              </p>
            )}
          </Card>

          {caja.cierre ? <CierreHecho caja={caja} /> : <CerrarCaja caja={caja} onCerrada={recargar} />}
        </div>
      )}
    </div>
  );
}

function CierreHecho({ caja }: { caja: Caja }) {
  const c = caja.cierre!;
  const despues = caja.despuesDelCierre;
  return (
    <Card title="Caja cerrada" action={<Badge tone={c.diferencia === 0 ? "ok" : "warn"}>{textoDiferencia(c.diferencia, fmtCLP)}</Badge>}>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        <Dato etiqueta="Efectivo esperado" valor={fmtCLP(c.esperado.cash)} />
        <Dato etiqueta="Efectivo contado" valor={fmtCLP(c.efectivoContado)} />
        <Dato etiqueta="Total del cierre" valor={fmtCLP(c.esperado.total)} />
        <Dato etiqueta="Cerró" valor={`${c.cerradoPor ?? "—"} · ${hora(c.cerradoEn)}`} />
        {c.pagosSinBoleta !== null && <Dato etiqueta="Pagos sin boleta al cerrar" valor={String(c.pagosSinBoleta)} />}
      </dl>
      {c.nota && <p className="mt-3 text-sm text-ink"><span className="text-ink-muted">Nota: </span>{c.nota}</p>}
      {despues && despues.cantidad > 0 && (
        <p className="mt-3 rounded-control bg-warn-soft px-3 py-2 text-[13px] text-ink">
          Después del cierre {despues.cantidad === 1 ? "se registró 1 pago" : `se registraron ${despues.cantidad} pagos`} por {fmtCLP(despues.total)}: no {despues.cantidad === 1 ? "está" : "están"} en el cierre.
        </p>
      )}
    </Card>
  );
}

function CerrarCaja({ caja, onCerrada }: { caja: Caja; onCerrada: () => void }) {
  const [contado, setContado] = useState("");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const idContado = useId(), idNota = useId();
  const esperado = caja.resumen.porMedio.cash;
  const valor = contado.trim() === "" ? null : Number(contado);
  const valido = valor !== null && isFinite(valor) && valor >= 0;

  async function cerrar(e: React.FormEvent) {
    e.preventDefault();
    if (!valido) { setError("Escribe el efectivo que hay en la caja (0 si no hay)."); return; }
    setGuardando(true); setError("");
    try { await cerrarCaja(caja.dia, valor!, nota); onCerrada(); }
    catch (err) { setError(err instanceof Error ? err.message : "No pudimos cerrar la caja"); setGuardando(false); }
  }

  return (
    <Card title="Cerrar la caja">
      <form onSubmit={cerrar} className="flex flex-col gap-4">
        <p className="text-sm text-ink-muted">
          Cuenta el efectivo y anótalo. El cierre guarda lo que el sistema esperaba, lo contado y la diferencia, y no se puede editar.
        </p>
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <dl><Dato etiqueta="Efectivo esperado" valor={fmtCLP(esperado)} /></dl>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={idContado} className={CLASE_ETIQUETA}>Efectivo contado (CLP)</label>
            <input id={idContado} type="number" inputMode="numeric" min="0" step="1" value={contado}
              onChange={(e) => setContado(e.target.value)} className={CLASE_CAMPO} placeholder="0"
              aria-describedby={`${idContado}-dif`} />
          </div>
          <p id={`${idContado}-dif`} className={cx("pb-3 text-sm font-semibold", !valido ? "text-ink-muted" : valor === esperado ? "text-ok" : "text-accent-ink")}>
            {valido ? textoDiferencia(valor! - esperado, fmtCLP) : " "}
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={idNota} className={CLASE_ETIQUETA}>Nota <span className="font-normal text-ink-muted">(opcional)</span></label>
          <input id={idNota} value={nota} onChange={(e) => setNota(e.target.value.slice(0, 500))} className={CLASE_CAMPO}
            placeholder="Ej: faltan $2.000 de vuelto" />
        </div>
        {caja.boletaActiva && caja.sinBoleta > 0 && (
          <p className="rounded-control bg-warn-soft px-3 py-2 text-[13px] text-ink">
            {caja.sinBoleta === 1 ? "Queda 1 pago sin boleta" : `Quedan ${caja.sinBoleta} pagos sin boleta`}. Puedes cerrar igual: queda anotado en el cierre.
          </p>
        )}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div>
          <Button type="submit" loading={guardando} disabled={!valido}>
            {guardando ? "Cerrando…" : `Cerrar caja del ${nombreDelDia(caja.dia).toLowerCase()}`}
          </Button>
        </div>
      </form>
    </Card>
  );
}

/**
 * La boleta de un pago: el folio (abre el PDF), o el botón para emitirla.
 * Las correcciones (montos negativos) no llevan boleta.
 */
function CeldaBoleta({ mov, activa, onEmitida }: { mov: MovimientoCaja; activa: boolean; onEmitida: () => void }) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const b = mov.boleta;

  async function emitir() {
    setOcupado(true); setError("");
    try { await emitirBoleta(mov.id); onEmitida(); }
    catch (e) { setError(e instanceof Error ? e.message : "No pudimos emitir la boleta"); }
    finally { setOcupado(false); }
  }
  async function abrir() {
    setError("");
    try { await abrirPdfBoleta(b!.id); }
    catch (e) { setError(e instanceof Error ? e.message : "No pudimos abrir el PDF"); }
  }

  if (mov.monto <= 0) return <span className="text-ink-muted">—</span>;
  const fallo = error || (b?.status === "error" ? b.errorMessage ?? "No se pudo emitir" : "");
  return (
    <div className="flex max-w-56 flex-col items-start gap-1">
      {boletaEmitida(b) ? (
        <button type="button" onClick={abrir}
          className="font-semibold tabular-nums text-brand-strong underline-offset-2 hover:underline"
          aria-label={`Abrir el PDF de la boleta${b!.folio ? ` folio ${b!.folio}` : ""}`}>
          {b!.folio ? `N° ${b!.folio}` : "Emitida"}
        </button>
      ) : b?.status === "draft" && !ocupado ? (
        <span className="text-ink-muted">Emitiendo…</span>
      ) : activa ? (
        <Button variant="secondary" size="sm" loading={ocupado} onClick={emitir}>
          {ocupado ? "Emitiendo…" : b?.status === "error" ? "Reintentar" : "Emitir"}
        </Button>
      ) : (
        <span className="text-ink-muted">—</span>
      )}
      {fallo && <p role="alert" className="text-xs text-danger">{fallo}</p>}
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <dt className="text-[13px] text-ink-muted">{etiqueta}</dt>
      <dd className="text-base font-bold text-ink tabular-nums">{valor}</dd>
    </div>
  );
}
