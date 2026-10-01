"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { getClinicBookingInfo, getAvailableSlots, getPrefillData, ClinicBookingInfo, DoctorSlots } from "@/lib/patient-auth";
import { Check } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/* ─── Helpers ─────────────────────────────────────────────────────────── */

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
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: "#1A5C7A", borderTopColor: "transparent" }} />
    </div>
  );
}

function StepBar({ step }: { step: number }) {
  const steps = ["Profesional", "Fecha", "Hora", "Tus datos"];
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
            {i < step ? <Check className="w-3.5 h-3.5" aria-hidden /> : i + 1}
          </div>
          <span className="text-[10px] font-medium hidden sm:block" style={{ color: i === step ? "#0B2F42" : "#A0B0BC" }}>
            {label}
          </span>
        </div>
      ))}
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

  // Flow state
  const [step, setStep] = useState(0);
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [selectedDate, setSelectedDate]     = useState("");
  const [selectedTime, setSelectedTime]     = useState("");
  const [selectedService, setSelectedService] = useState("");
  const [slots, setSlots]                   = useState<DoctorSlots[]>([]);
  const [slotsLoading, setSlotsLoading]     = useState(false);

  // Guest patient data
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [rut, setRut]             = useState("");
  const [phone, setPhone]         = useState("");
  const [email, setEmail]         = useState("");

  // Result
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError]     = useState("");
  const [confirmedBooking, setConfirmedBooking] = useState<{ id: string; doctor: string; date: string; time: string; patientName: string } | null>(null);

  const dates = next14Days();
  const card = "rounded-2xl p-6 shadow-sm";
  const cardStyle = { backgroundColor: "#FDFCFB", border: "1px solid #E5E0D9" };
  const inputCls = "w-full px-4 py-3 rounded-xl text-sm outline-none transition";
  const inputStyle = { border: "1px solid #E5E0D9", backgroundColor: "#F7F5F1", color: "#0C1B26" };

  useEffect(() => {
    if (!slug) return;
    Promise.all([
      getClinicBookingInfo(slug),
      sessionId ? getPrefillData(slug, sessionId) : Promise.resolve(null),
    ]).then(([clinicData, prefillData]) => {
      setClinic(clinicData);
      if (prefillData) {
        if (prefillData.firstName) setFirstName(prefillData.firstName);
        if (prefillData.lastName)  setLastName(prefillData.lastName);
        if (prefillData.rut)       setRut(formatRut(prefillData.rut));
        if (prefillData.email)     setEmail(prefillData.email);
      }
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

  async function confirmBooking(e: React.FormEvent) {
    e.preventDefault();
    setBookingError(""); setBookingLoading(true);
    try {
      const res = await fetch(`${API}/api/book/${slug}/appointments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctor: selectedDoctor,
          date: selectedDate,
          time: selectedTime,
          service: selectedService || undefined,
          guest: {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            rut: rut.replace(/\./g, "").replace("-", ""),
            phone: phone.trim() || undefined,
            email: email.trim() || undefined,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al agendar");
      setConfirmedBooking({
        id: data.booking.id,
        doctor: data.booking.doctor,
        date: selectedDate,
        time: data.booking.time,
        patientName: data.booking.patientName,
      });
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : "Error al agendar");
    } finally {
      setBookingLoading(false);
    }
  }

  function reset() {
    setStep(0); setSelectedDoctor(""); setSelectedDate(""); setSelectedTime(""); setSelectedService("");
    setSlots([]); setBookingError(""); setConfirmedBooking(null);
  }

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
      <div className="px-5 py-4 flex items-center border-b" style={{ backgroundColor: "#FDFCFB", borderColor: "#E5E0D9" }}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mr-3" style={{ backgroundColor: "#0B2F42" }}>
          {clinic.name[0]}
        </div>
        <div>
          <p className="text-sm font-bold" style={{ color: "#0C1B26" }}>{clinic.name}</p>
          {clinic.location && <p className="text-[11px]" style={{ color: "#607281" }}>{clinic.location}</p>}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">

        {/* ── Success ─────────────────────────────────────────── */}
        {confirmedBooking && (
          <div className={card} style={cardStyle}>
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "#E8F3F7" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#1A5C7A" strokeWidth={2} className="w-7 h-7">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              {/* La hora queda pedida, no cerrada: la confirma el profesional.
                  Decir "confirmada" acá era la misma promesa que se sacó del
                  asistente cuando se armó la confirmación humana. */}
              <h2 className="text-2xl font-bold mb-1" style={{ color: "#0C1B26" }}>Solicitud enviada</h2>
              <p className="text-sm" style={{ color: "#607281" }}>
                {clinic.name} la está revisando. Te avisamos apenas el profesional responda.
              </p>
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
            <p className="text-xs text-center mb-4" style={{ color: "#8A9AA6" }}>
              Si no puede atenderte a esa hora, te ofrecemos otras opciones.
            </p>
            <button onClick={reset} className="w-full py-3 rounded-xl text-sm font-semibold" style={{ border: "1.5px solid #E5E0D9", color: "#607281" }}>
              Pedir otra hora
            </button>
          </div>
        )}

        {/* ── Booking flow ───────────────────────────────────── */}
        {!confirmedBooking && (
          <>
            <StepBar step={step} />

            {/* Step 0: Profesional */}
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

            {/* Step 1: Fecha */}
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

            {/* Step 2: Hora */}
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

            {/* Step 3: Datos del paciente + confirmar */}
            {step >= 3 && selectedTime && (
              <div className={`${card} mb-4`} style={cardStyle}>
                <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "#1A5C7A" }}>Tus datos</p>
                <p className="text-xs mb-5" style={{ color: "#A0B0BC" }}>Solo necesitamos lo esencial para confirmar tu hora.</p>

                <form onSubmit={confirmBooking} className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#607281" }}>Nombre</label>
                      <input type="text" placeholder="María" required value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#607281" }}>Apellido</label>
                      <input type="text" placeholder="González" required value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} style={inputStyle} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#607281" }}>RUT</label>
                    <input type="text" placeholder="12.345.678-9" required value={rut} onChange={(e) => setRut(formatRut(e.target.value))} className={inputCls} style={inputStyle} />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#607281" }}>
                      Teléfono <span className="font-normal normal-case" style={{ color: "#A0B0BC" }}>(opcional)</span>
                    </label>
                    <input type="tel" placeholder="+56 9 1234 5678" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} style={inputStyle} />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#607281" }}>
                      Email <span className="font-normal normal-case" style={{ color: "#A0B0BC" }}>(opcional)</span>
                    </label>
                    <input type="email" placeholder="maria@ejemplo.cl" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} style={inputStyle} />
                  </div>

                  {/* Resumen */}
                  <div className="rounded-xl p-4 space-y-2" style={{ backgroundColor: "#F7F5F1" }}>
                    {[
                      { label: "Profesional", value: selectedDoctor },
                      { label: "Fecha", value: new Date(`${selectedDate}T12:00:00`).toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" }) },
                      { label: "Hora", value: selectedTime },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between text-sm">
                        <span style={{ color: "#607281" }}>{label}</span>
                        <span className="font-semibold text-right ml-4" style={{ color: "#0C1B26" }}>{value}</span>
                      </div>
                    ))}
                  </div>

                  {bookingError && (
                    <p className="text-sm rounded-xl px-4 py-2.5" style={{ color: "#D95F45", backgroundColor: "#FDECEA", border: "1px solid rgba(217,95,69,0.15)" }}>{bookingError}</p>
                  )}

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => { setStep(2); setSelectedTime(""); }}
                      className="flex-1 py-3 rounded-xl text-sm font-semibold"
                      style={{ border: "1.5px solid #E5E0D9", color: "#607281" }}
                    >
                      Cambiar hora
                    </button>
                    <button
                      type="submit"
                      disabled={bookingLoading}
                      className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                      style={{ backgroundColor: "#0B2F42" }}
                    >
                      {bookingLoading ? "Confirmando..." : "Confirmar cita"}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </>
        )}
      </div>

      <p className="text-center text-xs pb-8 mt-4" style={{ color: "#A0B0BC" }}>
        Powered by <span style={{ color: "#1A5C7A" }}>molari.ai</span>
      </p>
    </div>
  );
}
