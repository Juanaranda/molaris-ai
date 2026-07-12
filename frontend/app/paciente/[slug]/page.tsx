"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getPatientMe, patientLogin, patientRegister, clearPatientToken,
  getMyBookings, cancelMyBooking, getMyBoletas, patientUpdateProfile,
  downloadMyData, requestMyDataDeletion, getPurposes,
  PatientData, MyBooking, PatientBoleta, DataPurpose,
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
  booking, onCancel, cancelling, slug,
}: {
  booking: MyBooking;
  onCancel: (id: string) => void;
  cancelling: string | null;
  slug: string;
}) {
  const dateObj = new Date(booking.date + "T12:00:00");
  const dateStr = dateObj.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const isPast  = dateObj < new Date();
  const canCancel    = booking.status !== "cancelled" && !isPast;
  const canReschedule = booking.status !== "cancelled" && !isPast;

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
      <div className="flex gap-2 flex-wrap">
        {canReschedule && (
          <Link href={`/book/${slug}?doctor=${encodeURIComponent(booking.doctor)}`}
            className="text-xs font-semibold text-blue-600 border border-blue-200 bg-blue-50 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors">
            Reagendar
          </Link>
        )}
        {canCancel && (
          <button onClick={() => onCancel(booking.id)} disabled={cancelling === booking.id}
            className="text-xs font-semibold text-red-500 border border-red-200 bg-red-50 px-3 py-1.5 rounded-full hover:bg-red-100 disabled:opacity-50 transition-colors">
            {cancelling === booking.id ? "Cancelando…" : "Cancelar cita"}
          </button>
        )}
      </div>
    </div>
  );
}

type Tab = "citas" | "boletas" | "perfil";

export default function PatientPortal() {
  const { slug } = useParams<{ slug: string }>();
  const [patient, setPatient]       = useState<PatientData | null>(null);
  const [bookings, setBookings]     = useState<MyBooking[]>([]);
  const [boletas, setBoletas]       = useState<PatientBoleta[]>([]);
  const [clinicName, setClinicName] = useState("");
  const [loading, setLoading]       = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState("");
  const [tab,  setTab]  = useState<Tab>("citas");
  const [view, setView] = useState<"upcoming" | "past">("upcoming");

  // Login/register state
  const [mode, setMode]       = useState<"login" | "register">("login");
  const [rut, setRut]         = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName,  setLastName]  = useState("");
  const [email,     setEmail]     = useState("");
  const [phone,     setPhone]     = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError]     = useState("");
  // Consentimientos de tratamiento de datos (Ley 21.719)
  const [purposes, setPurposes] = useState<DataPurpose[]>([]);
  const [consents, setConsents] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (mode === "register" && purposes.length === 0) {
      getPurposes().then((ps) => {
        setPurposes(ps);
        // required arrancan en true; opcionales en false
        setConsents(Object.fromEntries(ps.map((p) => [p.key, p.required])));
      });
    }
  }, [mode, purposes.length]);

  useEffect(() => {
    getPatientMe().then((data) => {
      if (data) {
        setPatient(data.patient);
        setClinicName(data.clinic.name);
        loadEverything();
      } else {
        setLoading(false);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function loadEverything() {
    setLoading(true);
    try {
      const [b, bol] = await Promise.all([
        getMyBookings(slug),
        getMyBoletas().catch(() => []),
      ]);
      setBookings(b.bookings);
      setClinicName(b.clinicName);
      setBoletas(bol);
    } catch {/* swallow */}
    finally { setLoading(false); }
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(""); setAuthLoading(true);
    try {
      if (mode === "login") {
        const { patient: p } = await patientLogin({
          rut: rut.replace(/\./g, "").replace("-", ""),
          password, clinicSlug: slug,
        });
        setPatient(p);
      } else {
        if (!firstName.trim() || !lastName.trim()) throw new Error("Nombre y apellido son obligatorios");
        const missingRequired = purposes.some((p) => p.required && !consents[p.key]);
        if (missingRequired) throw new Error("Debes aceptar los tratamientos necesarios para usar el servicio");
        const { patient: p } = await patientRegister({
          rut: rut.replace(/\./g, "").replace("-", ""),
          firstName: firstName.trim(), lastName: lastName.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          password, clinicSlug: slug,
          consents,
        });
        setPatient(p);
      }
      await loadEverything();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Error");
    } finally { setAuthLoading(false); }
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
    setBookings([]); setBoletas([]);
  }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const filteredBookings = bookings.filter((b) => {
    const d = new Date(b.date); d.setHours(0, 0, 0, 0);
    return view === "upcoming" ? d >= today : d < today;
  });

  const inputCls = "w-full px-4 py-3 rounded-xl text-sm outline-none border border-gray-200 bg-gray-50 focus:border-blue-400 transition";

  return (
    <div className="min-h-screen bg-gray-50">
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

      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Login / Register wall */}
        {!patient && !loading && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex gap-1 mb-5 border-b border-gray-100">
              {(["login","register"] as const).map((m) => (
                <button key={m} onClick={() => { setMode(m); setAuthError(""); }}
                  className={`px-4 py-2 text-sm font-bold border-b-2 -mb-px transition ${
                    mode === m ? "border-blue-600 text-blue-600" : "border-transparent text-gray-400 hover:text-gray-600"
                  }`}>
                  {m === "login" ? "Ingresar" : "Registrarme"}
                </button>
              ))}
            </div>

            <form onSubmit={handleAuth} className="flex flex-col gap-4">
              {mode === "register" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Nombre *</label>
                    <input type="text" required value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Apellido *</label>
                    <input type="text" required value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">RUT *</label>
                <input type="text" placeholder="12.345.678-9" required value={rut} onChange={(e) => setRut(formatRut(e.target.value))} className={inputCls} />
              </div>
              {mode === "register" && (
                <>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Email</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Teléfono</label>
                    <input type="tel" placeholder="+56 9 1234 5678" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
                  </div>
                </>
              )}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Contraseña *</label>
                <input type="password" required minLength={6} placeholder={mode === "register" ? "Mínimo 6 caracteres" : "••••••••"} value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
              </div>
              {mode === "register" && purposes.length > 0 && (
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 flex flex-col gap-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Tratamiento de tus datos (Ley 21.719)</p>
                  {purposes.map((p) => (
                    <label key={p.key} className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={consents[p.key] ?? false}
                        disabled={p.required}
                        onChange={(e) => setConsents((c) => ({ ...c, [p.key]: e.target.checked }))}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-60"
                      />
                      <span className="text-[11px] leading-snug text-gray-600">
                        <span className="font-semibold text-gray-800">{p.label}</span>
                        {p.required && <span className="ml-1 text-[9px] uppercase tracking-wide text-gray-400">(necesario)</span>}
                        <br />{p.description}
                      </span>
                    </label>
                  ))}
                  <p className="text-[10px] text-gray-400">
                    Puedes revisar o revocar estos permisos cuando quieras desde tu perfil.
                  </p>
                </div>
              )}
              {authError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2">{authError}</p>
              )}
              <button type="submit" disabled={authLoading}
                className="w-full bg-gray-900 text-white font-semibold py-3 rounded-xl text-sm hover:bg-gray-800 disabled:opacity-50 transition-colors">
                {authLoading
                  ? (mode === "login" ? "Ingresando…" : "Creando cuenta…")
                  : (mode === "login" ? "Entrar" : "Crear cuenta")}
              </button>
            </form>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Dashboard */}
        {patient && !loading && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Hola, {patient.firstName}</h2>
                <p className="text-sm text-gray-400">{clinicName}</p>
              </div>
              <Link href={`/book/${slug}`}
                className="text-sm font-semibold bg-blue-600 text-white px-4 py-2 rounded-full hover:bg-blue-700 transition-colors">
                + Nueva cita
              </Link>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
              {([
                ["citas",    "Mis citas",   bookings.length],
                ["boletas",  "Boletas",     boletas.length],
                ["perfil",   "Mi perfil",   null],
              ] as [Tab, string, number | null][]).map(([t, label, count]) => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                    tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}>
                  {label}
                  {count !== null && count > 0 && (
                    <span className="ml-1.5 text-[10px] text-gray-400 tabular-nums">({count})</span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {tab === "citas" && (
              <CitasSection
                bookings={filteredBookings}
                view={view} setView={setView}
                cancelling={cancelling} cancelError={cancelError}
                onCancel={handleCancel}
                slug={slug}
              />
            )}
            {tab === "boletas" && <BoletasSection boletas={boletas} />}
            {tab === "perfil"  && <PerfilSection patient={patient} onUpdate={setPatient} />}
          </div>
        )}
      </div>

      <p className="text-center text-xs text-gray-300 pb-8">Powered by <span className="text-blue-400">molari.ai</span></p>
    </div>
  );
}

/* ─── Citas ────────────────────────────────────────────────────────────── */
function CitasSection({
  bookings, view, setView, cancelling, cancelError, onCancel, slug,
}: {
  bookings: MyBooking[];
  view: "upcoming" | "past"; setView: (v: "upcoming" | "past") => void;
  cancelling: string | null; cancelError: string;
  onCancel: (id: string) => void; slug: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex rounded-xl overflow-hidden border border-gray-200 w-fit">
        {(["upcoming","past"] as const).map((v) => (
          <button key={v} onClick={() => setView(v)}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${view === v ? "bg-gray-900 text-white" : "bg-white text-gray-500"}`}>
            {v === "upcoming" ? "Próximas" : "Pasadas"}
          </button>
        ))}
      </div>
      {cancelError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2">{cancelError}</p>
      )}
      {bookings.length === 0 ? (
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
          {bookings.map((b) => (
            <BookingCard key={b.id} booking={b} onCancel={onCancel} cancelling={cancelling} slug={slug} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Boletas ──────────────────────────────────────────────────────────── */
function BoletasSection({ boletas }: { boletas: PatientBoleta[] }) {
  if (boletas.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-12 text-center">
        <p className="text-sm text-gray-400">Aún no tienes boletas emitidas.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {boletas.map((b) => (
        <div key={b.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-violet-700 bg-violet-50 px-2 py-0.5 rounded">
                Folio {b.folio ?? "—"}
              </span>
              <span className="text-[11px] text-gray-400">
                {b.emittedAt ? new Date(b.emittedAt).toLocaleDateString("es-CL") : "—"}
              </span>
            </div>
            <p className="text-sm font-semibold text-gray-900 truncate">{b.description ?? "Atención dental"}</p>
            <p className="text-xs text-gray-500">${b.totalAmount.toLocaleString("es-CL")} CLP</p>
          </div>
          {b.pdfUrl && (
            <a href={b.pdfUrl} target="_blank" rel="noopener noreferrer"
              className="text-xs font-bold px-3 py-1.5 rounded-xl bg-violet-700 text-white hover:bg-violet-800 transition shrink-0">
              PDF
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Perfil ───────────────────────────────────────────────────────────── */
function PerfilSection({ patient, onUpdate }: { patient: PatientData; onUpdate: (p: PatientData) => void }) {
  const [editing, setEditing] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");
  const [msg,     setMsg]     = useState("");
  const [form, setForm] = useState({
    firstName: patient.firstName,
    lastName:  patient.lastName,
    email:     patient.email ?? "",
    phone:     patient.phone ?? "",
    address:   patient.address ?? "",
    emergencyContactName:     patient.emergencyContactName ?? "",
    emergencyContactPhone:    patient.emergencyContactPhone ?? "",
    emergencyContactRelation: patient.emergencyContactRelation ?? "",
  });

  async function save() {
    setSaving(true); setError(""); setMsg("");
    try {
      const updated = await patientUpdateProfile({
        firstName: form.firstName.trim() || undefined,
        lastName:  form.lastName.trim() || undefined,
        email:     form.email.trim() || null,
        phone:     form.phone.trim() || null,
        address:   form.address.trim() || null,
        emergencyContactName:     form.emergencyContactName.trim() || null,
        emergencyContactPhone:    form.emergencyContactPhone.trim() || null,
        emergencyContactRelation: form.emergencyContactRelation.trim() || null,
      });
      onUpdate(updated);
      setEditing(false);
      setMsg("Guardado");
      setTimeout(() => setMsg(""), 3000);
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally    { setSaving(false); }
  }

  const inputCls = "w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-500";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-gray-900">Datos personales</h3>
        {!editing ? (
          <button onClick={() => setEditing(true)}
            className="text-xs font-bold px-3 py-1.5 rounded-xl bg-gray-900 text-white hover:bg-gray-800">
            Editar
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} disabled={saving}
              className="text-xs font-bold px-3 py-1.5 rounded-xl border border-gray-200 text-gray-500 hover:border-gray-300">Cancelar</button>
            <button onClick={save} disabled={saving}
              className="text-xs font-bold px-3 py-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        )}
      </div>
      {msg && <p className="text-xs text-emerald-600">{msg}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-4">
        <KV label="RUT" value={patient.rut} hint="No editable" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <PField label="Nombre" value={form.firstName} editing={editing} onChange={(v) => setForm({ ...form, firstName: v })} cls={inputCls} display={patient.firstName} />
          <PField label="Apellido" value={form.lastName} editing={editing} onChange={(v) => setForm({ ...form, lastName: v })} cls={inputCls} display={patient.lastName} />
          <PField label="Email" value={form.email} editing={editing} onChange={(v) => setForm({ ...form, email: v })} cls={inputCls} display={patient.email ?? "—"} type="email" />
          <PField label="Teléfono" value={form.phone} editing={editing} onChange={(v) => setForm({ ...form, phone: v })} cls={inputCls} display={patient.phone ?? "—"} />
        </div>
        <PField label="Domicilio" value={form.address} editing={editing} onChange={(v) => setForm({ ...form, address: v })} cls={inputCls} display={patient.address ?? "—"} />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Contacto de emergencia</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <PField label="Nombre" value={form.emergencyContactName} editing={editing} onChange={(v) => setForm({ ...form, emergencyContactName: v })} cls={inputCls} display={patient.emergencyContactName ?? "—"} />
          <PField label="Teléfono" value={form.emergencyContactPhone} editing={editing} onChange={(v) => setForm({ ...form, emergencyContactPhone: v })} cls={inputCls} display={patient.emergencyContactPhone ?? "—"} />
          <PField label="Parentesco" value={form.emergencyContactRelation} editing={editing} onChange={(v) => setForm({ ...form, emergencyContactRelation: v })} cls={inputCls} display={patient.emergencyContactRelation ?? "—"} />
        </div>
      </div>

      <PrivacySection />
    </div>
  );
}

/* ─── Privacidad y mis datos — ARCO+ (Ley 21.719) ──────────────────────── */
function PrivacySection() {
  const [busy, setBusy]   = useState<"" | "download" | "delete">("");
  const [msg, setMsg]     = useState("");
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);

  async function handleDownload() {
    setBusy("download"); setMsg(""); setError("");
    try {
      const data = await downloadMyData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mis-datos-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg("Descarga lista.");
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally     { setBusy(""); }
  }

  async function handleDelete() {
    setBusy("delete"); setMsg(""); setError("");
    try {
      const res = await requestMyDataDeletion();
      setMsg(res.message);
      setConfirming(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally     { setBusy(""); }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Privacidad y mis datos</h4>
      <p className="text-[11px] text-gray-400 mb-4">
        Conforme a la Ley 21.719, puedes acceder a tus datos y solicitar su eliminación.
      </p>
      <div className="flex flex-wrap gap-2">
        <button onClick={handleDownload} disabled={busy !== ""}
          className="text-xs font-bold px-3 py-1.5 rounded-xl bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50">
          {busy === "download" ? "Preparando…" : "Descargar mis datos"}
        </button>
        {!confirming ? (
          <button onClick={() => { setConfirming(true); setMsg(""); setError(""); }} disabled={busy !== ""}
            className="text-xs font-bold px-3 py-1.5 rounded-xl border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-50">
            Solicitar eliminación
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">¿Confirmas?</span>
            <button onClick={handleDelete} disabled={busy !== ""}
              className="text-xs font-bold px-3 py-1.5 rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
              {busy === "delete" ? "Procesando…" : "Sí, solicitar"}
            </button>
            <button onClick={() => setConfirming(false)} disabled={busy !== ""}
              className="text-xs font-bold px-3 py-1.5 rounded-xl border border-gray-200 text-gray-500 hover:border-gray-300">
              Cancelar
            </button>
          </div>
        )}
      </div>
      {msg   && <p className="text-xs text-emerald-600 mt-3">{msg}</p>}
      {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
    </div>
  );
}

function KV({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
      <p className="text-sm text-gray-800">{value}{hint && <span className="ml-2 text-[10px] text-gray-400 italic">({hint})</span>}</p>
    </div>
  );
}

function PField({ label, value, editing, onChange, cls, display, type = "text" }: {
  label: string; value: string; editing: boolean; onChange: (v: string) => void; cls: string; display: string; type?: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">{label}</p>
      {editing
        ? <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className={cls} />
        : <p className="text-sm text-gray-800">{display}</p>}
    </div>
  );
}
