"use client";

import Link from "next/link";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type Step = 1 | 2;

const BENEFITS = [
  "Asistente IA que responde 24/7 en WhatsApp, Instagram y tu web",
  "Agendamiento directo sin llamadas ni intermediarios",
  "Lead scoring automático con cada conversación",
  "Panel de control para ver leads y configurar tu clínica",
];

/* ─── Chile: regiones y comunas ─────────────────────────────────────────── */
const REGIONS: { label: string; short: string; comunas: string[] }[] = [
  {
    label: "Arica y Parinacota", short: "Arica",
    comunas: ["Arica", "Camarones", "Putre", "General Lagos"],
  },
  {
    label: "Tarapacá", short: "Tarapacá",
    comunas: ["Iquique", "Alto Hospicio", "Pozo Almonte", "Camiña", "Colchane", "Huara", "Pica"],
  },
  {
    label: "Antofagasta", short: "Antofagasta",
    comunas: ["Antofagasta", "Mejillones", "Sierra Gorda", "Taltal", "Calama", "Ollagüe", "San Pedro de Atacama", "Tocopilla", "María Elena"],
  },
  {
    label: "Atacama", short: "Atacama",
    comunas: ["Copiapó", "Caldera", "Tierra Amarilla", "Chañaral", "Diego de Almagro", "Vallenar", "Alto del Carmen", "Freirina", "Huasco"],
  },
  {
    label: "Coquimbo", short: "Coquimbo",
    comunas: ["La Serena", "Coquimbo", "Andacollo", "La Higuera", "Paihuano", "Vicuña", "Illapel", "Canela", "Los Vilos", "Salamanca", "Ovalle", "Combarbalá", "Monte Patria", "Punitaqui", "Río Hurtado"],
  },
  {
    label: "Valparaíso", short: "Valparaíso",
    comunas: ["Valparaíso", "Viña del Mar", "Quilpué", "Villa Alemana", "Concón", "Juan Fernández", "Puchuncaví", "Quintero", "Casablanca", "Algarrobo", "Cartagena", "El Quisco", "El Tabo", "San Antonio", "Santo Domingo", "Los Andes", "Calle Larga", "Rinconada", "San Esteban", "La Ligua", "Cabildo", "Papudo", "Petorca", "Zapallar", "Quillota", "Calera", "Hijuelas", "La Cruz", "Nogales", "San Felipe", "Catemu", "Llaillay", "Panquehue", "Putaendo", "Santa María"],
  },
  {
    label: "Metropolitana", short: "RM",
    comunas: ["Santiago", "Cerrillos", "Cerro Navia", "Conchalí", "El Bosque", "Estación Central", "Huechuraba", "Independencia", "La Cisterna", "La Florida", "La Granja", "La Pintana", "La Reina", "Las Condes", "Lo Barnechea", "Lo Espejo", "Lo Prado", "Macul", "Maipú", "Ñuñoa", "Pedro Aguirre Cerda", "Peñalolén", "Providencia", "Pudahuel", "Quilicura", "Quinta Normal", "Recoleta", "Renca", "San Joaquín", "San Miguel", "San Ramón", "Vitacura", "Puente Alto", "Pirque", "San José de Maipo", "Colina", "Lampa", "Tiltil", "San Bernardo", "Buin", "Calera de Tango", "Paine", "Melipilla", "Alhué", "Curacaví", "María Pinto", "San Pedro", "Talagante", "El Monte", "Isla de Maipo", "Padre Hurtado", "Peñaflor"],
  },
  {
    label: "O'Higgins", short: "O'Higgins",
    comunas: ["Rancagua", "Codegua", "Coinco", "Coltauco", "Doñihue", "Graneros", "Las Cabras", "Machalí", "Malloa", "Mostazal", "Olivar", "Peumo", "Pichidegua", "Quinta de Tilcoco", "Rengo", "Requínoa", "San Vicente", "Pichilemu", "La Estrella", "Litueche", "Marchihue", "Navidad", "Paredones", "San Fernando", "Chépica", "Chimbarongo", "Lolol", "Nancagua", "Palmilla", "Peralillo", "Placilla", "Pumanque", "Santa Cruz"],
  },
  {
    label: "Maule", short: "Maule",
    comunas: ["Talca", "Constitución", "Curepto", "Empedrado", "Maule", "Pelarco", "Pencahue", "Río Claro", "San Clemente", "San Rafael", "Cauquenes", "Chanco", "Pelluhue", "Curicó", "Hualañé", "Licantén", "Molina", "Rauco", "Romeral", "Sagrada Familia", "Teno", "Vichuquén", "Linares", "Colbún", "Longaví", "Parral", "Retiro", "San Javier", "Villa Alegre", "Yerbas Buenas"],
  },
  {
    label: "Ñuble", short: "Ñuble",
    comunas: ["Chillán", "Bulnes", "Chillán Viejo", "El Carmen", "Pemuco", "Pinto", "Quillón", "San Ignacio", "Yungay", "Cobquecura", "Coelemu", "Ninhue", "Portezuelo", "Quirihue", "Ránquil", "Treguaco", "Coihueco", "Ñiquén", "San Carlos", "San Fabián", "San Nicolás"],
  },
  {
    label: "Biobío", short: "Biobío",
    comunas: ["Concepción", "Coronel", "Chiguayante", "Florida", "Hualqui", "Lota", "Penco", "San Pedro de la Paz", "Santa Juana", "Talcahuano", "Tomé", "Hualpén", "Lebu", "Arauco", "Cañete", "Contulmo", "Curanilahue", "Los Álamos", "Tirúa", "Los Ángeles", "Antuco", "Cabrero", "Laja", "Mulchén", "Nacimiento", "Negrete", "Quilaco", "Quilleco", "San Rosendo", "Santa Bárbara", "Tucapel", "Yumbel", "Alto Biobío"],
  },
  {
    label: "La Araucanía", short: "Araucanía",
    comunas: ["Temuco", "Carahue", "Cunco", "Curarrehue", "Freire", "Galvarino", "Gorbea", "Lautaro", "Loncoche", "Melipeuco", "Nueva Imperial", "Padre Las Casas", "Perquenco", "Pitrufquén", "Pucón", "Saavedra", "Teodoro Schmidt", "Toltén", "Vilcún", "Villarrica", "Cholchol", "Angol", "Collipulli", "Curacautín", "Ercilla", "Lonquimay", "Los Sauces", "Lumaco", "Purén", "Renaico", "Traiguén", "Victoria"],
  },
  {
    label: "Los Ríos", short: "Los Ríos",
    comunas: ["Valdivia", "Corral", "Futrono", "La Unión", "Lago Ranco", "Lanco", "Los Lagos", "Máfil", "Mariquina", "Paillaco", "Panguipulli", "Río Bueno"],
  },
  {
    label: "Los Lagos", short: "Los Lagos",
    comunas: ["Puerto Montt", "Calbuco", "Cochamó", "Fresia", "Frutillar", "Los Muermos", "Llanquihue", "Maullín", "Puerto Varas", "Castro", "Ancud", "Chonchi", "Curaco de Vélez", "Dalcahue", "Puqueldón", "Queilén", "Quellón", "Quemchi", "Quinchao", "Osorno", "Puerto Octay", "Purranque", "Puyehue", "Río Negro", "San Juan de la Costa", "San Pablo", "Chaitén", "Futaleufú", "Hualaihué", "Palena"],
  },
  {
    label: "Aysén", short: "Aysén",
    comunas: ["Coyhaique", "Lago Verde", "Aysén", "Cisnes", "Guaitecas", "Cochrane", "O'Higgins", "Tortel", "Chile Chico", "Río Ibáñez"],
  },
  {
    label: "Magallanes", short: "Magallanes",
    comunas: ["Punta Arenas", "Laguna Blanca", "Río Verde", "San Gregorio", "Cabo de Hornos", "Antártica", "Porvenir", "Primavera", "Timaukel", "Natales", "Torres del Paine"],
  },
];

/* ─── Location selector ──────────────────────────────────────────────────── */
function LocationSelector({
  region, commune,
  onRegion, onCommune,
}: {
  region: string; commune: string;
  onRegion: (r: string) => void;
  onCommune: (c: string) => void;
}) {
  const [showAllRegions, setShowAllRegions] = useState(false);
  const regionData = REGIONS.find((r) => r.label === region);
  const comunas = regionData?.comunas ?? [];
  const [showAllComunas, setShowAllComunas] = useState(false);

  const VISIBLE_REGIONS = 8;
  const VISIBLE_COMUNAS = 12;
  const visibleRegions = showAllRegions ? REGIONS : REGIONS.slice(0, VISIBLE_REGIONS);
  const visibleComunas = showAllComunas ? comunas : comunas.slice(0, VISIBLE_COMUNAS);

  return (
    <div className="flex flex-col gap-3">
      {/* Region selector */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider mb-2"
          style={{ color: "var(--ink-muted, #607281)" }}>
          Región *
        </label>
        <div className="flex flex-wrap gap-1.5">
          {visibleRegions.map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={() => { onRegion(r.label); onCommune(""); setShowAllComunas(false); }}
              className="px-3 py-1.5 rounded-xl text-xs font-medium border transition-all"
              style={
                region === r.label
                  ? { backgroundColor: "var(--teal-mid, #1A5C7A)", color: "white", borderColor: "var(--teal-mid, #1A5C7A)" }
                  : { backgroundColor: "var(--surface, #F7F5F1)", color: "var(--ink-muted, #607281)", borderColor: "#E5E0D9" }
              }
            >
              {r.short}
            </button>
          ))}
          {!showAllRegions && REGIONS.length > VISIBLE_REGIONS && (
            <button
              type="button"
              onClick={() => setShowAllRegions(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-medium border transition-all"
              style={{ backgroundColor: "transparent", color: "var(--ink-muted, #607281)", borderColor: "#E5E0D9", borderStyle: "dashed" }}
            >
              +{REGIONS.length - VISIBLE_REGIONS} más
            </button>
          )}
        </div>
      </div>

      {/* Comuna selector — appears after region is selected */}
      {region && comunas.length > 0 && (
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2"
            style={{ color: "var(--ink-muted, #607281)" }}>
            Comuna *
          </label>
          <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1">
            {visibleComunas.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onCommune(c)}
                className="px-3 py-1.5 rounded-xl text-xs font-medium border transition-all"
                style={
                  commune === c
                    ? { backgroundColor: "var(--teal-mid, #1A5C7A)", color: "white", borderColor: "var(--teal-mid, #1A5C7A)" }
                    : { backgroundColor: "var(--surface, #F7F5F1)", color: "var(--ink-muted, #607281)", borderColor: "#E5E0D9" }
                }
              >
                {c}
              </button>
            ))}
            {!showAllComunas && comunas.length > VISIBLE_COMUNAS && (
              <button
                type="button"
                onClick={() => setShowAllComunas(true)}
                className="px-3 py-1.5 rounded-xl text-xs font-medium border transition-all"
                style={{ backgroundColor: "transparent", color: "var(--ink-muted, #607281)", borderColor: "#E5E0D9", borderStyle: "dashed" }}
              >
                +{comunas.length - VISIBLE_COMUNAS} más
              </button>
            )}
          </div>
        </div>
      )}

      {/* Summary chip */}
      {region && commune && (
        <div className="flex items-center gap-2">
          <span
            className="text-xs px-3 py-1.5 rounded-xl font-medium"
            style={{ backgroundColor: "#E8F3F7", color: "var(--teal-mid, #1A5C7A)", border: "1px solid #B8D9EA" }}
          >
            📍 {commune}, {region}
          </span>
          <button
            type="button"
            onClick={() => { onRegion(""); onCommune(""); }}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Cambiar
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep]   = useState<Step>(1);
  const [clinic, setClinic] = useState({ name: "", phone: "", region: "", commune: "" });
  const [admin, setAdmin]   = useState({ name: "", email: "", password: "", confirm: "" });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const location = clinic.commune && clinic.region
    ? `${clinic.commune}, ${clinic.region}`
    : clinic.region || "";

  function nextStep(e: FormEvent) {
    e.preventDefault();
    if (!clinic.name.trim()) { setError("El nombre de la clínica es requerido"); return; }
    setError("");
    setStep(2);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (admin.password !== admin.confirm) { setError("Las contraseñas no coinciden"); return; }
    if (admin.password.length < 8) { setError("La contraseña debe tener al menos 8 caracteres"); return; }
    if (!acceptedTerms) { setError("Debes aceptar los Términos y Condiciones para continuar"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/clinics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinic: { name: clinic.name, phone: clinic.phone, location },
          admin: { name: admin.name, email: admin.email, password: admin.password },
          acceptedTerms: true,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Error al registrar");
      }
      await res.json();
      await login(admin.email, admin.password);
      router.push("/partners/setup");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "var(--surface, #F7F5F1)" }}>

      {/* ── Panel izquierdo (solo desktop) ───────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[45%] flex-col justify-between p-12 text-white"
        style={{ backgroundColor: "var(--teal-dark, #0B2F42)" }}>
        <Link href="/" className="text-sm font-semibold tracking-tight opacity-80 hover:opacity-100 transition-opacity">
          ← molari.ai
        </Link>

        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-6" style={{ color: "var(--coral, #D95F45)" }}>
            Plan Starter · Gratis 30 días
          </p>
          <h1 className="font-[family-name:var(--font-display,sans-serif)] text-4xl font-bold leading-tight mb-8">
            Tu clínica merece<br />un asistente que<br />nunca descansa.
          </h1>
          <ul className="flex flex-col gap-4">
            {BENEFITS.map((b, i) => (
              <li key={i} className="flex items-start gap-3 text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>
                <span className="mt-0.5 w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ backgroundColor: "var(--coral, #D95F45)", color: "white" }}>✓</span>
                {b}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
          © {new Date().getFullYear()} molari.ai · Santiago, Chile
        </p>
      </div>

      {/* ── Panel derecho ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col">
        {/* Nav mobile */}
        <nav className="lg:hidden flex items-center justify-between px-6 py-5 border-b"
          style={{ borderColor: "#E5E0D9", backgroundColor: "white" }}>
          <Link href="/" className="text-sm font-semibold" style={{ color: "var(--teal-dark, #0B2F42)" }}>
            ← molari.ai
          </Link>
          <Link href="/login" className="text-sm" style={{ color: "var(--ink-muted, #607281)" }}>
            Ya tengo cuenta
          </Link>
        </nav>

        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">

            {/* Desktop: link "ya tengo cuenta" */}
            <div className="hidden lg:flex justify-end mb-6">
              <Link href="/login" className="text-sm transition-colors hover:opacity-70"
                style={{ color: "var(--ink-muted, #607281)" }}>
                Ya tengo cuenta
              </Link>
            </div>

            {/* Stepper */}
            <div className="flex items-center gap-2 mb-8">
              {([1, 2] as Step[]).map((s, i) => (
                <div key={s} className="flex items-center gap-2 flex-1">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                      step >= s ? "text-white" : "bg-gray-100 text-gray-400"
                    }`}
                    style={step >= s ? { backgroundColor: "var(--teal-mid, #1A5C7A)" } : {}}
                  >
                    {step > s ? "✓" : s}
                  </div>
                  <span
                    className={`text-xs hidden sm:block ${step >= s ? "font-medium" : "text-gray-400"}`}
                    style={step >= s ? { color: "var(--ink, #0C1B26)" } : {}}
                  >
                    {s === 1 ? "Tu clínica" : "Tu cuenta"}
                  </span>
                  {i < 1 && (
                    <div
                      className={`flex-1 h-px mx-2 ${step > s ? "" : "bg-gray-200"}`}
                      style={step > s ? { backgroundColor: "var(--teal-mid, #1A5C7A)" } : {}}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Card */}
            <div className="bg-white rounded-3xl shadow-sm border p-8" style={{ borderColor: "#E5E0D9" }}>

              {step === 1 && (
                <>
                  <div className="mb-7">
                    <h2 className="font-[family-name:var(--font-display,sans-serif)] text-2xl font-bold"
                      style={{ color: "var(--ink, #0C1B26)" }}>
                      Información de tu clínica
                    </h2>
                    <p className="text-sm mt-1.5" style={{ color: "var(--ink-muted, #607281)" }}>
                      Así configuraremos tu asistente virtual
                    </p>
                  </div>
                  <form onSubmit={nextStep} className="flex flex-col gap-5">
                    <Field
                      label="Nombre de la clínica *"
                      value={clinic.name}
                      onChange={(v) => setClinic((c) => ({ ...c, name: v }))}
                      placeholder="Clínica Dental Las Condes"
                      autoFocus
                    />
                    <Field
                      label="Teléfono"
                      value={clinic.phone}
                      onChange={(v) => setClinic((c) => ({ ...c, phone: v }))}
                      placeholder="+56 9 1234 5678"
                    />
                    <LocationSelector
                      region={clinic.region}
                      commune={clinic.commune}
                      onRegion={(r) => setClinic((c) => ({ ...c, region: r }))}
                      onCommune={(co) => setClinic((c) => ({ ...c, commune: co }))}
                    />
                    {error && <ErrorMsg msg={error} />}
                    <SubmitBtn label="Continuar" disabled={false} loading={false} />
                  </form>
                </>
              )}

              {step === 2 && (
                <>
                  <div className="mb-7">
                    <button
                      onClick={() => setStep(1)}
                      className="text-xs mb-4 flex items-center gap-1 transition-opacity hover:opacity-70"
                      style={{ color: "var(--ink-muted, #607281)" }}
                    >
                      ← Volver
                    </button>
                    <h2 className="font-[family-name:var(--font-display,sans-serif)] text-2xl font-bold"
                      style={{ color: "var(--ink, #0C1B26)" }}>
                      Crea tu cuenta de acceso
                    </h2>
                    <p className="text-sm mt-1.5" style={{ color: "var(--ink-muted, #607281)" }}>
                      Administrarás {clinic.name} con estos datos
                    </p>
                  </div>
                  <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <Field
                      label="Tu nombre"
                      value={admin.name}
                      onChange={(v) => setAdmin((a) => ({ ...a, name: v }))}
                      placeholder="María González"
                      autoFocus
                    />
                    <Field
                      label="Correo electrónico"
                      type="email"
                      value={admin.email}
                      onChange={(v) => setAdmin((a) => ({ ...a, email: v }))}
                      placeholder="admin@tuclinica.cl"
                    />
                    <Field
                      label="Contraseña"
                      type="password"
                      value={admin.password}
                      onChange={(v) => setAdmin((a) => ({ ...a, password: v }))}
                      placeholder="Mínimo 8 caracteres"
                    />
                    <Field
                      label="Confirmar contraseña"
                      type="password"
                      value={admin.confirm}
                      onChange={(v) => setAdmin((a) => ({ ...a, confirm: v }))}
                      placeholder="Repite tu contraseña"
                    />
                    <label className="flex items-start gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={acceptedTerms}
                        onChange={(e) => setAcceptedTerms(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded accent-teal-700 shrink-0"
                      />
                      <span className="text-xs leading-relaxed" style={{ color: "var(--ink-muted, #607281)" }}>
                        Acepto los{" "}
                        <Link href="/legal/terminos" target="_blank" className="underline underline-offset-2 font-medium hover:opacity-70">
                          Términos y Condiciones
                        </Link>{" "}
                        y la{" "}
                        <Link href="/legal/privacidad" target="_blank" className="underline underline-offset-2 font-medium hover:opacity-70">
                          Política de Privacidad
                        </Link>{" "}
                        de molari.ai
                      </span>
                    </label>
                    {error && <ErrorMsg msg={error} />}
                    <SubmitBtn
                      label="Crear cuenta y ver mi demo"
                      disabled={loading || !acceptedTerms}
                      loading={loading}
                    />
                  </form>
                </>
              )}
            </div>

            <p className="text-center text-xs mt-5" style={{ color: "var(--ink-muted, #607281)" }}>
              Al registrarte aceptas los{" "}
              <Link href="#" className="underline underline-offset-2">términos de uso</Link>{" "}
              de molari.ai
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function Field({
  label, value, onChange, placeholder, type = "text", autoFocus,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; autoFocus?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
        style={{ color: "var(--ink-muted, #607281)" }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 rounded-xl border text-sm transition focus:outline-none focus:ring-2"
        style={{
          borderColor: "#E5E0D9",
          backgroundColor: "var(--surface, #F7F5F1)",
          color: "var(--ink, #0C1B26)",
        } as React.CSSProperties}
        onFocus={(e) => {
          e.target.style.borderColor = "var(--teal-mid, #1A5C7A)";
          e.target.style.backgroundColor = "white";
        }}
        onBlur={(e) => {
          e.target.style.borderColor = "#E5E0D9";
          e.target.style.backgroundColor = "var(--surface, #F7F5F1)";
        }}
      />
    </div>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <p className="text-xs px-4 py-3 rounded-xl border"
      style={{ color: "#c0392b", backgroundColor: "#fef2f2", borderColor: "#fecaca" }}>
      {msg}
    </p>
  );
}

function SubmitBtn({ label, disabled, loading }: { label: string; disabled: boolean; loading: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="w-full font-semibold py-3.5 rounded-xl text-sm text-white mt-2 transition-opacity hover:opacity-90 disabled:opacity-50"
      style={{ backgroundColor: "var(--teal-mid, #1A5C7A)" }}
    >
      {loading ? "Creando cuenta..." : label}
    </button>
  );
}
