"use client";

import { useState, useEffect, useCallback } from "react";
import { getToken } from "@/lib/auth";
import { createBookingPaymentLink } from "@/lib/payments";
import { emitBoletaForBooking } from "@/lib/boletas";
import { WaitlistManager } from "@/components/WaitlistManager";
import { LabOrdersManager } from "@/components/LabOrdersManager";
import { CircleCheck, CreditCard, Receipt, Smile, X } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type BookingStatus = "all" | "pending" | "confirmed" | "cancelled";

interface BookingRow {
  id: string;
  patientName: string | null;
  service: string | null;
  date: string;
  time: string;
  doctor: string;
  box: string | null;
  status: string;
  createdAt: string;
  patientUser: {
    identity: {
      firstName: string;
      lastName: string;
      phone: string | null;
      email: string | null;
    };
  } | null;
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pending:   { label: "Pendiente",   cls: "bg-yellow-50 text-yellow-700 border border-yellow-100" },
  confirmed: { label: "Confirmada",  cls: "bg-green-50 text-green-700 border border-green-100" },
  cancelled: { label: "Cancelada",   cls: "bg-red-50 text-red-500 border border-red-100" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABELS[status] ?? { label: status, cls: "bg-gray-50 text-gray-500 border border-gray-100" };
  return <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap ${s.cls}`}>{s.label}</span>;
}

function patientDisplayName(b: BookingRow): string {
  if (b.patientUser?.identity) {
    const { firstName, lastName } = b.patientUser.identity;
    return `${firstName} ${lastName}`.trim();
  }
  return b.patientName ?? "—";
}

interface Props {
  clinicId: string;
}

export function BookingsTab({ clinicId }: Props) {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<BookingStatus>("all");
  const [view, setView] = useState<"upcoming" | "past">("upcoming");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [paymentModal, setPaymentModal] = useState<{ booking: BookingRow } | null>(null);
  const [boletaModal,  setBoletaModal]  = useState<{ booking: BookingRow } | null>(null);
  const [showWaitlist, setShowWaitlist] = useState(false);
  const [showLab,      setShowLab]      = useState(false);

  const fetchBookings = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`${API}/api/clinics/${clinicId}/bookings?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
        signal,
      });
      if (!res.ok) throw new Error("Error cargando citas");
      const data = await res.json();
      setBookings(data.bookings);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [clinicId, statusFilter]);

  useEffect(() => {
    const controller = new AbortController();
    fetchBookings(controller.signal);
    return () => controller.abort();
  }, [fetchBookings]);

  async function updateStatus(bookingId: string, status: string) {
    setUpdatingId(bookingId);
    try {
      const res = await fetch(`${API}/api/clinics/${clinicId}/bookings/${bookingId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Error actualizando");
      setBookings((prev) => prev.map((b) => b.id === bookingId ? { ...b, status } : b));
    } catch {
      setError("No se pudo actualizar el estado");
    } finally {
      setUpdatingId(null);
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const filtered = bookings.filter((b) => {
    const [y, m, d] = String(b.date).slice(0, 10).split("-").map(Number);
    const bookingDate = new Date(y, m - 1, d);
    return view === "upcoming" ? bookingDate >= today : bookingDate < today;
  });

  const FILTER_TABS: { key: BookingStatus; label: string }[] = [
    { key: "all",       label: "Todas" },
    { key: "pending",   label: "Pendientes" },
    { key: "confirmed", label: "Confirmadas" },
    { key: "cancelled", label: "Canceladas" },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar superior */}
      <div className="flex items-center justify-end gap-2">
        <button onClick={() => setShowLab(true)}
          className="text-xs font-bold px-3 py-1.5 rounded-xl border border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100 transition flex items-center gap-1.5"
          title="Órdenes de laboratorio">
          <Smile className="w-4 h-4 inline-block align-[-3px]" aria-hidden /> Laboratorio
        </button>
        <button onClick={() => setShowWaitlist(true)}
          className="text-xs font-bold px-3 py-1.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 transition flex items-center gap-1.5"
          title="Pacientes esperando un cupo">
          ⏳ Lista de espera
        </button>
      </div>

      {/* Controles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Próximas / Pasadas */}
        <div className="flex rounded-xl overflow-hidden border border-gray-200 w-fit">
          {(["upcoming", "past"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                view === v ? "bg-gray-900 text-white" : "bg-white text-gray-500 hover:text-gray-700"
              }`}
            >
              {v === "upcoming" ? "Próximas" : "Pasadas"}
            </button>
          ))}
        </div>

        {/* Filtro estado */}
        <div className="flex gap-1.5 flex-wrap">
          {FILTER_TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                statusFilter === key
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2">{error}</p>
      )}

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-14 text-center">
            <p className="text-sm text-gray-400">
              {view === "upcoming" ? "No hay citas próximas" : "No hay citas pasadas"}
              {statusFilter !== "all" ? ` con estado "${STATUS_LABELS[statusFilter]?.label}"` : ""}.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-gray-100">
                  {["Fecha", "Hora", "Paciente", "Doctor/a", "Servicio", "Estado", "Acciones"].map((h) => (
                    <th key={h} className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3 first:pl-6 last:pr-6">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((b) => {
                  const [dy, dm, dd] = String(b.date).slice(0, 10).split("-").map(Number);
                  const dateStr = new Date(dy, dm - 1, dd).toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" });
                  const name = patientDisplayName(b);
                  const phone = b.patientUser?.identity?.phone;
                  return (
                    <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 pl-6 whitespace-nowrap text-gray-700 font-medium">{dateStr}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700">{b.time}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{name}</p>
                        {phone && <p className="text-xs text-gray-400">{phone}</p>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{b.doctor}</td>
                      <td className="px-4 py-3 text-gray-500 max-w-[140px] truncate">{b.service ?? "—"}</td>
                      <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                      <td className="px-4 py-3 pr-6">
                        {b.status === "pending" && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => updateStatus(b.id, "confirmed")}
                              disabled={updatingId === b.id}
                              className="text-xs font-semibold text-green-700 bg-green-50 border border-green-100 px-2.5 py-1 rounded-full hover:bg-green-100 disabled:opacity-40 transition-colors"
                            >
                              Confirmar
                            </button>
                            <button
                              onClick={() => updateStatus(b.id, "cancelled")}
                              disabled={updatingId === b.id}
                              className="text-xs font-semibold text-red-500 bg-red-50 border border-red-100 px-2.5 py-1 rounded-full hover:bg-red-100 disabled:opacity-40 transition-colors"
                            >
                              Cancelar
                            </button>
                          </div>
                        )}
                        {b.status === "confirmed" && (
                          <div className="flex gap-2 flex-wrap">
                            <button
                              onClick={() => setPaymentModal({ booking: b })}
                              className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-full hover:bg-blue-100 transition-colors"
                              title="Generar link de pago Mercado Pago"
                            >
                              <CreditCard className="w-4 h-4 inline-block align-[-3px]" aria-hidden /> Cobrar
                            </button>
                            <button
                              onClick={() => setBoletaModal({ booking: b })}
                              className="text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-100 px-2.5 py-1 rounded-full hover:bg-violet-100 transition-colors"
                              title="Emitir boleta electrónica SII"
                            >
                              <Receipt className="w-4 h-4 inline-block align-[-3px]" aria-hidden /> Boleta
                            </button>
                            <button
                              onClick={() => updateStatus(b.id, "cancelled")}
                              disabled={updatingId === b.id}
                              className="text-xs font-semibold text-gray-500 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-full hover:bg-gray-100 disabled:opacity-40 transition-colors"
                            >
                              Cancelar
                            </button>
                          </div>
                        )}
                        {b.status === "cancelled" && (
                          <button
                            onClick={() => updateStatus(b.id, "pending")}
                            disabled={updatingId === b.id}
                            className="text-xs font-semibold text-yellow-700 bg-yellow-50 border border-yellow-100 px-2.5 py-1 rounded-full hover:bg-yellow-100 disabled:opacity-40 transition-colors"
                          >
                            Reactivar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Contador */}
      {!loading && (
        <p className="text-xs text-gray-400 text-right">
          {filtered.length} cita{filtered.length !== 1 ? "s" : ""}
        </p>
      )}

      {paymentModal && (
        <PaymentLinkModal
          booking={paymentModal.booking}
          onClose={() => setPaymentModal(null)}
        />
      )}

      {boletaModal && (
        <BoletaModal
          booking={boletaModal.booking}
          onClose={() => setBoletaModal(null)}
        />
      )}

      {showWaitlist && (
        <WaitlistManager clinicId={clinicId} onClose={() => setShowWaitlist(false)} />
      )}

      {showLab && (
        <LabOrdersManager clinicId={clinicId} onClose={() => setShowLab(false)} />
      )}
    </div>
  );
}

/* ─── Modal: generar link de pago Mercado Pago ─────────────────────────────── */
interface PaymentLinkModalProps {
  booking: BookingRow;
  onClose: () => void;
}

function PaymentLinkModal({ booking, onClose }: PaymentLinkModalProps) {
  const [amount,    setAmount]    = useState<string>("");
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState("");
  const [link,      setLink]      = useState<string | null>(null);
  const [copied,    setCopied]    = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = Math.round(Number(amount));
    if (!Number.isFinite(value) || value <= 0) {
      setError("Monto inválido");
      return;
    }
    setSaving(true); setError("");
    try {
      const result = await createBookingPaymentLink(booking.id, { amount: value });
      setLink(result.initPoint);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error generando link");
    } finally { setSaving(false); }
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }

  function whatsappLink() {
    const phone = booking.patientUser?.identity.phone?.replace(/\D/g, "");
    if (!phone || !link) return null;
    const msg = `Hola${booking.patientUser ? " " + booking.patientUser.identity.firstName : ""}, este es tu link de pago: ${link}`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  }

  const wa = whatsappLink();
  const name = patientDisplayName(booking);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-800">Generar link de pago</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 text-lg leading-none"><X className="w-4 h-4" aria-hidden /></button>
        </div>

        {!link ? (
          <form onSubmit={submit} className="p-5 flex flex-col gap-4">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500">Paciente</p>
              <p className="text-sm font-bold text-gray-800">{name}</p>
              <p className="text-[11px] text-gray-400 mt-1">{booking.service ?? "—"} · {booking.doctor}</p>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Monto (CLP)</label>
              <input autoFocus type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)}
                placeholder="Ej: 35000"
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1A5C7A]/30 focus:border-[#1A5C7A]" />
              <p className="text-[10px] text-gray-400 mt-1">Mercado Pago aceptará tarjetas, transferencia y otros métodos disponibles.</p>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm font-bold hover:border-gray-300 transition">
                Cancelar
              </button>
              <button type="submit" disabled={saving || !amount}
                className="flex-1 py-2.5 rounded-xl bg-[#1A5C7A] text-white text-sm font-bold hover:bg-[#0e4560] transition disabled:opacity-50">
                {saving ? "Generando…" : "Generar link"}
              </button>
            </div>
          </form>
        ) : (
          <div className="p-5 flex flex-col gap-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-800">
              <CircleCheck className="w-4 h-4 inline-block align-[-3px]" aria-hidden /> Link generado. Compártelo con el paciente.
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex flex-col gap-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Link de pago</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-[11px] font-mono bg-white px-3 py-2 rounded-lg border border-amber-200 break-all">{link}</code>
              </div>
              <div className="flex gap-2">
                <button onClick={copy}
                  className="flex-1 text-xs font-bold px-3 py-2 rounded-lg bg-amber-700 text-white hover:bg-amber-800 transition">
                  {copied ? "Copiado" : "Copiar"}
                </button>
                {wa && (
                  <a href={wa} target="_blank" rel="noopener noreferrer"
                    className="flex-1 text-center text-xs font-bold px-3 py-2 rounded-lg bg-[#25D366] text-white hover:opacity-90 transition">
                    Enviar por WhatsApp
                  </a>
                )}
              </div>
            </div>
            <button onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-[#1A5C7A] text-white text-sm font-bold hover:bg-[#0e4560] transition">
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Modal: emitir boleta electrónica SII ─────────────────────────────────── */
interface BoletaModalProps {
  booking: BookingRow;
  onClose: () => void;
}

function BoletaModal({ booking, onClose }: BoletaModalProps) {
  const [amount, setAmount]       = useState<string>("");
  const [rut,    setRut]          = useState<string>("");
  const [desc,   setDesc]         = useState<string>(booking.service ?? "Atención dental");
  const [saving, setSaving]       = useState(false);
  const [error,  setError]        = useState("");
  const [result, setResult]       = useState<{ folio: number | null; pdfUrl: string | null; totalAmount: number } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = Math.round(Number(amount));
    if (!Number.isFinite(value) || value <= 0) {
      setError("Monto inválido");
      return;
    }
    setSaving(true); setError("");
    try {
      const boleta = await emitBoletaForBooking(booking.id, {
        amount:      value,
        rutReceptor: rut.trim() || undefined,
        description: desc.trim() || undefined,
      });
      setResult({
        folio:       boleta.folio,
        pdfUrl:      boleta.pdfUrl,
        totalAmount: boleta.totalAmount,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error emitiendo boleta");
    } finally { setSaving(false); }
  }

  const name = patientDisplayName(booking);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-800">Emitir boleta electrónica</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 text-lg leading-none"><X className="w-4 h-4" aria-hidden /></button>
        </div>

        {!result ? (
          <form onSubmit={submit} className="p-5 flex flex-col gap-4">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500">Paciente</p>
              <p className="text-sm font-bold text-gray-800">{name}</p>
              <p className="text-[11px] text-gray-400 mt-1">{booking.service ?? "—"} · {booking.doctor}</p>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Descripción del servicio</label>
              <input value={desc} onChange={(e) => setDesc(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1A5C7A]/30 focus:border-[#1A5C7A]" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Monto total (CLP)</label>
              <input autoFocus type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)}
                placeholder="Ej: 35000"
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1A5C7A]/30 focus:border-[#1A5C7A]" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">RUT receptor (opcional)</label>
              <input value={rut} onChange={(e) => setRut(e.target.value)}
                placeholder="11.111.111-1 — vacío = boleta consumidor final"
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1A5C7A]/30 focus:border-[#1A5C7A]" />
            </div>
            {error && <p className="text-xs text-red-500 whitespace-pre-wrap">{error}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm font-bold hover:border-gray-300 transition">
                Cancelar
              </button>
              <button type="submit" disabled={saving || !amount}
                className="flex-1 py-2.5 rounded-xl bg-violet-700 text-white text-sm font-bold hover:bg-violet-800 transition disabled:opacity-50">
                {saving ? "Emitiendo…" : "Emitir boleta"}
              </button>
            </div>
          </form>
        ) : (
          <div className="p-5 flex flex-col gap-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-800">
              <CircleCheck className="w-4 h-4 inline-block align-[-3px]" aria-hidden /> Boleta emitida correctamente {result.folio ? `(folio #${result.folio})` : ""}
            </div>
            <div className="bg-gray-50 rounded-xl p-3 grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-[10px] text-gray-400">Folio</p><p className="font-bold text-gray-800">{result.folio ?? "—"}</p></div>
              <div><p className="text-[10px] text-gray-400">Total</p><p className="font-bold text-gray-800">${result.totalAmount.toLocaleString("es-CL")}</p></div>
            </div>
            {result.pdfUrl && (
              <a href={result.pdfUrl} target="_blank" rel="noopener noreferrer"
                className="w-full text-center py-2.5 rounded-xl bg-violet-700 text-white text-sm font-bold hover:bg-violet-800 transition">
                Descargar PDF
              </a>
            )}
            <button onClick={onClose}
              className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm font-bold hover:border-gray-300 transition">
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
