"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMe, updateClinic } from "@/lib/auth";

type Step = 1 | 2 | 3 | 4;

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] as const;
const DAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
type DayKey = (typeof DAY_KEYS)[number];

const SPECIALTIES = [
  "Odontología General",
  "Ortodoncia",
  "Endodoncia",
  "Implantología",
  "Periodoncia",
  "Cirugía Oral",
  "Blanqueamiento",
  "Odontopediatría",
];

interface Doctor {
  _id: string;
  name: string;
  specialty: string;
  days: DayKey[];
}

interface ScheduleDay {
  open: boolean;
  from: string;
  to: string;
}

interface Schedule {
  monday: ScheduleDay;
  tuesday: ScheduleDay;
  wednesday: ScheduleDay;
  thursday: ScheduleDay;
  friday: ScheduleDay;
  saturday: ScheduleDay;
  sunday: ScheduleDay;
}

const DEFAULT_SCHEDULE: Schedule = {
  monday:    { open: true,  from: "09:00", to: "18:00" },
  tuesday:   { open: true,  from: "09:00", to: "18:00" },
  wednesday: { open: true,  from: "09:00", to: "18:00" },
  thursday:  { open: true,  from: "09:00", to: "18:00" },
  friday:    { open: true,  from: "09:00", to: "18:00" },
  saturday:  { open: false, from: "09:00", to: "13:00" },
  sunday:    { open: false, from: "09:00", to: "13:00" },
};

const STEPS = [
  { label: "Bienvenida" },
  { label: "Doctores" },
  { label: "Horario" },
  { label: "Canales" },
];

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [clinicName, setClinicName] = useState("");
  const [clinicSlug, setClinicSlug] = useState("");
  const [doctors, setDoctors] = useState<Doctor[]>([
    { _id: uid(), name: "", specialty: "Odontología General", days: ["monday", "tuesday", "wednesday", "thursday", "friday"] },
  ]);
  const [schedule, setSchedule] = useState<Schedule>(DEFAULT_SCHEDULE);
  const [boxes, setBoxes] = useState(2);
  const [whatsapp, setWhatsapp] = useState("");
  const [instagram, setInstagram] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getMe().then((data) => {
      if (!data?.clinic) { router.replace("/login"); return; }
      setClinicId(data.clinic.id);
      setClinicName(data.clinic.name);
      setClinicSlug(data.clinic.slug);
      if (data.clinic.whatsapp) setWhatsapp(data.clinic.whatsapp);
      if (data.clinic.instagram) setInstagram(data.clinic.instagram);
      const cfg = data.clinic.config as Record<string, unknown>;
      if (Array.isArray(cfg.doctors) && cfg.doctors.length > 0) {
        setDoctors(
          (cfg.doctors as { name: string; specialty?: string; days?: string[] }[]).map((d) => ({
            _id: uid(),
            name: d.name,
            specialty: d.specialty ?? "Odontología General",
            days: (d.days ?? ["monday", "tuesday", "wednesday", "thursday", "friday"]) as DayKey[],
          }))
        );
      }
    });
  }, [router]);

  /* ── Doctor helpers ────────────────────────────────────────────────────── */
  function addDoctor() {
    setDoctors((ds) => [
      ...ds,
      { _id: uid(), name: "", specialty: "Odontología General", days: ["monday", "tuesday", "wednesday", "thursday", "friday"] },
    ]);
  }

  function removeDoctor(id: string) {
    setDoctors((ds) => ds.filter((d) => d._id !== id));
  }

  function updateDoctor(id: string, field: keyof Omit<Doctor, "_id">, value: unknown) {
    setDoctors((ds) => ds.map((d) => d._id === id ? { ...d, [field]: value } : d));
  }

  function toggleDay(doctorId: string, day: DayKey) {
    setDoctors((ds) =>
      ds.map((d) => {
        if (d._id !== doctorId) return d;
        const has = d.days.includes(day);
        return { ...d, days: has ? d.days.filter((x) => x !== day) : [...d.days, day] };
      })
    );
  }

  /* ── Schedule helpers ──────────────────────────────────────────────────── */
  function updateScheduleDay(key: keyof Schedule, field: keyof ScheduleDay, value: string | boolean) {
    setSchedule((s) => ({ ...s, [key]: { ...s[key], [field]: value } }));
  }

  /* ── Finish ────────────────────────────────────────────────────────────── */
  async function finish() {
    if (!clinicId) return;
    setSaving(true);
    setError("");
    try {
      const validDoctors = doctors.filter((d) => d.name.trim());
      const scheduleConfig: Record<string, string> = {};
      const dayNames: Record<keyof Schedule, string> = {
        monday: "Lunes", tuesday: "Martes", wednesday: "Miércoles",
        thursday: "Jueves", friday: "Viernes", saturday: "Sábado", sunday: "Domingo",
      };
      Object.entries(schedule).forEach(([key, val]) => {
        scheduleConfig[key] = val.open ? `${dayNames[key as keyof Schedule]}: ${val.from} - ${val.to}` : `${dayNames[key as keyof Schedule]}: cerrado`;
      });

      await updateClinic(clinicId, {
        whatsapp: whatsapp.trim() || undefined,
        instagram: instagram.trim() || undefined,
        config: {
          tone: "profesional pero cercano",
          schedule: scheduleConfig,
          doctors: validDoctors.map(({ name, specialty, days }) => ({ name, specialty, days })),
          services: validDoctors.flatMap((d) => [d.specialty]).filter((v, i, a) => a.indexOf(v) === i),
          boxes,
          onboardingDone: true,
        },
      });
      router.push("/partners/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  const embedCode = `<script src="https://molari.ai/widget.js" data-clinic="${clinicSlug}" defer></script>`;

  /* ── Render ────────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "#F7F5F1" }}>
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-[38%] flex-col justify-between p-12 text-white"
        style={{ backgroundColor: "#0B2F42" }}>
        <div className="text-sm font-semibold tracking-tight opacity-70">molari.ai</div>

        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: "#D95F45" }}>
            Configuración inicial
          </p>
          <h1 className="text-3xl font-bold leading-tight mb-10">
            Tu clínica lista<br />en 3 minutos.
          </h1>

          {/* Stepper vertical */}
          <div className="flex flex-col gap-0">
            {STEPS.map((s, i) => {
              const n = (i + 1) as Step;
              const done = step > n;
              const active = step === n;
              return (
                <div key={n} className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
                      done ? "bg-emerald-500 text-white" : active ? "bg-white text-[#0B2F42]" : "bg-white/10 text-white/40"
                    }`}>
                      {done ? "✓" : n}
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className={`w-px flex-1 my-1 ${done ? "bg-emerald-400/50" : "bg-white/10"}`} style={{ height: 28 }} />
                    )}
                  </div>
                  <div className="pt-1 pb-8">
                    <p className={`text-sm font-semibold ${active ? "text-white" : done ? "text-emerald-300" : "text-white/40"}`}>
                      {s.label}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
          © {new Date().getFullYear()} molari.ai
        </p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-start justify-center px-6 py-12 overflow-y-auto">
        <div className="w-full max-w-xl">

          {/* Mobile stepper */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            {STEPS.map((s, i) => {
              const n = (i + 1) as Step;
              const done = step > n;
              const active = step === n;
              return (
                <div key={n} className="flex items-center gap-1.5 flex-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                    done ? "bg-emerald-500 text-white" : active ? "text-white" : "bg-gray-100 text-gray-400"
                  }`} style={active ? { backgroundColor: "#0B2F42" } : {}}>
                    {done ? "✓" : n}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-px ${done ? "bg-emerald-400" : "bg-gray-200"}`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Step 1: Welcome ── */}
          {step === 1 && (
            <div className="flex flex-col gap-6">
              <div>
                <p className="text-4xl mb-4">👋</p>
                <h2 className="text-3xl font-black mb-2" style={{ color: "#0C1B26" }}>
                  {clinicName ? `Bienvenido, ${clinicName}` : "Bienvenido a molari.ai"}
                </h2>
                <p className="text-base" style={{ color: "#607281" }}>
                  Configuremos tu asistente en 3 pasos simples.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { icon: "🦷", title: "Tus doctores", desc: "Agrega el equipo con sus especialidades y disponibilidad" },
                  { icon: "🕐", title: "Horario", desc: "Define cuándo atiende tu clínica y cuántos boxes tienes" },
                  { icon: "📲", title: "Canales", desc: "Conecta WhatsApp, Instagram y el widget de tu web" },
                ].map((card) => (
                  <div key={card.title} className="bg-white rounded-2xl border p-5 flex flex-col gap-2" style={{ borderColor: "#E5E0D9" }}>
                    <span className="text-2xl">{card.icon}</span>
                    <p className="text-sm font-bold" style={{ color: "#0C1B26" }}>{card.title}</p>
                    <p className="text-xs leading-relaxed" style={{ color: "#607281" }}>{card.desc}</p>
                  </div>
                ))}
              </div>

              <button onClick={() => setStep(2)}
                className="w-full py-4 rounded-2xl text-sm font-bold text-white transition hover:opacity-90"
                style={{ backgroundColor: "#0B2F42" }}>
                Comenzar configuración →
              </button>
              <button onClick={() => router.push("/partners/dashboard")}
                className="text-center text-xs hover:opacity-70 transition" style={{ color: "#607281" }}>
                Saltar por ahora
              </button>
            </div>
          )}

          {/* ── Step 2: Doctors ── */}
          {step === 2 && (
            <div className="flex flex-col gap-6">
              <div>
                <button onClick={() => setStep(1)} className="text-xs mb-4 hover:opacity-70 transition flex items-center gap-1" style={{ color: "#607281" }}>
                  ← Volver
                </button>
                <h2 className="text-2xl font-black mb-1" style={{ color: "#0C1B26" }}>Agrega tus doctores</h2>
                <p className="text-sm" style={{ color: "#607281" }}>
                  El asistente usará esta información para guiar a los pacientes.
                </p>
              </div>

              <div className="flex flex-col gap-4">
                {doctors.map((doc, idx) => (
                  <div key={doc._id} className="bg-white rounded-2xl border p-5 flex flex-col gap-4" style={{ borderColor: "#E5E0D9" }}>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "#607281" }}>
                        Doctor {idx + 1}
                      </p>
                      {doctors.length > 1 && (
                        <button onClick={() => removeDoctor(doc._id)}
                          className="w-6 h-6 rounded-full bg-gray-100 hover:bg-red-50 hover:text-red-500 transition text-gray-400 text-xs flex items-center justify-center">
                          ✕
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold mb-1" style={{ color: "#607281" }}>Nombre completo</label>
                        <input
                          value={doc.name}
                          onChange={(e) => updateDoctor(doc._id, "name", e.target.value)}
                          placeholder="Dra. María González"
                          className="w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                          style={{ borderColor: "#E5E0D9", color: "#0C1B26" }}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1" style={{ color: "#607281" }}>Especialidad</label>
                        <select
                          value={doc.specialty}
                          onChange={(e) => updateDoctor(doc._id, "specialty", e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 appearance-none"
                          style={{ borderColor: "#E5E0D9", color: "#0C1B26" }}>
                          {SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold mb-2" style={{ color: "#607281" }}>Días disponibles</label>
                      <div className="flex gap-2 flex-wrap">
                        {DAY_KEYS.map((key, i) => {
                          const active = doc.days.includes(key);
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => toggleDay(doc._id, key)}
                              className={`w-10 h-10 rounded-xl text-xs font-bold transition ${
                                active ? "text-white" : "text-gray-400 bg-gray-100 hover:bg-gray-200"
                              }`}
                              style={active ? { backgroundColor: "#1A5C7A", color: "white" } : {}}>
                              {DAYS[i]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}

                <button onClick={addDoctor}
                  className="flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed text-sm font-semibold transition hover:border-blue-300 hover:text-blue-600"
                  style={{ borderColor: "#E5E0D9", color: "#607281" }}>
                  <span className="text-lg leading-none">+</span> Agregar otro doctor
                </button>
              </div>

              <button
                onClick={() => {
                  if (doctors.every((d) => !d.name.trim())) {
                    setError("Agrega al menos un doctor con nombre");
                    return;
                  }
                  setError("");
                  setStep(3);
                }}
                className="w-full py-4 rounded-2xl text-sm font-bold text-white transition hover:opacity-90"
                style={{ backgroundColor: "#0B2F42" }}>
                Continuar →
              </button>
              {error && <p className="text-xs text-red-600 text-center">{error}</p>}
            </div>
          )}

          {/* ── Step 3: Schedule ── */}
          {step === 3 && (
            <div className="flex flex-col gap-6">
              <div>
                <button onClick={() => setStep(2)} className="text-xs mb-4 hover:opacity-70 transition flex items-center gap-1" style={{ color: "#607281" }}>
                  ← Volver
                </button>
                <h2 className="text-2xl font-black mb-1" style={{ color: "#0C1B26" }}>Horario y capacidad</h2>
                <p className="text-sm" style={{ color: "#607281" }}>
                  El asistente ofrecerá citas solo en los horarios que definas.
                </p>
              </div>

              <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "#E5E0D9" }}>
                <div className="px-5 py-3 border-b bg-gray-50" style={{ borderColor: "#E5E0D9" }}>
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "#607281" }}>Horario semanal</p>
                </div>
                <div className="divide-y" style={{ borderColor: "#F0EDE8" }}>
                  {(["monday","tuesday","wednesday","thursday","friday","saturday","sunday"] as const).map((key) => {
                    const labels: Record<string, string> = {
                      monday: "Lunes", tuesday: "Martes", wednesday: "Miércoles",
                      thursday: "Jueves", friday: "Viernes", saturday: "Sábado", sunday: "Domingo",
                    };
                    const day = schedule[key];
                    return (
                      <div key={key} className="px-5 py-3 flex items-center gap-4">
                        <button
                          type="button"
                          onClick={() => updateScheduleDay(key, "open", !day.open)}
                          className={`w-10 h-6 rounded-full transition relative shrink-0 ${day.open ? "" : "bg-gray-200"}`}
                          style={day.open ? { backgroundColor: "#1A5C7A" } : {}}>
                          <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${day.open ? "right-1" : "left-1"}`} />
                        </button>
                        <span className={`text-sm font-semibold w-24 shrink-0 ${day.open ? "" : "text-gray-400"}`}
                          style={day.open ? { color: "#0C1B26" } : {}}>
                          {labels[key]}
                        </span>
                        {day.open ? (
                          <div className="flex items-center gap-2 text-sm">
                            <input type="time" value={day.from}
                              onChange={(e) => updateScheduleDay(key, "from", e.target.value)}
                              className="px-2 py-1 rounded-lg border text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                              style={{ borderColor: "#E5E0D9" }} />
                            <span className="text-gray-400 text-xs">a</span>
                            <input type="time" value={day.to}
                              onChange={(e) => updateScheduleDay(key, "to", e.target.value)}
                              className="px-2 py-1 rounded-lg border text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                              style={{ borderColor: "#E5E0D9" }} />
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Cerrado</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Boxes */}
              <div className="bg-white rounded-2xl border p-5" style={{ borderColor: "#E5E0D9" }}>
                <label className="block text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#607281" }}>
                  Número de boxes / sillones
                </label>
                <div className="flex gap-3">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" onClick={() => setBoxes(n)}
                      className={`w-12 h-12 rounded-xl text-sm font-bold transition ${boxes === n ? "text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                      style={boxes === n ? { backgroundColor: "#1A5C7A", color: "white" } : {}}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={() => setStep(4)}
                className="w-full py-4 rounded-2xl text-sm font-bold text-white transition hover:opacity-90"
                style={{ backgroundColor: "#0B2F42" }}>
                Continuar →
              </button>
            </div>
          )}

          {/* ── Step 4: Channels ── */}
          {step === 4 && (
            <div className="flex flex-col gap-6">
              <div>
                <button onClick={() => setStep(3)} className="text-xs mb-4 hover:opacity-70 transition flex items-center gap-1" style={{ color: "#607281" }}>
                  ← Volver
                </button>
                <h2 className="text-2xl font-black mb-1" style={{ color: "#0C1B26" }}>Conecta tus canales</h2>
                <p className="text-sm" style={{ color: "#607281" }}>
                  Puedes conectar ahora o configurarlo más tarde desde el panel.
                </p>
              </div>

              {/* WhatsApp */}
              <div className="bg-white rounded-2xl border p-5 flex flex-col gap-3" style={{ borderColor: "#E5E0D9" }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                    style={{ backgroundColor: "#E9F5EC" }}>
                    💬
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: "#0C1B26" }}>WhatsApp Business</p>
                    <p className="text-xs" style={{ color: "#607281" }}>El asistente responderá aquí 24/7</p>
                  </div>
                </div>
                <input
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="+56 9 1234 5678"
                  className="w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                  style={{ borderColor: "#E5E0D9", color: "#0C1B26" }}
                />
              </div>

              {/* Instagram */}
              <div className="bg-white rounded-2xl border p-5 flex flex-col gap-3" style={{ borderColor: "#E5E0D9" }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                    style={{ backgroundColor: "#FDF0F5" }}>
                    📸
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: "#0C1B26" }}>Instagram</p>
                    <p className="text-xs" style={{ color: "#607281" }}>Responde DMs automáticamente</p>
                  </div>
                </div>
                <input
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="@tuclinica"
                  className="w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                  style={{ borderColor: "#E5E0D9", color: "#0C1B26" }}
                />
              </div>

              {/* Widget embed */}
              <div className="bg-white rounded-2xl border p-5 flex flex-col gap-3" style={{ borderColor: "#E5E0D9" }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                    style={{ backgroundColor: "#EEF3F8" }}>
                    🌐
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: "#0C1B26" }}>Widget web</p>
                    <p className="text-xs" style={{ color: "#607281" }}>Pega este código en el {"<head>"} de tu sitio</p>
                  </div>
                </div>
                <div className="relative">
                  <pre className="text-xs bg-slate-900 text-emerald-300 rounded-xl p-4 overflow-x-auto leading-relaxed">
                    {embedCode}
                  </pre>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(embedCode);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="absolute top-3 right-3 px-2.5 py-1 rounded-lg text-[11px] font-bold transition"
                    style={{
                      backgroundColor: copied ? "#10B981" : "rgba(255,255,255,0.1)",
                      color: copied ? "white" : "#9CA3AF",
                    }}>
                    {copied ? "¡Copiado!" : "Copiar"}
                  </button>
                </div>
              </div>

              {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

              <button
                onClick={finish}
                disabled={saving}
                className="w-full py-4 rounded-2xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: "#D95F45" }}>
                {saving ? "Guardando…" : "Finalizar configuración →"}
              </button>
              <button onClick={() => router.push("/partners/dashboard")}
                className="text-center text-xs hover:opacity-70 transition" style={{ color: "#607281" }}>
                Terminar más tarde
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
