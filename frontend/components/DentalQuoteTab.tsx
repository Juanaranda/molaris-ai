"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken, getMe, updateClinic } from "@/lib/auth";
import { ensurePatientId } from "@/lib/clinicalRecord";
import { getOdontogram, type ToothProjection } from "@/lib/odontogram";
import { Odontogram, type DentitionType } from "./Odontogram";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";


const SURFACES = ["V", "D", "O", "M", "P"] as const;
const SURF_LABEL: Record<string, string> = {
  V: "Vestibular", D: "Distal", O: "Oclusal", M: "Mesial", P: "Palatino/Lingual",
};

/* ─── Prestaciones ───────────────────────────────────────────────────────── */
const PRESTACION_CATEGORIES = [
  "Todas", "Diagnóstico", "Higiene", "Restauración",
  "Endodoncia", "Cirugía", "Implantes", "Ortodoncia", "Estética", "Prótesis",
] as const;
type PrestacionCategory = typeof PRESTACION_CATEGORIES[number];
// scope "per_arch" = se realiza una sola vez (boca completa, arcada o visita)
// scope "per_tooth" = se aplica por pieza dental
interface Prestacion { name: string; price: number; category: PrestacionCategory; scope?: "per_tooth" | "per_arch" }

const DEFAULT_PRESTACIONES: Prestacion[] = [
  { name: "Consulta general",         price: 15000,   category: "Diagnóstico",  scope: "per_arch"  },
  { name: "Radiografía periapical",   price: 8000,    category: "Diagnóstico",  scope: "per_tooth" },
  { name: "Radiografía panorámica",   price: 25000,   category: "Diagnóstico",  scope: "per_arch"  },
  { name: "Limpieza dental",          price: 35000,   category: "Higiene",      scope: "per_arch"  },
  { name: "Obturación (resina)",      price: 45000,   category: "Restauración", scope: "per_tooth" },
  { name: "Corona cerámica",          price: 350000,  category: "Restauración", scope: "per_tooth" },
  { name: "Corona metalcerámica",     price: 280000,  category: "Restauración", scope: "per_tooth" },
  { name: "Carilla de porcelana",     price: 450000,  category: "Restauración", scope: "per_tooth" },
  { name: "Endodoncia unirradicular", price: 180000,  category: "Endodoncia",   scope: "per_tooth" },
  { name: "Endodoncia birradicular",  price: 220000,  category: "Endodoncia",   scope: "per_tooth" },
  { name: "Endodoncia multirrad.",    price: 260000,  category: "Endodoncia",   scope: "per_tooth" },
  { name: "Extracción simple",        price: 35000,   category: "Cirugía",      scope: "per_tooth" },
  { name: "Extracción quirúrgica",    price: 80000,   category: "Cirugía",      scope: "per_tooth" },
  { name: "Implante dental",          price: 750000,  category: "Implantes",    scope: "per_tooth" },
  { name: "Corona sobre implante",    price: 350000,  category: "Implantes",    scope: "per_tooth" },
  { name: "Ortodoncia (setup)",       price: 1200000, category: "Ortodoncia",   scope: "per_arch"  },
  { name: "Control ortodoncia",       price: 30000,   category: "Ortodoncia",   scope: "per_arch"  },
  { name: "Blanqueamiento clínico",   price: 120000,  category: "Estética",     scope: "per_arch"  },
  { name: "Prótesis removible",       price: 320000,  category: "Prótesis",     scope: "per_arch"  },
];

export interface ClinicService {
  name: string;
  pricingType?: "fixed" | "range" | "variable";
  price?: string;
  priceMin?: string;
  priceMax?: string;
}

function parseClinicPrice(s: string | undefined): number {
  if (!s) return 0;
  return parseInt(s.replace(/[^0-9]/g, ""), 10) || 0;
}

function buildPrestaciones(clinicServices?: ClinicService[]): Prestacion[] {
  if (!clinicServices || clinicServices.length === 0) return DEFAULT_PRESTACIONES;
  const list = clinicServices
    .filter((s) => s.pricingType !== "variable")
    .map((s) => ({ name: s.name, price: parseClinicPrice(s.price ?? s.priceMin), category: "Restauración" as PrestacionCategory }))
    .filter((s) => s.price > 0);
  return list.length > 0 ? list : DEFAULT_PRESTACIONES;
}

const fmtCLP = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${Math.round(n / 1_000)}k`;

// FDI se guarda como "1.8" pero se muestra sin punto: "18"
const fdiLabel = (s: string) => s.replace(".", "");

/* ─── Quote types ────────────────────────────────────────────────────────── */
interface QuoteItem {
  id?: string;
  toothFDI: string | null;
  surfaces: string | null;
  prestacion: string;
  unitPrice: number;
  quantity: number;
  discount: number;
  total: number;
}

// surfaces excluded — computed per-tooth from surfacesByTooth at add time
interface AddItemBase {
  prestacion: string;
  unitPrice: number;
  quantity: number;
  discount: number;
}

interface DentalQuote {
  id: string;
  patientRut: string | null;
  patientName: string;
  doctor: string | null;
  status: string;
  discount: number;
  totalAmount: number;
  notes: string | null;
  paymentInfo: string | null;
  accepted: boolean;
  sentAt: string | null;
  createdAt: string;
  items: QuoteItem[];
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  draft:    { label: "Borrador",  cls: "bg-gray-100 text-gray-500"      },
  sent:     { label: "Enviado",   cls: "bg-blue-50 text-blue-700"       },
  accepted: { label: "Aceptado",  cls: "bg-emerald-50 text-emerald-700" },
  rejected: { label: "Rechazado", cls: "bg-red-50 text-red-600"         },
};


/* ─── Add item form ──────────────────────────────────────────────────────── */
function AddItemForm({
  selectedTeeth,
  activeToothFdi,
  surfacesByTooth,
  onToggleSurface,
  onSetActiveTooth,
  prestaciones,
  onAdd,
  onAddAll,
  onAddOnce,
  onSavePriceToClinic,
}: {
  selectedTeeth: Set<string>;
  activeToothFdi: string | null;
  surfacesByTooth: Map<string, string[]>;
  onToggleSurface: (fdi: string, surface: string) => void;
  onSetActiveTooth: (fdi: string) => void;
  prestaciones: Prestacion[];
  onAdd: (item: AddItemBase) => void;
  onAddAll: (item: AddItemBase) => void;
  onAddOnce: (item: AddItemBase) => void;
  /** Guardar el precio en el catálogo de la clínica (acción explícita). */
  onSavePriceToClinic?: (nombre: string, precio: number) => Promise<void>;
}) {
  const [prestacion, setPrestacion]             = useState("");
  const [customPrestacion, setCustomPrestacion] = useState("");
  const [unitPrice, setUnitPrice]               = useState("");
  const [quantity, setQuantity]                 = useState("1");
  const [discount, setDiscount]                 = useState("0");
  const [category, setCategory]                 = useState<PrestacionCategory>("Todas");
  const [guardandoPrecio, setGuardandoPrecio]   = useState(false);
  const [precioGuardado, setPrecioGuardado]     = useState(false);

  const hasCategories = prestaciones.some((p) => p.category !== "Restauración");
  const filtered = hasCategories && category !== "Todas"
    ? prestaciones.filter((p) => p.category === category)
    : prestaciones;

  const selectedPreset = prestaciones.find((p) => p.name === prestacion);

  /* Al elegir una prestación se precarga su precio en el campo, para que el
     dentista lo VEA y pueda ajustarlo en esta cotización. Antes el precio del
     catálogo pisaba lo que se escribía, así que un caso puntual no se podía
     cotizar distinto. */
  useEffect(() => {
    if (selectedPreset) setUnitPrice(selectedPreset.price ? String(selectedPreset.price) : "");
  }, [prestacion]);   // eslint-disable-line react-hooks/exhaustive-deps

  const precioEscrito = parseFloat(unitPrice) || 0;
  /* El precio de esta cotización difiere del catálogo (o la prestación no
     tenía precio): recién ahí ofrecemos guardarlo como precio de la clínica. */
  const precioDifiere = Boolean(
    selectedPreset && precioEscrito > 0 && precioEscrito !== selectedPreset.price
  );
  const teethArr = Array.from(selectedTeeth);
  const teethCount = teethArr.length;

  // Detectar si la prestación seleccionada es por boca (no por pieza)
  const isPerArch = selectedPreset?.scope === "per_arch";
  const showArchWarning = isPerArch && teethCount > 1;

  // Surfaces are per-tooth and shown only for the active tooth
  const activeSurfaces = activeToothFdi ? (surfacesByTooth.get(activeToothFdi) ?? []) : [];

  function buildBase(): AddItemBase | null {
    const name  = prestacion === "__custom__" ? customPrestacion : prestacion;
    // Gana lo escrito: es el precio de ESTA cotización. El del catálogo solo
    // sirve como valor inicial.
    const price = parseFloat(unitPrice) || selectedPreset?.price || 0;
    if (!name || !price) return null;
    return { prestacion: name, unitPrice: price, quantity: parseInt(quantity) || 1, discount: parseFloat(discount) || 0 };
  }

  function resetForm() {
    setPrestacion(""); setCustomPrestacion(""); setUnitPrice("");
    setQuantity("1"); setDiscount("0");
  }

  function handleAdd() {
    const base = buildBase();
    if (!base) return;
    onAdd(base);
    resetForm();
  }

  function handleAddAll() {
    const base = buildBase();
    if (!base) return;
    onAddAll(base);
    resetForm();
  }

  // Para prestaciones per_arch con muchas piezas: agregar una sola vez sin pieza específica
  function handleAddArchOnce() {
    const base = buildBase();
    if (!base) return;
    onAddOnce(base);
    resetForm();
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col gap-3">

      {/* Tooth pills — one per selected tooth, click to activate */}
      {teethCount > 0 ? (
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">
            Piezas seleccionadas
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {teethArr.map((fdi) => {
              const surfs = surfacesByTooth.get(fdi) ?? [];
              const isActive = fdi === activeToothFdi;
              return (
                <button key={fdi} onClick={() => onSetActiveTooth(fdi)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border transition"
                  style={isActive
                    ? { background: "#1A5C7A", color: "#fff", borderColor: "#1A5C7A" }
                    : { background: "#EFF6FF", color: "#1d4ed8", borderColor: "#BFDBFE" }}>
                  {fdiLabel(fdi)}
                  {surfs.length > 0 && (
                    <span style={{ fontSize: 8, opacity: 0.8 }}>· {surfs.join(",")}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-gray-300 shrink-0" />
          <p className="text-xs font-bold text-gray-400">Sin pieza específica</p>
        </div>
      )}

      {/* Surface picker — for the active tooth */}
      {activeToothFdi && (
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">
            Superficies · pieza <span style={{ color: "#1A5C7A" }}>{fdiLabel(activeToothFdi)}</span>
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {SURFACES.map((s) => (
              <button key={s} onClick={() => onToggleSurface(activeToothFdi, s)} title={SURF_LABEL[s]}
                className="px-2 py-1 rounded-lg text-[10px] font-bold border transition"
                style={activeSurfaces.includes(s)
                  ? { background: "#1A5C7A", color: "#fff", borderColor: "#1A5C7A" }
                  : { background: "#F7F5F1", color: "#607281", borderColor: "#E5E0D9" }}>
                {s}
              </button>
            ))}
          </div>
          {teethCount > 1 && (
            <p className="text-[9px] text-gray-400 mt-1">
              Selecciona otra pieza arriba para configurar sus superficies individualmente
            </p>
          )}
        </div>
      )}

      {/* Category filter */}
      {hasCategories && (
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Categoría</p>
          <div className="flex gap-1 flex-wrap">
            {PRESTACION_CATEGORIES.map((cat) => (
              <button key={cat}
                onClick={() => { setCategory(cat); setPrestacion(""); setUnitPrice(""); }}
                className="px-2 py-0.5 rounded text-[10px] font-semibold transition border"
                style={category === cat
                  ? { background: "#1A5C7A", color: "#fff", borderColor: "#1A5C7A" }
                  : { background: "#F8FAFC", color: "#64748B", borderColor: "#E2E8F0" }}>
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Prestación</p>
        <select value={prestacion}
          onChange={(e) => {
            setPrestacion(e.target.value);
            const preset = prestaciones.find((p) => p.name === e.target.value);
            if (preset) setUnitPrice(String(preset.price));
            else setUnitPrice("");
          }}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="">Seleccionar prestación…</option>
          {filtered.map((p) => (
            <option key={p.name} value={p.name}>{p.name} — {fmtCLP(p.price)}</option>
          ))}
          <option value="__custom__">+ Otra (personalizada)</option>
        </select>
        {prestacion === "__custom__" && (
          <input value={customPrestacion} onChange={(e) => setCustomPrestacion(e.target.value)}
            placeholder="Nombre de la prestación"
            className="mt-2 w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400" />
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Precio CLP</p>
          <input type="number" value={unitPrice}
            onChange={(e) => { setUnitPrice(e.target.value); setPrecioGuardado(false); }} placeholder="0"
            className="w-full px-2 py-1.5 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Cant.</p>
          <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)}
            className="w-full px-2 py-1.5 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Dcto %</p>
          <input type="number" min="0" max="100" value={discount} onChange={(e) => setDiscount(e.target.value)}
            className="w-full px-2 py-1.5 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
      </div>

      {/* Guardar el precio en el catálogo — acción SEPARADA y explícita.
          El catálogo es lo que el agente le informa a los pacientes por
          WhatsApp: ajustar un caso puntual no debe cambiarlo sin querer. */}
      {onSavePriceToClinic && precioDifiere && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-100">
          <span className="text-[11px] text-amber-900 flex-1">
            Este precio difiere del catálogo ({fmtCLP(selectedPreset!.price)}). Se usará solo en esta cotización.
          </span>
          {precioGuardado ? (
            <span className="text-[11px] font-bold text-emerald-700 shrink-0">Catálogo actualizado</span>
          ) : (
            <button
              onClick={async () => {
                setGuardandoPrecio(true);
                try {
                  await onSavePriceToClinic(selectedPreset!.name, precioEscrito);
                  setPrecioGuardado(true);
                } catch (e) {
                  alert(e instanceof Error ? e.message : "No se pudo actualizar el catálogo");
                } finally { setGuardandoPrecio(false); }
              }}
              disabled={guardandoPrecio}
              className="text-[11px] font-bold px-2.5 py-1 rounded-lg border border-amber-300 text-amber-900 hover:bg-amber-100 transition disabled:opacity-50 shrink-0">
              {guardandoPrecio ? "Guardando…" : "Actualizar en la clínica"}
            </button>
          )}
        </div>
      )}

      {/* Aviso per_arch cuando hay múltiples piezas seleccionadas */}
      {showArchWarning && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200">
          <span className="text-amber-500 text-sm shrink-0 mt-0.5">⚠</span>
          <div>
            <p className="text-[11px] font-bold text-amber-700">Prestación por boca completa</p>
            <p className="text-[10px] text-amber-600 mt-0.5">
              "{selectedPreset?.name}" se realiza una sola vez, no por pieza.
              Usa el botón de abajo para agregarla correctamente.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {showArchWarning ? (
          /* Modo per_arch con múltiples piezas: solo ofrecer agregar una vez */
          <button onClick={handleAddArchOnce}
            disabled={!prestacion || (!selectedPreset && !unitPrice && !customPrestacion)}
            className="w-full py-2 rounded-xl text-xs font-bold text-white transition disabled:opacity-40"
            style={{ background: "#B45309" }}>
            + Agregar una vez (boca completa) — {selectedPreset ? fmtCLP(selectedPreset.price) : ""}
          </button>
        ) : (
          <>
            <button onClick={handleAdd}
              disabled={!prestacion || (!selectedPreset && !unitPrice && !customPrestacion)}
              className="w-full py-2 rounded-xl text-xs font-bold text-white transition disabled:opacity-40"
              style={{ background: "#1A5C7A" }}>
              {activeToothFdi
                ? `+ Agregar a pieza ${fdiLabel(activeToothFdi)}`
                : "+ Agregar al presupuesto (sin pieza)"}
            </button>
            {teethCount > 1 && !isPerArch && (
              <button onClick={handleAddAll}
                disabled={!prestacion || (!selectedPreset && !unitPrice && !customPrestacion)}
                className="w-full py-1.5 rounded-xl text-xs font-semibold text-gray-500 border border-gray-200 hover:bg-gray-50 transition disabled:opacity-40">
                Aplicar misma prestación a las {teethCount} piezas seleccionadas
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Quote builder modal ────────────────────────────────────────────────── */
function QuoteBuilderModal({
  patient, clinicServices, existing, onClose, onSaved,
}: {
  patient: { name: string; rut: string | null };
  clinicServices?: ClinicService[];
  /** Presupuesto a editar. Si no viene, el modal crea uno nuevo. */
  existing?: DentalQuote;
  onClose: () => void;
  onSaved: (q: DentalQuote) => void;
}) {
  const isEdit = existing !== undefined;

  // Al editar se reconstruyen los dientes seleccionados y sus caras desde los
  // ítems guardados, para que el odontograma muestre el mismo contexto con el
  // que se armó el presupuesto y no aparezca vacío.
  const [selectedTeeth, setSelectedTeeth] = useState<Set<string>>(
    () => new Set((existing?.items ?? []).map((i) => i.toothFDI).filter((t): t is string => !!t)),
  );
  const [activeToothFdi, setActiveToothFdi] = useState<string | null>(null);
  const [surfacesByTooth, setSurfacesByTooth] = useState<Map<string, string[]>>(() => {
    const m = new Map<string, string[]>();
    for (const i of existing?.items ?? []) {
      if (i.toothFDI && i.surfaces) m.set(i.toothFDI, i.surfaces.split(","));
    }
    return m;
  });
  const [missingTeeth, setMissingTeeth]   = useState<Set<string>>(new Set());
  const [dentitionType, setDentitionType] = useState<DentitionType>("definitiva");
  const router = useRouter();
  const [abriendoFicha, setAbriendoFicha] = useState(false);
  const [errorFicha, setErrorFicha]       = useState("");
  const [clinicalTeeth, setClinicalTeeth] = useState<Record<string, ToothProjection>>({});

  /**
   * Trae los hallazgos de la ficha para pintarlos sobre el odontograma del
   * presupuesto. El objetivo del odontograma es justamente terminar en un
   * presupuesto: sin esto, el dentista cotiza mirando dientes en blanco y
   * tiene que acordarse de lo que acaba de diagnosticar.
   *
   * Es información de apoyo, así que si falla no se interrumpe el flujo:
   * el presupuesto se puede armar igual.
   */
  useEffect(() => {
    let vivo = true;
    (async () => {
      if (!patient.rut) return;
      try {
        const me = await getMe();
        if (!me?.clinic?.id) return;
        const patientId = await ensurePatientId(me.clinic.id, { rut: patient.rut });
        const odo = await getOdontogram(patientId);
        if (vivo) setClinicalTeeth(odo.teeth ?? {});
      } catch {
        // sin hallazgos disponibles — el presupuesto sigue funcionando
      }
    })();
    return () => { vivo = false; };
  }, [patient.rut]);

  /**
   * Guarda el precio en el catálogo de la clínica (config.services).
   *
   * Es una acción aparte y explícita: ese catálogo es el que el agente usa
   * para informarle precios a los pacientes por WhatsApp. Ajustar un caso
   * puntual en una cotización NO debe cambiar lo que se le dice a todos.
   */
  async function guardarPrecioEnClinica(nombre: string, precio: number) {
    const me = await getMe();
    const clinic = me?.clinic;
    if (!clinic?.id) throw new Error("Sin clínica activa");

    const cfg = (clinic.config ?? {}) as { services?: ClinicService[] };
    const actuales = cfg.services ?? [];
    const fmt = `$${precio.toLocaleString("es-CL")}`;

    const existe = actuales.some((sv) => sv.name === nombre);
    const services: ClinicService[] = existe
      ? actuales.map((sv) => sv.name === nombre ? { ...sv, pricingType: "fixed" as const, price: fmt, priceMin: undefined, priceMax: undefined } : sv)
      // Si la prestación no estaba en el catálogo, se agrega: así el precio
      // queda disponible la próxima vez en vez de perderse.
      : [...actuales, { name: nombre, pricingType: "fixed" as const, price: fmt }];

    await updateClinic(clinic.id, { config: { ...cfg, services } as Record<string, unknown> });
  }

  /**
   * Abre la ficha clínica del paciente. Usa ensurePatientId porque el
   * presupuesto trabaja con RUT/nombre y la ficha con el id de Patient: si el
   * paciente todavía no tiene ficha, se crea al vuelo en vez de fallar.
   */
  async function abrirFichaClinica() {
    setAbriendoFicha(true); setErrorFicha("");
    try {
      const me = await getMe();
      if (!me?.clinic?.id) throw new Error("Sin clínica activa");
      // El presupuesto solo conoce nombre y RUT; sin RUT no hay forma de
      // identificar la ficha con certeza y es mejor decirlo que abrir la de otro.
      if (!patient.rut) throw new Error("El paciente necesita RUT para abrir su ficha clínica");
      const patientId = await ensurePatientId(me.clinic.id, { rut: patient.rut });
      router.push(`/partners/pacientes/${patientId}`);
    } catch (e) {
      setErrorFicha(e instanceof Error ? e.message : "No se pudo abrir la ficha");
      setAbriendoFicha(false);
    }
  }
  const [items, setItems]                 = useState<Omit<QuoteItem, "id">[]>(
    () => (existing?.items ?? []).map(({ id: _id, ...rest }) => rest),
  );
  const [generalDiscount, setGeneralDiscount] = useState(existing?.discount ?? 0);
  const [notes, setNotes]                 = useState(existing?.notes ?? "");
  const [paymentInfo, setPaymentInfo]     = useState(existing?.paymentInfo ?? "");
  const [saving, setSaving]               = useState(false);
  const [error, setError]                 = useState("");
  const [doctor, setDoctor]               = useState(existing?.doctor ?? "");
  const [DOCTORS, setDoctors]             = useState<string[]>([]);

  useEffect(() => {
    import("@/lib/auth").then(({ getMe }) =>
      getMe().then((data) => {
        const cfg = data?.clinic?.config as { doctors?: { name: string }[] } | undefined;
        if (cfg?.doctors) setDoctors(cfg.doctors.map((d) => d.name));
      })
    );
  }, []);

  const prestaciones = buildPrestaciones(clinicServices);

  function handleToggleTooth(fdi: string) {
    setSelectedTeeth((prev) => {
      const next = new Set(prev);
      if (next.has(fdi)) {
        next.delete(fdi);
        setSurfacesByTooth((sm) => { const m = new Map(sm); m.delete(fdi); return m; });
        if (activeToothFdi === fdi) {
          const rem = Array.from(next);
          setActiveToothFdi(rem.length > 0 ? rem[rem.length - 1] : null);
        }
      } else {
        next.add(fdi);
        setActiveToothFdi(fdi);
      }
      return next;
    });
  }

  function handleSetTeeth(teeth: Set<string>) {
    setSelectedTeeth(teeth);
    setSurfacesByTooth(new Map());
    const arr = Array.from(teeth);
    setActiveToothFdi(arr.length > 0 ? arr[arr.length - 1] : null);
  }

  function handleToggleSurface(fdi: string, surface: string) {
    setSurfacesByTooth((prev) => {
      const next = new Map(prev);
      const cur = next.get(fdi) ?? [];
      if (cur.includes(surface)) next.set(fdi, cur.filter((s) => s !== surface));
      else next.set(fdi, [...cur, surface]);
      return next;
    });
  }

  function addItemToActive(base: AddItemBase) {
    const tooth = activeToothFdi;
    const surfs = tooth ? (surfacesByTooth.get(tooth) ?? []) : [];
    const total = base.unitPrice * base.quantity * (1 - base.discount / 100);
    setItems((prev) => [...prev, { ...base, toothFDI: tooth, surfaces: surfs.length > 0 ? surfs.join(",") : null, total }]);
    // advance to next unprocessed tooth, or clear if last
    const arr = Array.from(selectedTeeth);
    const idx  = tooth ? arr.indexOf(tooth) : -1;
    if (idx >= 0 && idx < arr.length - 1) {
      setActiveToothFdi(arr[idx + 1]);
    } else {
      setSelectedTeeth(new Set());
      setSurfacesByTooth(new Map());
      setActiveToothFdi(null);
    }
  }

  function addItemsToAll(base: AddItemBase) {
    const teeth: (string | null)[] = selectedTeeth.size > 0 ? Array.from(selectedTeeth) : [null];
    const newItems: Omit<QuoteItem, "id">[] = teeth.map((toothFDI) => {
      const surfs = toothFDI ? (surfacesByTooth.get(toothFDI) ?? []) : [];
      const total = base.unitPrice * base.quantity * (1 - base.discount / 100);
      return { ...base, toothFDI, surfaces: surfs.length > 0 ? surfs.join(",") : null, total };
    });
    setItems((prev) => [...prev, ...newItems]);
    setSelectedTeeth(new Set());
    setSurfacesByTooth(new Map());
    setActiveToothFdi(null);
  }

  // Prestaciones por boca (per_arch): agregar una sola vez sin pieza específica
  function addArchItem(base: AddItemBase) {
    const total = base.unitPrice * base.quantity * (1 - base.discount / 100);
    setItems((prev) => [...prev, { ...base, toothFDI: null, surfaces: null, total }]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  const subtotal   = items.reduce((s, i) => s + i.total, 0);
  const totalFinal = subtotal * (1 - generalDiscount / 100);

  const itemsByTooth: Record<string, number> = {};
  for (const item of items) {
    if (item.toothFDI) itemsByTooth[item.toothFDI] = (itemsByTooth[item.toothFDI] ?? 0) + 1;
  }

  async function handleSave() {
    if (items.length === 0) { setError("Agrega al menos una prestación"); return; }
    setSaving(true); setError("");
    try {
      const token = getToken();
      const payloadItems = items.map((i) => ({
        toothFDI:   i.toothFDI ?? undefined,
        surfaces:   i.surfaces ?? undefined,
        prestacion: i.prestacion,
        unitPrice:  i.unitPrice,
        quantity:   i.quantity,
        discount:   i.discount,
      }));
      // Al editar se manda solo lo modificable: el paciente del presupuesto no
      // cambia. Las cadenas vacías van como "" y no undefined, para poder
      // borrar una nota o una forma de pago que ya estaba escrita.
      const res = await fetch(
        isEdit ? `${API}/api/dental-quotes/${existing.id}` : `${API}/api/dental-quotes`,
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(
            isEdit
              ? {
                  doctor,
                  discount:    generalDiscount,
                  notes,
                  paymentInfo,
                  items: payloadItems,
                }
              : {
                  patientRut:  patient.rut ?? undefined,
                  patientName: patient.name,
                  doctor:      doctor || undefined,
                  discount:    generalDiscount,
                  notes:       notes || undefined,
                  paymentInfo: paymentInfo || undefined,
                  items: payloadItems,
                },
          ),
        },
      );
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Error al guardar"); return; }
      onSaved(data);
    } catch {
      setError("Error de conexión");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-gray-50 rounded-2xl border border-gray-200 shadow-2xl w-full max-w-5xl my-4 overflow-hidden">
        <div className="px-6 py-4 bg-white border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-black text-gray-900">
              {isEdit ? "Editar presupuesto dental" : "Nuevo presupuesto dental"}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">{patient.name}{patient.rut ? ` · ${patient.rut}` : ""}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Para presupuestar hay que saber qué tiene el paciente: este es el
                camino a los hallazgos clínicos sin perder el presupuesto. */}
            <button onClick={abrirFichaClinica} disabled={abriendoFicha}
              title="Ver hallazgos y odontograma clínico del paciente"
              className="text-xs font-bold px-3 py-1.5 rounded-xl border border-gray-200 text-gray-600 hover:border-[#1A5C7A] hover:text-[#1A5C7A] transition disabled:opacity-50">
              🩺 {abriendoFicha ? "Abriendo…" : "Ver ficha clínica"}
            </button>
            <button onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 transition flex items-center justify-center text-gray-500">
              ✕
            </button>
          </div>
        </div>
        {errorFicha && (
          <p className="px-6 py-2 text-xs text-red-600 bg-red-50 border-b border-red-100">{errorFicha}</p>
        )}

        <div className="p-4 flex flex-col gap-4">
          <Odontogram
            selectedTeeth={selectedTeeth} activeToothFdi={activeToothFdi}
            onToggleTooth={handleToggleTooth} onSetTeeth={handleSetTeeth}
            missingTeeth={missingTeeth}       setMissingTeeth={setMissingTeeth}
            dentitionType={dentitionType}     setDentitionType={setDentitionType}
            itemsByTooth={itemsByTooth}
            clinicalTeeth={clinicalTeeth}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="flex flex-col gap-3">
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Doctor responsable</p>
                <select value={doctor} onChange={(e) => setDoctor(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
                  <option value="">Sin asignar</option>
                  {DOCTORS.map((d) => <option key={d} value={d}>{d.replace(/Dra?\. /, "")}</option>)}
                </select>
              </div>

              <AddItemForm
                selectedTeeth={selectedTeeth}
                activeToothFdi={activeToothFdi}
                surfacesByTooth={surfacesByTooth}
                onToggleSurface={handleToggleSurface}
                onSetActiveTooth={setActiveToothFdi}
                prestaciones={prestaciones}
                onAdd={addItemToActive}
                onAddAll={addItemsToAll}
                onAddOnce={addArchItem}
                onSavePriceToClinic={guardarPrecioEnClinica}
              />
            </div>

            <div className="flex flex-col gap-3">
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden flex flex-col">
                <div className="px-4 py-3 border-b border-gray-50">
                  <p className="text-xs font-bold text-gray-800">Prestaciones ({items.length})</p>
                </div>
                {items.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6">Sin prestaciones — selecciona pieza y agrega arriba</p>
                ) : (
                  <div className="divide-y divide-gray-50 overflow-y-auto" style={{ maxHeight: 260 }}>
                    {items.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2 px-4 py-2.5">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {item.toothFDI && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                                {fdiLabel(item.toothFDI)}
                              </span>
                            )}
                            {item.surfaces && item.surfaces.split(",").map((s) => (
                              <span key={s} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{s}</span>
                            ))}
                          </div>
                          <p className="text-xs font-semibold text-gray-800 mt-0.5">{item.prestacion}</p>
                          <p className="text-[10px] text-gray-400">
                            {fmtCLP(item.unitPrice)}
                            {item.quantity > 1 && ` × ${item.quantity}`}
                            {item.discount > 0 && ` · ${item.discount}% dto`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-bold text-gray-700">{fmtCLP(item.total)}</span>
                          <button onClick={() => removeItem(idx)}
                            className="text-gray-300 hover:text-red-500 transition text-sm leading-none">✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Subtotal</span>
                  <span className="font-semibold text-gray-800">{fmtCLP(subtotal)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 shrink-0">Descuento general</span>
                  <div className="flex items-center gap-1 flex-1">
                    <input type="range" min="0" max="50" value={generalDiscount}
                      onChange={(e) => setGeneralDiscount(Number(e.target.value))} className="flex-1 accent-blue-600" />
                    <span className="text-xs font-bold text-blue-600 w-8 text-right">{generalDiscount}%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-gray-50">
                  <span className="text-sm font-bold text-gray-900">Total</span>
                  <span className="text-lg font-black" style={{ color: "#1A5C7A" }}>{fmtCLP(totalFinal)}</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col gap-3">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Observaciones</p>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                    placeholder="Observaciones clínicas del presupuesto…"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Formas de pago</p>
                  <input value={paymentInfo} onChange={(e) => setPaymentInfo(e.target.value)}
                    placeholder="Ej: Efectivo, transferencia o hasta 3 cuotas"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
              </div>

              {error && <p className="text-xs text-red-600 font-medium px-1">{error}</p>}

              <button onClick={handleSave} disabled={saving || items.length === 0}
                className="w-full py-3 rounded-2xl text-sm font-black text-white transition disabled:opacity-40"
                style={{ background: "#1A5C7A", boxShadow: "0 4px 16px rgba(26,92,122,0.25)" }}>
                {saving ? "Guardando…" : `${isEdit ? "Guardar cambios" : "Guardar presupuesto"} · ${fmtCLP(totalFinal)}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Print helper ───────────────────────────────────────────────────────── */
function printQuote(quote: DentalQuote) {
  const MONTHS = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  const d = new Date(quote.createdAt);
  const dateStr = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  const fmt = (n: number) => n >= 1_000_000 ? `$${(n/1_000_000).toFixed(2)}M` : `$${Math.round(n/1_000)}k`;
  const rows = quote.items.map((item) => `
    <tr>
      <td>${item.toothFDI ? item.toothFDI.replace(".", "") : "General"}${item.surfaces ? ` (${item.surfaces})` : ""}</td>
      <td>${item.prestacion}</td>
      <td class="r">${fmt(item.unitPrice)}${item.quantity > 1 ? ` × ${item.quantity}` : ""}</td>
      <td class="r">${item.discount > 0 ? `${item.discount}%` : "—"}</td>
      <td class="r">${fmt(item.total)}</td>
    </tr>`).join("");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Presupuesto — ${quote.patientName}</title>
  <style>
    body{font-family:system-ui,sans-serif;padding:36px;max-width:680px;margin:0 auto;color:#111;font-size:13px}
    h1{font-size:20px;margin:0 0 4px}
    .sub{color:#666;font-size:12px;margin-bottom:24px}
    table{width:100%;border-collapse:collapse}
    th{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#888;border-bottom:2px solid #e5e7eb;padding:6px 4px;text-align:left}
    td{padding:8px 4px;border-bottom:1px solid #f3f4f6}
    .r{text-align:right}
    .total td{font-weight:700;font-size:15px;border-top:2px solid #111;border-bottom:none}
    .note{margin-top:24px;font-size:11px;color:#888}
    @media print{body{padding:16px}}
  </style></head><body>
  <h1>Presupuesto Dental</h1>
  <p class="sub">
    Paciente: <strong>${quote.patientName}</strong>${quote.patientRut ? ` &nbsp;·&nbsp; RUT: ${quote.patientRut}` : ""}${quote.doctor ? ` &nbsp;·&nbsp; Dr/a: ${quote.doctor}` : ""}<br>
    Fecha: ${dateStr}
  </p>
  <table>
    <thead><tr><th>Pieza</th><th>Prestación</th><th class="r">Precio unit.</th><th class="r">Dto.</th><th class="r">Total</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr class="total"><td colspan="4" class="r">Total${quote.discount > 0 ? ` (${quote.discount}% dto. general)` : ""}</td><td class="r">${fmt(quote.totalAmount)}</td></tr></tfoot>
  </table>
  ${quote.notes ? `<p class="note">Notas: ${quote.notes}</p>` : ""}
  ${quote.paymentInfo ? `<p class="note">Forma de pago: ${quote.paymentInfo}</p>` : ""}
  <p class="note">Generado con molari.ai</p>
  </body></html>`;
  const win = window.open("", "_blank", "width=800,height=600");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 300);
}

/* ─── Quote card ─────────────────────────────────────────────────────────── */
function QuoteCard({ quote, onStatusChange, onEdit }: {
  quote: DentalQuote;
  onStatusChange: (id: string, status: string) => void;
  onEdit: (q: DentalQuote) => void;
}) {
  const [expanded, setExpanded]         = useState(false);
  const [showEmail, setShowEmail]       = useState(false);
  const [emailInput, setEmailInput]     = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailMsg, setEmailMsg]         = useState("");

  const st = STATUS_LABELS[quote.status] ?? STATUS_LABELS.draft;
  const MONTHS = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  const d = new Date(quote.createdAt);
  const dateStr = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

  async function sendEmail() {
    if (!emailInput.trim()) return;
    setSendingEmail(true); setEmailMsg("");
    try {
      const token = getToken();
      const res = await fetch(`${API}/api/dental-quotes/${quote.id}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: emailInput.trim() }),
      });
      if (res.ok) { setEmailMsg("Enviado"); setShowEmail(false); setTimeout(() => setEmailMsg(""), 4000); }
      else setEmailMsg("Error al enviar");
    } catch { setEmailMsg("Error de conexión"); }
    finally { setSendingEmail(false); }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <button className="w-full text-left px-5 py-4 flex items-center gap-3" onClick={() => setExpanded(!expanded)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
            {quote.accepted && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">✓ Aceptado</span>
            )}
            <span className="text-[10px] text-gray-400">{dateStr}</span>
            {emailMsg === "Enviado" && <span className="text-[10px] text-blue-600 font-semibold">✉ Enviado</span>}
          </div>
          <p className="text-sm font-bold text-gray-800 mt-1">
            {quote.items.length} prestación{quote.items.length !== 1 ? "es" : ""}
            {quote.doctor && <span className="text-gray-400 font-normal"> · {quote.doctor.replace(/Dra?\. /, "")}</span>}
          </p>
          {quote.notes && <p className="text-[11px] text-gray-400 truncate">{quote.notes}</p>}
        </div>
        <div className="text-right shrink-0">
          <p className="text-base font-black" style={{ color: "#1A5C7A" }}>{fmtCLP(quote.totalAmount)}</p>
          {quote.discount > 0 && <p className="text-[10px] text-amber-600">{quote.discount}% dto</p>}
        </div>
        <span className="text-gray-300 text-sm ml-1">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="border-t border-gray-50">
          <div className="px-5 py-3 space-y-2">
            {quote.items.map((item, idx) => (
              <div key={item.id ?? idx} className="flex items-center gap-3">
                <div className="flex gap-1 flex-wrap w-20 shrink-0">
                  {item.toothFDI && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">{fdiLabel(item.toothFDI)}</span>
                  )}
                  {item.surfaces && item.surfaces.split(",").map((s) => (
                    <span key={s} className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{s}</span>
                  ))}
                  {!item.toothFDI && <span className="text-[9px] text-gray-300">General</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-700">{item.prestacion}</p>
                  <p className="text-[10px] text-gray-400">
                    {fmtCLP(item.unitPrice)}
                    {item.quantity > 1 && ` × ${item.quantity}`}
                    {item.discount > 0 && ` · ${item.discount}% dto`}
                  </p>
                </div>
                <span className="text-xs font-bold text-gray-700 shrink-0">{fmtCLP(item.total)}</span>
              </div>
            ))}
            {quote.paymentInfo && (
              <p className="text-[11px] text-gray-400 pt-3 border-t border-gray-50">💳 {quote.paymentInfo}</p>
            )}
          </div>

          <div className="px-5 py-3 border-t border-gray-50 flex gap-2 flex-wrap items-center">
            {quote.status !== "accepted" && (
              <>
                {quote.status === "draft" && (
                  <button onClick={() => onStatusChange(quote.id, "sent")}
                    className="text-xs font-bold px-3 py-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition">
                    Marcar como enviado
                  </button>
                )}
                {quote.status === "sent" && (
                  <button onClick={() => onStatusChange(quote.id, "accepted")}
                    className="text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition">
                    Paciente aceptó
                  </button>
                )}
                <button onClick={() => onStatusChange(quote.id, "rejected")}
                  className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition">
                  Rechazado
                </button>
              </>
            )}
            <div className="ml-auto flex items-center gap-2">
              {/* Un presupuesto aceptado ya no se edita: cambiarle el monto
                  después de que el paciente lo aprobó rompe el acuerdo. Para
                  modificarlo hay que emitir uno nuevo. */}
              {!quote.accepted && (
                <button onClick={() => onEdit(quote)}
                  className="text-xs font-semibold text-gray-500 hover:text-gray-700">
                  ✏️ Editar
                </button>
              )}
              <button onClick={() => printQuote(quote)}
                className="text-xs font-semibold text-gray-500 hover:text-gray-700">
                🖨 Imprimir
              </button>
              {emailMsg && emailMsg !== "Enviado" && <span className="text-[10px] text-red-500">{emailMsg}</span>}
              {showEmail ? (
                <>
                  <input type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendEmail()}
                    placeholder="correo@paciente.cl" autoFocus
                    className="px-2 py-1 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 w-44" />
                  <button onClick={sendEmail} disabled={sendingEmail}
                    className="text-xs font-bold px-3 py-1.5 rounded-xl bg-[#1A5C7A] text-white hover:bg-[#0e4560] transition disabled:opacity-50">
                    {sendingEmail ? "…" : "Enviar"}
                  </button>
                  <button onClick={() => setShowEmail(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancelar</button>
                </>
              ) : (
                <button onClick={() => setShowEmail(true)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700">
                  ✉ Enviar por email
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main DentalQuoteTab ────────────────────────────────────────────────── */
export function DentalQuoteTab({
  patient, clinicServices,
}: {
  patient: { name: string; rut: string | null };
  clinicServices?: ClinicService[];
}) {
  const [quotes, setQuotes]           = useState<DentalQuote[]>([]);
  const [loading, setLoading]         = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editing, setEditing]         = useState<DentalQuote | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    const url = patient.rut
      ? `${API}/api/dental-quotes?patientRut=${encodeURIComponent(patient.rut)}`
      : `${API}/api/dental-quotes`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data: DentalQuote[]) => {
        setQuotes(patient.rut ? data : data.filter((q) => q.patientName === patient.name));
      })
      .finally(() => setLoading(false));
  }, [patient.rut, patient.name]);

  async function handleStatusChange(id: string, status: string) {
    const token = getToken();
    const res = await fetch(`${API}/api/dental-quotes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status, ...(status === "accepted" ? { accepted: true } : {}) }),
    });
    if (res.ok) {
      const updated = await res.json();
      setQuotes((prev) => prev.map((q) => (q.id === id ? updated : q)));
    }
  }

  const totalSent     = quotes.filter((q) => q.status !== "rejected").reduce((s, q) => s + q.totalAmount, 0);
  const totalAccepted = quotes.filter((q) => q.accepted).reduce((s, q) => s + q.totalAmount, 0);

  return (
    <div className="flex flex-col gap-3">
      {quotes.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-xl border border-gray-100 px-3 py-2.5 text-center">
            <p className="text-[9px] text-gray-400 font-bold uppercase">Presupuestos</p>
            <p className="text-lg font-black text-gray-800">{quotes.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 px-3 py-2.5 text-center">
            <p className="text-[9px] text-gray-400 font-bold uppercase">Total cotizado</p>
            <p className="text-base font-black" style={{ color: "#1A5C7A" }}>{fmtCLP(totalSent)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 px-3 py-2.5 text-center">
            <p className="text-[9px] text-gray-400 font-bold uppercase">Aceptado</p>
            <p className="text-base font-black text-emerald-600">{fmtCLP(totalAccepted)}</p>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={() => setShowBuilder(true)}
          className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 transition">
          <span className="text-base leading-none">+</span> Nuevo presupuesto
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : quotes.length === 0 ? (
        <div className="flex flex-col items-center py-8 gap-2">
          <p className="text-2xl">🦷</p>
          <p className="text-sm text-gray-400">Sin presupuestos aún</p>
          <button onClick={() => setShowBuilder(true)} className="text-xs font-bold text-blue-600 hover:underline mt-1">
            Crear el primero
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {quotes.map((q) => (
            <QuoteCard key={q.id} quote={q} onStatusChange={handleStatusChange} onEdit={setEditing} />
          ))}
        </div>
      )}

      {showBuilder && (
        <QuoteBuilderModal
          patient={patient} clinicServices={clinicServices}
          onClose={() => setShowBuilder(false)}
          onSaved={(q) => { setQuotes((prev) => [q, ...prev]); setShowBuilder(false); }}
        />
      )}

      {editing && (
        // key fuerza un remontaje al cambiar de presupuesto: el estado inicial
        // del modal se calcula una sola vez, así que sin esto reabrirlo con
        // otro presupuesto mostraría los ítems del anterior.
        <QuoteBuilderModal
          key={editing.id}
          patient={patient} clinicServices={clinicServices} existing={editing}
          onClose={() => setEditing(null)}
          onSaved={(q) => {
            setQuotes((prev) => prev.map((old) => (old.id === q.id ? q : old)));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
