"use client";

import Image from "next/image";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  getPatientMe, patientLogin, patientRegister, clearPatientToken,
  getClinicBookingInfo, getAvailableSlots, createBooking, getPrefillData,
  PatientData, ClinicBookingInfo, DoctorSlots, PrefillData,
} from "@/lib/patient-auth";

/* ─── Helpers ────────────────────────────────────────────────────────── */

function formatRut(raw: string): string {
  const clean = raw.replace(/[^0-9kK]/g, "").toUpperCase();
  if (clean.length < 2) return clean;
  const body = clean.slice(0, -1);
  const dv   = clean.slice(-1);
  return body.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "-" + dv;
}

function isoDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function spanishWeekday(d: Date): string {
  return ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][d.getDay()];
}

function spanishShortMonth(d: Date): string {
  return ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][d.getMonth()];
}

function next14Days(): Date[] {
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return d;
  });
}

/* ─── Sub-components ─────────────────────────────────────────────────── */

function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#1A5C7A", borderTopColor: "transparent" }} />
    </div>
  );
}

function StepBar({ step }: { step: number }) {
  const steps = ["Profesional", "Fecha", "Hora", "Confirmar"];
  return (
    <div className="flex items-center gap-1 mb-8">
      {steps.map((label, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors"
            style={{
              backgroundColor: i < step ? "#1A5C7A" : i === step ? "#0B2F42" : "#E5E0D9",
              color: i <= step ? "white" : "#A0B0BC",
            }}
          >
            {i < step ? "✓" : i + 1}
          </div>
          <span className="text-[10px] font-medium hidden sm:block" style={{ color: i === step ? "#0B2F42" : "#A0B0BC" }}>
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─── Auth section ───────────────────────────────────────────────────── */

interface AuthSectionProps {
  clinicSlug: string;
  prefill?: PrefillData | null;
  onAuth: (patient: PatientData) => void;
}

function AuthSection({ clinicSlug, prefill, onAuth }: AuthSectionProps) {
  // Si hay prefill, abrir directo en registro; si no, en login
  const [tab, setTab] = useState<"login" | "register">(prefill ? "register" : "login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Login state
  const [rut, setRut] = useState(prefill?.rut ? formatRut(prefill.rut) : "");
  const [password, setPassword] = useState("");

  // Register state — pre-rellenado desde el chat
  const [regRut, setRegRut]           = useState(prefill?.rut       ? formatRut(prefill.rut) : "");
  const [regFirstName, setRegFirstName] = useState(prefill?.firstName ?? "");
  const [regLastName, setRegLastName]   = useState(prefill?.lastName  ?? "");
  const [regEmail, setRegEmail]         = useState(prefill?.email     ?? "");
  const [regPhone, setRegPhone]         = useState("");
  const [regPassword, setRegPassword]   = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const { patient } = await patientLogin({ rut: rut.replace(/\./g, "").replace("-", ""), password, clinicSlug });
      onAuth(patient);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally { setLoading(false); }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const { patient } = await patientRegister({
        rut: regRut.replace(/\./g, "").replace("-", ""),
        firstName: regFirstName,
        lastName: regLastName,
        email: regEmail || undefined,
        phone: regPhone || undefined,
        password: regPassword,
        clinicSlug,
      });
      onAuth(patient);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrarse");
    } finally { setLoading(false); }
  }

  const inputCls = "w-full px-4 py-3 rounded-xl text-sm outline-none transition";
  const inputStyle = { border: "1px solid #E5E0D9", backgroundColor: "#F7F5F1", color: "#0C1B26" };

  return (
    <div>
      <p className="text-center text-sm mb-6" style={{ color: "#607281" }}>
        Crea tu cuenta para confirmar tu hora
      </p>

      {/* Tabs */}
      <div className="flex rounded-xl p-1 mb-6" style={{ backgroundColor: "#E5E0D9" }}>
        {(["login", "register"] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setError(""); }}
            className="flex-1 py-2 rounded-lg text-sm font-semibold transition-colors"
            style={{
              backgroundColor: tab === t ? "#FDFCFB" : "transparent",
              color: tab === t ? "#0C1B26" : "#607281",
            }}
          >
            {t === "login" ? "Iniciar sesión" : "Registrarse"}
          </button>
        ))}
      </div>

      {prefill && tab === "register" && (
        <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl mb-4" style={{ backgroundColor: "#E8F3F7", color: "#1A5C7A", border: "1px solid rgba(26,92,122,0.15)" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
          Completamos tus datos del chat. Solo añade una contraseña.
        </div>
      )}

      {tab === "login" ? (
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#607281" }}>RUT</label>
            <input
              type="text" placeholder="12.345.678-9" required
              value={rut} onChange={(e) => setRut(formatRut(e.target.value))}
              className={inputCls} style={inputStyle}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#607281" }}>Contraseña</label>
            <input
              type="password" placeholder="••••••••" required
              value={password} onChange={(e) => setPassword(e.target.value)}
              className={inputCls} style={inputStyle}
            />
          </div>
          {error && <p className="text-sm rounded-xl px-4 py-2.5" style={{ color: "#D95F45", backgroundColor: "#FDECEA", border: "1px solid rgba(217,95,69,0.15)" }}>{error}</p>}
          <button type="submit" disabled={loading} className="w-full text-white font-semibold py-3.5 rounded-xl text-sm transition-opacity disabled:opacity-50" style={{ backgroundColor: "#0B2F42" }}>
            {loading ? "Ingresando..." : "Entrar →"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleRegister} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#607281" }}>Nombre</label>
              <input type="text" placeholder="Ana" required value={regFirstName} onChange={(e) => setRegFirstName(e.target.value)} className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#607281" }}>Apellido</label>
              <input type="text" placeholder="García" required value={regLastName} onChange={(e) => setRegLastName(e.target.value)} className={inputCls} style={inputStyle} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#607281" }}>RUT</label>
            <input type="text" placeholder="12.345.678-9" required value={regRut} onChange={(e) => setRegRut(formatRut(e.target.value))} className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#607281" }}>Email</label>
            <input type="email" placeholder="ana@ejemplo.cl" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#607281" }}>Teléfono</label>
            <input type="tel" placeholder="+56 9 1234 5678" value={regPhone} onChange={(e) => setRegPhone(e.target.value)} className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#607281" }}>Contraseña</label>
            <input type="password" placeholder="Mínimo 6 caracteres" required minLength={6} value={regPassword} onChange={(e) => setRegPassword(e.target.value)} className={inputCls} style={inputStyle} />
          </div>
          {error && <p className="text-sm rounded-xl px-4 py-2.5" style={{ color: "#D95F45", backgroundColor: "#FDECEA", border: "1px solid rgba(217,95,69,0.15)" }}>{error}</p>}
          <button type="submit" disabled={loading} className="w-full text-white font-semibold py-3.5 rounded-xl text-sm transition-opacity disabled:opacity-50 mt-1" style={{ backgroundColor: "#0B2F42" }}>
            {loading ? "Creando cuenta..." : "Crear cuenta →"}
          </button>
        </form>
      )}
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────────────────── */

export default function BookPage() {
  const { slug } = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("s");

  const [pageLoading, setPageLoading] = useState(true);
  const [clinic, setClinic] = useState<ClinicBookingInfo | null>(null);
  const [patient, setPatient] = useState<PatientData | null>(null);
  const [prefill, setPrefill] = useState<PrefillData | null>(null);

  // Booking flow state
  const [step, setStep] = useState(0);
  const [selectedDoctor, setSelectedDoctor] = useState<string>("");
  const [selectedDate, setSelectedDate]     = useState<string>("");
  const [selectedTime, setSelectedTime]     = useState<string>("");
  const [selectedService, setSelectedService] = useState<string>("");
  const [slots, setSlots]                   = useState<DoctorSlots[]>([]);
  const [slotsLoading, setSlotsLoading]     = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError]     = useState("");
  const [confirmedBooking, setConfirmedBooking] = useState<{ id: string; doctor: string; date: string; time: string; patientName: string } | null>(null);

  // Agendar para otra persona
  const [bookingFor, setBookingFor] = useState<"self" | "other">("self");
  const [otherFirstName, setOtherFirstName] = useState("");
  const [otherLastName, setOtherLastName]   = useState("");
  const [otherRut, setOtherRut]             = useState("");

  const dates = next14Days();

  useEffect(() => {
    if (!slug) return;
    Promise.all([
      getClinicBookingInfo(slug),
      getPatientMe(),
      sessionId ? getPrefillData(slug, sessionId) : Promise.resolve(null),
    ]).then(([clinicData, meData, prefillData]) => {
      setClinic(clinicData);
      if (meData) setPatient(meData.patient);
      if (prefillData) setPrefill(prefillData);
      setPageLoading(false);
    }).catch(() => setPageLoading(false));
  }, [slug, sessionId]);

  async function loadSlots(date: string, doctor: string) {
    setSlotsLoading(true);
    try {
      const data = await getAvailableSlots(slug, date, doctor);
      setSlots(data.slots);
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }

  function selectDoctor(name: string) {
    setSelectedDoctor(name);
    setSelectedDate(""); setSelectedTime(""); setSlots([]);
    setStep(1);
  }

  function selectDate(d: string) {
    setSelectedDate(d);
    setSelectedTime(""); setSlots([]);
    setStep(2);
    loadSlots(d, selectedDoctor);
  }

  function selectTime(t: string) {
    setSelectedTime(t);
    setStep(3);
  }

  async function confirmBooking() {
    if (bookingFor === "other" && (!otherFirstName.trim() || !otherLastName.trim())) {
      setBookingError("Ingresa el nombre y apellido del paciente");
      return;
    }
    setBookingLoading(true); setBookingError("");
    try {
      const result = await createBooking(slug, {
        doctor: selectedDoctor,
        date: selectedDate,
        time: selectedTime,
        service: selectedService || undefined,
        patientData: bookingFor === "other"
          ? { firstName: otherFirstName.trim(), lastName: otherLastName.trim(), rut: otherRut || undefined }
          : undefined,
      });
      const name = bookingFor === "other"
        ? `${otherFirstName.trim()} ${otherLastName.trim()}`
        : `${patient!.firstName} ${patient!.lastName}`;
      setConfirmedBooking({ id: result.booking.id, doctor: result.booking.doctor, date: selectedDate, time: result.booking.time, patientName: name });
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : "Error al agendar");
    } finally {
      setBookingLoading(false);
    }
  }

  function reset() {
    setStep(0); setSelectedDoctor(""); setSelectedDate(""); setSelectedTime(""); setSelectedService("");
    setSlots([]); setBookingError(""); setConfirmedBooking(null);
    setBookingFor("self"); setOtherFirstName(""); setOtherLastName(""); setOtherRut("");
  }

  const card = "rounded-2xl p-6 shadow-sm";
  const cardStyle = { backgroundColor: "#FDFCFB", border: "1px solid #E5E0D9" };

  if (pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F7F5F1" }}>
        <Spinner />
      </div>
    );
  }

  if (!clinic) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F7F5F1" }}>
        <p className="text-sm" style={{ color: "#607281" }}>Clínica no encontrada.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F7F5F1" }}>
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between border-b" style={{ backgroundColor: "#FDFCFB", borderColor: "#E5E0D9" }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: "#0B2F42" }}>
            {clinic.name[0]}
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: "#0C1B26" }}>{clinic.name}</p>
            {clinic.location && <p className="text-[11px]" style={{ color: "#607281" }}>{clinic.location}</p>}
          </div>
        </div>
        {patient && (
          <button
            onClick={() => { clearPatientToken(); setPatient(null); reset(); }}
            className="text-xs font-medium"
            style={{ color: "#607281" }}
          >
            Salir
          </button>
        )}
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">

        {/* ── Success screen ──────────────────────────────────────── */}
        {confirmedBooking && (
          <div className={card} style={cardStyle}>
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "#E8F3F7" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#1A5C7A" strokeWidth={2} className="w-7 h-7">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold mb-1" style={{ color: "#0C1B26" }}>¡Cita confirmada!</h2>
              <p className="text-sm" style={{ color: "#607281" }}>Te esperamos en {clinic.name}</p>
            </div>
            <div className="rounded-xl p-4 mb-6 space-y-2" style={{ backgroundColor: "#F7F5F1" }}>
              {[
                { label: "Paciente", value: confirmedBooking.patientName },
                { label: "Profesional", value: confirmedBooking.doctor },
                { label: "Fecha", value: new Date(`${confirmedBooking.date}T12:00:00`).toLocaleDateString("es-CL", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) },
                { label: "Hora", value: confirmedBooking.time },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span style={{ color: "#607281" }}>{label}</span>
                  <span className="font-semibold" style={{ color: "#0C1B26" }}>{value}</span>
                </div>
              ))}
            </div>
            <button onClick={reset} className="w-full py-3 rounded-xl text-sm font-semibold transition-opacity" style={{ border: "1.5px solid #E5E0D9", color: "#607281" }}>
              Agendar otra hora
            </button>
          </div>
        )}

        {/* ── Auth wall ─────────────────────────────────────────── */}
        {!confirmedBooking && !patient && (
          <div className={card} style={cardStyle}>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-bold mb-2 text-center" style={{ color: "#0C1B26" }}>
              Agenda tu hora
            </h2>
            <AuthSection clinicSlug={slug} prefill={prefill} onAuth={setPatient} />
          </div>
        )}

        {/* ── Booking flow ───────────────────────────────────────── */}
        {!confirmedBooking && patient && (
          <>
            <div className="mb-2 text-sm" style={{ color: "#607281" }}>
              Hola, <strong style={{ color: "#0C1B26" }}>{patient.firstName}</strong>
            </div>

            <StepBar step={step} />

            {/* Step 0: Select doctor */}
            {step >= 0 && (
              <div className={`${card} mb-4`} style={cardStyle}>
                <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: "#1A5C7A" }}>Elige profesional</p>
                <div className="grid grid-cols-1 gap-2">
                  {clinic.doctors.map((doc) => (
                    <button
                      key={doc.name}
                      onClick={() => selectDoctor(doc.name)}
                      className="flex items-center gap-3 p-3.5 rounded-xl text-left transition-colors"
                      style={{
                        border: selectedDoctor === doc.name ? "2px solid #1A5C7A" : "1.5px solid #E5E0D9",
                        backgroundColor: selectedDoctor === doc.name ? "#E8F3F7" : "#F7F5F1",
                      }}
                    >
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white" style={{ backgroundColor: "#0B2F42" }}>
                        {doc.name.split(" ").filter(w => !["Dra.","Dr."].includes(w)).map(w => w[0]).join("").slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "#0C1B26" }}>{doc.name}</p>
                        <p className="text-xs" style={{ color: "#607281" }}>{doc.specialty} · {doc.schedule}</p>
                      </div>
                      {selectedDoctor === doc.name && (
                        <div className="ml-auto w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "#1A5C7A" }}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} className="w-2.5 h-2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 1: Select date */}
            {step >= 1 && (
              <div className={`${card} mb-4`} style={cardStyle}>
                <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: "#1A5C7A" }}>Elige fecha</p>
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                  {dates.map((d) => {
                    const iso = isoDate(d);
                    const isSun = d.getDay() === 0;
                    return (
                      <button
                        key={iso}
                        onClick={() => !isSun && selectDate(iso)}
                        disabled={isSun}
                        className="flex flex-col items-center px-3 py-2.5 rounded-xl shrink-0 transition-colors disabled:opacity-30"
                        style={{
                          minWidth: "52px",
                          border: selectedDate === iso ? "2px solid #1A5C7A" : "1.5px solid #E5E0D9",
                          backgroundColor: selectedDate === iso ? "#E8F3F7" : "#F7F5F1",
                        }}
                      >
                        <span className="text-[10px] font-bold uppercase" style={{ color: selectedDate === iso ? "#1A5C7A" : "#A0B0BC" }}>{spanishWeekday(d)}</span>
                        <span className="text-lg font-bold leading-none my-0.5" style={{ color: selectedDate === iso ? "#0B2F42" : "#0C1B26" }}>{d.getDate()}</span>
                        <span className="text-[10px]" style={{ color: "#A0B0BC" }}>{spanishShortMonth(d)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 2: Select time */}
            {step >= 2 && (
              <div className={`${card} mb-4`} style={cardStyle}>
                <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: "#1A5C7A" }}>Elige hora</p>
                {slotsLoading ? <Spinner /> : (
                  slots.length === 0
                    ? <p className="text-sm text-center py-4" style={{ color: "#607281" }}>Sin horarios disponibles para este día.</p>
                    : slots.flatMap((ds) =>
                        ds.availableSlots.length === 0 ? [] : [
                          <div key={ds.doctor} className="grid grid-cols-4 gap-2">
                            {ds.availableSlots.map((t) => (
                              <button
                                key={t}
                                onClick={() => selectTime(t)}
                                className="py-2.5 rounded-xl text-sm font-semibold transition-colors"
                                style={{
                                  border: selectedTime === t ? "2px solid #1A5C7A" : "1.5px solid #E5E0D9",
                                  backgroundColor: selectedTime === t ? "#E8F3F7" : "#F7F5F1",
                                  color: selectedTime === t ? "#0B2F42" : "#0C1B26",
                                }}
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        ]
                      )
                )}
              </div>
            )}

            {/* Step 3: Confirm */}
            {step >= 3 && selectedTime && (
              <div className={`${card} mb-4`} style={cardStyle}>
                <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: "#1A5C7A" }}>Confirmar reserva</p>

                {/* ¿Para quién es la cita? */}
                <div className="mb-5">
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#607281" }}>¿Para quién es la cita?</p>
                  <div className="flex rounded-xl p-1 mb-3" style={{ backgroundColor: "#E5E0D9" }}>
                    {(["self", "other"] as const).map((opt) => (
                      <button
                        key={opt}
                        onClick={() => { setBookingFor(opt); setBookingError(""); }}
                        className="flex-1 py-2 rounded-lg text-sm font-semibold transition-colors"
                        style={{
                          backgroundColor: bookingFor === opt ? "#FDFCFB" : "transparent",
                          color: bookingFor === opt ? "#0C1B26" : "#607281",
                        }}
                      >
                        {opt === "self" ? `Para mí (${patient!.firstName})` : "Para otra persona"}
                      </button>
                    ))}
                  </div>

                  {bookingFor === "other" && (
                    <div className="flex flex-col gap-3 p-4 rounded-xl" style={{ backgroundColor: "#F7F5F1", border: "1px solid #E5E0D9" }}>
                      <p className="text-xs" style={{ color: "#607281" }}>Ingresa los datos del paciente que va a atenderse</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#607281" }}>Nombre</label>
                          <input
                            type="text" placeholder="María" required
                            value={otherFirstName} onChange={(e) => setOtherFirstName(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                            style={{ border: "1px solid #E5E0D9", backgroundColor: "#FDFCFB", color: "#0C1B26" }}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#607281" }}>Apellido</label>
                          <input
                            type="text" placeholder="González" required
                            value={otherLastName} onChange={(e) => setOtherLastName(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                            style={{ border: "1px solid #E5E0D9", backgroundColor: "#FDFCFB", color: "#0C1B26" }}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#607281" }}>RUT del paciente <span style={{ color: "#A0B0BC", fontWeight: 400, textTransform: "none" }}>(opcional)</span></label>
                        <input
                          type="text" placeholder="12.345.678-9"
                          value={otherRut} onChange={(e) => setOtherRut(formatRut(e.target.value))}
                          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                          style={{ border: "1px solid #E5E0D9", backgroundColor: "#FDFCFB", color: "#0C1B26" }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Optional service select */}
                {clinic.services.length > 0 && (
                  <div className="mb-4">
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#607281" }}>Tipo de consulta (opcional)</label>
                    <select
                      value={selectedService}
                      onChange={(e) => setSelectedService(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                      style={{ border: "1px solid #E5E0D9", backgroundColor: "#F7F5F1", color: "#0C1B26" }}
                    >
                      <option value="">Selecciona (opcional)</option>
                      {clinic.services.map((s) => (
                        <option key={s.name} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Summary */}
                <div className="rounded-xl p-4 mb-5 space-y-2.5" style={{ backgroundColor: "#F7F5F1" }}>
                  {[
                    {
                      label: "Paciente",
                      value: bookingFor === "other" && (otherFirstName || otherLastName)
                        ? `${otherFirstName} ${otherLastName}`.trim()
                        : `${patient.firstName} ${patient.lastName}`,
                    },
                    { label: "Profesional", value: selectedDoctor },
                    { label: "Fecha", value: new Date(`${selectedDate}T12:00:00`).toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" }) },
                    { label: "Hora", value: selectedTime },
                    ...(selectedService ? [{ label: "Consulta", value: selectedService }] : []),
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between text-sm">
                      <span style={{ color: "#607281" }}>{label}</span>
                      <span className="font-semibold text-right ml-4" style={{ color: "#0C1B26" }}>{value}</span>
                    </div>
                  ))}
                </div>

                {bookingError && (
                  <p className="text-sm rounded-xl px-4 py-2.5 mb-4" style={{ color: "#D95F45", backgroundColor: "#FDECEA", border: "1px solid rgba(217,95,69,0.15)" }}>{bookingError}</p>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => { setStep(2); setSelectedTime(""); }}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold"
                    style={{ border: "1.5px solid #E5E0D9", color: "#607281" }}
                  >
                    ← Cambiar
                  </button>
                  <button
                    onClick={confirmBooking}
                    disabled={bookingLoading}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                    style={{ backgroundColor: "#0B2F42" }}
                  >
                    {bookingLoading ? "Confirmando..." : "Confirmar cita"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <p className="text-center text-xs pb-8 mt-4" style={{ color: "#A0B0BC" }}>
        Powered by <span style={{ color: "#1A5C7A" }}>molari.ai</span>
      </p>
    </div>
  );
}
