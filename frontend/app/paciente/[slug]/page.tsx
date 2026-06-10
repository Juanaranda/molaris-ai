"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getPatientMe, patientLogin, clearPatientToken,
  getMyBookings, cancelMyBooking,
  PatientData, MyBooking,
} from "@/lib/patient-auth";

function formatRut(raw: string): string {
  const clean = raw.replace(/[^0-9kK]/g, "").toUpperCase();
  if (clean.length < 2) return clean;
  return clean.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "-" + clean.slice(-1);
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  pending:   { label: "Pendiente",  cls: "bg-yellow-50 text-yellow-700 border border-yellow-100" },
  confirmed: { label: "Confirmada", cls: "bg-green-50 text-green-700 border border-green-100" },
  cancelled: { label: "Cancelada",  cls: "bg-red-50 text-red-400 border border-red-100" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { label: status, cls: "bg-gray-50 text-gray-500 border border-gray-100" };
  return <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>;
}

function BookingCard({
  booking, onCancel, cancelling,
}: {
  booking: MyBooking;
  onCancel: (id: string) => void;
  cancelling: string | null;
}) {
  const dateObj = new Date(booking.date + "T12:00:00");
  const dateStr = dateObj.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const isPast  = dateObj < new Date();
  const canCancel = booking.status !== "cancelled" && !isPast;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-gray-900 capitalize">{dateStr}</p>
          <p className="text-sm text-gray-500 mt-0.5">{booking.time} · {booking.doctor}</p>
        </div>
        <StatusBadge status={booking.status} />
      </div>
      {booking.service && (
        <p className="text-sm text-gray-500">Consulta: <span className="text-gray-700 font-medium">{booking.service}</span></p>
      )}
      {canCancel && (
        <button
          onClick={() => onCancel(booking.id)}
          disabled={cancelling === booking.id}
          className="self-start text-xs font-semibold text-red-500 border border-red-200 bg-red-50 px-3 py-1.5 rounded-full hover:bg-red-100 disabled:opacity-50 transition-colors"
        >
          {cancelling === booking.id ? "Cancelando..." : "Cancelar cita"}
        </button>
      )}
    </div>
  );
}

export default function PatientPortal() {
  const { slug } = useParams<{ slug: string }>();
  const [patient, setPatient]   = useState<PatientData | null>(null);
  const [bookings, setBookings] = useState<MyBooking[]>([]);
  const [clinicName, setClinicName] = useState("");
  const [loading, setLoading]   = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState("");
  const [view, setView] = useState<"upcoming" | "past">("upcoming");

  // Login state
  const [rut, setRut]           = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError]     = useState("");

  useEffect(() => {
    getPatientMe().then((data) => {
      if (data) {
        setPatient(data.patient);
        loadBookings();
      } else {
        setLoading(false);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function loadBookings() {
    setLoading(true);
    try {
      const data = await getMyBookings(slug);
      setBookings(data.bookings);
      setClinicName(data.clinicName);
    } catch {}
    finally { setLoading(false); }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(""); setLoginLoading(true);
    try {
      const { patient: p } = await patientLogin({
        rut: rut.replace(/\./g, "").replace("-", ""),
        password,
        clinicSlug: slug,
      });
      setPatient(p);
      await loadBookings();
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally { setLoginLoading(false); }
  }

  async function handleCancel(bookingId: string) {
    setCancelError(""); setCancelling(bookingId);
    try {
      await cancelMyBooking(slug, bookingId);
      setBookings((prev) => prev.map((b) => b.id === bookingId ? { ...b, status: "cancelled" } : b));
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "Error al cancelar");
    } finally { setCancelling(null); }
  }

  function handleLogout() {
    clearPatientToken();
    setPatient(null);
    setBookings([]);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const filtered = bookings.filter((b) => {
    const d = new Date(b.date);
    d.setHours(0, 0, 0, 0);
    return view === "upcoming" ? d >= today : d < today;
  });

  const inputCls = "w-full px-4 py-3 rounded-xl text-sm outline-none border border-gray-200 bg-gray-50 focus:border-blue-400 transition";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
        <div>
          <p className="font-bold text-gray-900">{clinicName || "Mi cuenta"}</p>
          <p className="text-xs text-gray-400">Portal del paciente · molari.ai</p>
        </div>
        {patient && (
          <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
            Cerrar sesión
          </button>
        )}
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">

        {/* Login wall */}
        {!patient && !loading && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Mis citas</h2>
            <p className="text-sm text-gray-500 mb-6">Ingresa con tu RUT para ver y gestionar tus citas.</p>
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">RUT</label>
                <input
                  type="text" placeholder="12.345.678-9" required
                  value={rut} onChange={(e) => setRut(formatRut(e.target.value))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Contraseña</label>
                <input
                  type="password" placeholder="••••••••" required
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className={inputCls}
                />
              </div>
              {loginError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2">{loginError}</p>
              )}
              <button
                type="submit" disabled={loginLoading}
                className="w-full bg-gray-900 text-white font-semibold py-3 rounded-xl text-sm hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {loginLoading ? "Ingresando..." : "Entrar"}
              </button>
            </form>
            <p className="text-xs text-gray-400 text-center mt-4">
              ¿No tienes cuenta?{" "}
              <Link href={`/book/${slug}`} className="text-blue-600 hover:underline">Agenda una cita aquí</Link>
            </p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Bookings */}
        {patient && !loading && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Hola, {patient.firstName}</h2>
                <p className="text-sm text-gray-400">Tus citas en {clinicName}</p>
              </div>
              <Link
                href={`/book/${slug}`}
                className="text-sm font-semibold bg-blue-600 text-white px-4 py-2 rounded-full hover:bg-blue-700 transition-colors"
              >
                + Nueva cita
              </Link>
            </div>

            {/* Toggle */}
            <div className="flex rounded-xl overflow-hidden border border-gray-200 w-fit">
              {(["upcoming", "past"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-4 py-1.5 text-sm font-medium transition-colors ${view === v ? "bg-gray-900 text-white" : "bg-white text-gray-500"}`}
                >
                  {v === "upcoming" ? "Próximas" : "Pasadas"}
                </button>
              ))}
            </div>

            {cancelError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2">{cancelError}</p>
            )}

            {filtered.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-12 text-center">
                <p className="text-sm text-gray-400">
                  {view === "upcoming" ? "No tienes citas próximas." : "No tienes citas pasadas."}
                </p>
                {view === "upcoming" && (
                  <Link href={`/book/${slug}`} className="text-sm text-blue-600 mt-2 inline-block hover:underline">
                    Agendar una cita
                  </Link>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filtered.map((b) => (
                  <BookingCard key={b.id} booking={b} onCancel={handleCancel} cancelling={cancelling} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <p className="text-center text-xs text-gray-300 pb-8">Powered by <span className="text-blue-400">molari.ai</span></p>
    </div>
  );
}
