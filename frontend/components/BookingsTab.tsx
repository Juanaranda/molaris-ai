"use client";

import { useState, useEffect, useCallback } from "react";
import { getToken } from "@/lib/auth";

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

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`${API}/api/clinics/${clinicId}/bookings?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error("Error cargando citas");
      const data = await res.json();
      setBookings(data.bookings);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [clinicId, statusFilter]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

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
                          <button
                            onClick={() => updateStatus(b.id, "cancelled")}
                            disabled={updatingId === b.id}
                            className="text-xs font-semibold text-gray-500 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-full hover:bg-gray-100 disabled:opacity-40 transition-colors"
                          >
                            Cancelar
                          </button>
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
    </div>
  );
}
