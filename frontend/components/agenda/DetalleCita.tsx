import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { Badge, Button, Field, Tabs } from "@/components/ui";
import { getToken } from "@/lib/auth";
import { cx } from "@/lib/cx";
import { peldanoDeUrgencia, restanteHasta } from "@/lib/plazos";
import { esperaConfirmacion } from "@/lib/solicitudes";
import { DentalQuoteTab } from "../DentalQuoteTab";
import { formatDate } from "./fechas";
import { MarcaEstado, TINTE, textoPago } from "./Marcas";
import type { Booking } from "./tipos";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/** Clases de un select o campo suelto: las mismas de components/ui/Field. */
export const CAMPO =
  "w-full min-h-11 rounded-control border border-line bg-surface px-3 text-base text-ink " +
  "focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand";
export const ETIQUETA = "text-sm font-semibold text-ink";

/**
 * Lo mínimo de un diálogo: Escape lo cierra y el foco entra al abrirlo
 * (si no, el teclado y el lector de pantalla quedan en la agenda de atrás).
 */
export function useDialogo(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const cerrar = useRef(onClose);
  useEffect(() => { cerrar.current = onClose; });
  useEffect(() => {
    ref.current?.focus();
    const tecla = (e: KeyboardEvent) => {
      // Si el Escape es para cerrar una lista desplegada (el buscador de
      // pacientes), se queda en eso y no cierra el diálogo entero.
      if (e.key !== "Escape" || (e.target as HTMLElement | null)?.getAttribute?.("aria-expanded") === "true") return;
      cerrar.current();
    };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, []);
  return ref;
}

export function BotonCerrar({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label="Cerrar"
      className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:bg-gray-100 hover:text-ink focus-visible:outline-2 focus-visible:outline-brand">
      <X className="h-5 w-5" aria-hidden />
    </button>
  );
}

/* ── Presupuesto rápido ─────────────────────────────────────────────── */
export function QuickQuoteModal({ patient, onClose }: {
  patient: { name: string; rut: string | null };
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-surface"
      style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-2">
        <div>
          <p className="text-[13px] text-ink-muted">Presupuesto rápido</p>
          <h2 className="text-base font-bold leading-tight text-brand-strong">{patient.name}</h2>
        </div>
        <BotonCerrar onClick={onClose} />
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <DentalQuoteTab patient={patient} />
      </div>
    </div>
  );
}

const PAY_STATUS: { id: string; label: string }[] = [
  { id: "pending", label: "Pendiente" },
  { id: "paid", label: "Pagado" },
  { id: "partial", label: "Parcial" },
  { id: "waived", label: "Bonificado" },
];

/* ── Detalle de una cita ────────────────────────────────────────────── */
export function BookingModal({ booking, onClose, onSave, onCancel, onNewQuote, onDecided }: {
  booking: Booking;
  onClose: () => void;
  onSave: (id: string, patch: {
    status: string; notes: string;
    paymentStatus: string; amountTotal: string; amountPaid: string; paymentMethod: string;
  }) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
  /** Se llama tras confirmar o rechazar, para refrescar la agenda. */
  onDecided: () => void;
  onNewQuote?: (patient: { name: string; rut: string | null }) => void;
}) {
  const [status, setStatus]             = useState(booking.status);
  const [notes, setNotes]               = useState(booking.notes ?? "");
  const [paymentStatus, setPayStatus]   = useState(booking.paymentStatus ?? "pending");
  const [amountTotal, setAmountTotal]   = useState(booking.amountTotal?.toString() ?? "");
  const [amountPaid, setAmountPaid]     = useState(booking.amountPaid?.toString() ?? "");
  const [paymentMethod, setPayMethod]   = useState(booking.paymentMethod ?? "cash");
  const [saving, setSaving]             = useState(false);
  const [tab, setTab]                   = useState<"info" | "payment">("info");
  const [decidiendo, setDecidiendo]     = useState(false);
  const [decisionError, setDecisionError] = useState("");
  const idEstado = useId(), idMetodo = useId(), idTitulo = useId();
  const dialogo = useDialogo(onClose);

  async function decidir(accion: "confirmar" | "rechazar") {
    setDecidiendo(true); setDecisionError("");
    try {
      const res = await fetch(`${API}/api/bookings/${booking.id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ accion }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.mensaje ?? d.error ?? "No pudimos registrar la decisión");
      // Se cierra y se recarga: el estado cambió y la grilla debe reflejarlo.
      onDecided();
    } catch (e) {
      setDecisionError(e instanceof Error ? e.message : "Error");
    } finally { setDecidiendo(false); }
  }

  async function save() {
    setSaving(true);
    try {
      await onSave(booking.id, { status, notes, paymentStatus, amountTotal, amountPaid, paymentMethod });
      onClose();
    } finally { setSaving(false); }
  }

  async function cancel() {
    if (!confirm("¿Cancelar esta cita?")) return;
    await onCancel(booking.id);
    onClose();
  }

  const ahora = new Date();
  const solicitud = esperaConfirmacion(booking);
  const queda = restanteHasta(booking.confirmDeadline);
  const pago = textoPago(booking.paymentStatus);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={dialogo} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={idTitulo}
        className="flex max-h-[92vh] outline-none w-full max-w-md flex-col overflow-hidden rounded-t-card bg-surface shadow-2xl sm:max-h-[90vh] sm:rounded-card">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 pt-4 pb-3">
          <div className="min-w-0">
            <p className="text-[13px] text-ink-muted">{booking.doctor}</p>
            <h2 id={idTitulo} className="text-lg font-bold text-brand-strong">{booking.patientName ?? "Paciente"}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 empty:hidden">
              <MarcaEstado b={booking} ahora={ahora} />
              {!solicitud && booking.status === "confirmed" && <Badge tone="ok">Confirmada</Badge>}
              {pago && <Badge>{pago}</Badge>}
            </div>
          </div>
          <BotonCerrar onClick={onClose} />
        </div>

        <div className="overflow-y-auto overscroll-contain">
          {/* Decisión pendiente: va arriba de todo porque es lo único que hay
              que hacer con esta cita. Lo demás es contexto para decidir. */}
          {solicitud && (
            <div className={cx("border-b border-line px-5 py-4", TINTE[peldanoDeUrgencia(booking.confirmDeadline, ahora) ?? 1])}>
              <p className="text-sm font-bold text-accent-ink">Esperando tu confirmación</p>
              <p className="mt-0.5 text-[13px] text-ink">
                La pidió un paciente por el asistente. La hora está reservada, pero no es una cita
                hasta que alguien decida
                {booking.confirmDeadline
                  ? `: se libera sola el ${new Date(booking.confirmDeadline).toLocaleString("es-CL",
                      { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: false })}.`
                  : "."}
              </p>
              {/* La fecha exacta sirve para agendarse; el plazo en horas es
                  el que dice si hay que responder ahora. */}
              {queda && (
                <p className="mt-1 text-[13px] font-bold text-accent-ink">
                  {queda.vencida ? "El plazo ya venció." : `Vence ${queda.texto}.`}
                </p>
              )}
              {decisionError && (
                <p role="alert" className="mt-2 rounded-lg bg-danger-soft px-3 py-2 text-[13px] font-semibold text-danger">{decisionError}</p>
              )}
              <div className="mt-3 flex gap-2">
                <Button className="flex-1" onClick={() => decidir("confirmar")} loading={decidiendo}>
                  {decidiendo ? "Confirmando…" : "Confirmar"}
                </Button>
                <Button variant="secondary" className="flex-1" onClick={() => decidir("rechazar")} disabled={decidiendo}>
                  No se puede
                </Button>
              </div>
            </div>
          )}

          <Tabs label="Detalle de la cita" value={tab} onChange={(t) => setTab(t as "info" | "payment")} className="px-3"
            items={[{ id: "info", label: "Detalle" }, { id: "payment", label: "Pago" }]} />

          <div className="flex flex-col gap-4 px-5 py-5">
            {tab === "info" ? (
              <>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
                  {[
                    ["Hora",     booking.time],
                    ["Fecha",    formatDate(booking.date)],
                    ["Box",      booking.box ? `Box ${booking.box}` : "—"],
                    // Solo se lista si la cita trae sede: en clínica de una sola
                    // sede la fila vacía sería ruido.
                    ...(booking.sede ? [["Sede", booking.sede]] : []),
                    ["RUT",      booking.patientRut ?? "—"],
                    ["Teléfono", booking.patientPhone ?? "—"],
                    ["Email",    booking.patientEmail ?? "—"],
                    ["Servicio", booking.service ?? "—"],
                  ].map(([label, val]) => (
                    <div key={label} className="min-w-0">
                      <dt className="text-[13px] text-ink-muted">{label}</dt>
                      <dd className="truncate text-sm font-semibold text-ink">{val}</dd>
                    </div>
                  ))}
                </dl>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor={idEstado} className={ETIQUETA}>Estado</label>
                  <select id={idEstado} value={status} onChange={(e) => setStatus(e.target.value)} className={CAMPO}>
                    <option value="confirmed">Confirmada</option>
                    <option value="pending">Pendiente</option>
                    <option value="cancelled">Cancelada</option>
                  </select>
                </div>

                <Field multiline label="Notas internas" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observaciones, indicaciones…" />
              </>
            ) : (
              <>
                <fieldset className="flex flex-col gap-1.5">
                  <legend className={cx(ETIQUETA, "mb-1.5")}>Estado del pago</legend>
                  <div className="grid grid-cols-4 gap-1.5">
                    {PAY_STATUS.map((s) => (
                      <button key={s.id} type="button" aria-pressed={paymentStatus === s.id} onClick={() => setPayStatus(s.id)}
                        className={cx(
                          "min-h-11 rounded-control border text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-brand",
                          paymentStatus === s.id ? "border-brand bg-brand-soft text-brand-ink" : "border-line text-ink-muted hover:border-brand",
                        )}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Monto cobrado (CLP)" type="number" min="0" step="1000" inputMode="numeric" value={amountTotal}
                    onChange={(e) => setAmountTotal(e.target.value)} placeholder="Ej: 50000" />
                  <Field label="Monto pagado (CLP)" type="number" min="0" step="1000" inputMode="numeric" value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)} placeholder="Ej: 50000" />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor={idMetodo} className={ETIQUETA}>Método de pago</label>
                  <select id={idMetodo} value={paymentMethod} onChange={(e) => setPayMethod(e.target.value)} className={CAMPO}>
                    <option value="cash">Efectivo</option>
                    <option value="transfer">Transferencia</option>
                    <option value="card">Tarjeta</option>
                    <option value="other">Otro</option>
                  </select>
                </div>

                {booking.paidAt && <p className="text-[13px] text-ink-muted">Pagado el {formatDate(booking.paidAt)}</p>}
              </>
            )}

            {onNewQuote && booking.patientName && (
              <Button variant="secondary" block
                onClick={() => { onClose(); onNewQuote({ name: booking.patientName!, rut: booking.patientRut }); }}>
                + Nuevo presupuesto para {booking.patientName.split(" ")[0]}
              </Button>
            )}

            <div className="flex gap-3 pt-1">
              <Button className="flex-1" onClick={save} loading={saving}>
                {saving ? "Guardando…" : "Guardar cambios"}
              </Button>
              {/* Cancelar no borra: la cita queda en la agenda, tachada. */}
              <Button variant="secondary" className="text-danger hover:border-danger hover:text-danger" onClick={cancel}>
                Cancelar cita
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
