"use client";

import { useEffect, useState } from "react";
import { getToken } from "@/lib/auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/* ─── FDI Odontogram layout ─────────────────────────────────────────────── */
// Upper right → left, lower left → right (standard dental chart orientation)
const UPPER_RIGHT = ["1.8","1.7","1.6","1.5","1.4","1.3","1.2","1.1"];
const UPPER_LEFT  = ["2.1","2.2","2.3","2.4","2.5","2.6","2.7","2.8"];
const LOWER_LEFT  = ["3.1","3.2","3.3","3.4","3.5","3.6","3.7","3.8"];
const LOWER_RIGHT = ["4.8","4.7","4.6","4.5","4.4","4.3","4.2","4.1"];

const SURFACES = ["V","D","O","M","P"] as const;
const SURF_LABEL: Record<string, string> = {
  V: "Vestibular", D: "Distal", O: "Oclusal", M: "Mesial", P: "Palatino/Lingual",
};

// Tooth type indicator for icon shape
function toothType(fdi: string): "molar" | "premolar" | "canine" | "incisor" {
  const n = parseInt(fdi.split(".")[1]);
  if (n >= 6) return "molar";
  if (n >= 4) return "premolar";
  if (n === 3) return "canine";
  return "incisor";
}

function ToothIcon({ fdi, selected, hasItems }: { fdi: string; selected: boolean; hasItems: boolean }) {
  const type = toothType(fdi);
  const w = type === "molar" ? 28 : type === "premolar" ? 24 : 20;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <span style={{ fontSize: 8, color: selected ? "#1A5C7A" : "#9ca3af", fontWeight: 700 }}>{fdi}</span>
      <div style={{
        width: w, height: type === "molar" ? 24 : 20,
        borderRadius: type === "incisor" ? "4px 4px 8px 8px" : type === "canine" ? "4px 4px 10px 10px" : "6px",
        background: selected ? "#1A5C7A" : hasItems ? "#DBEAFE" : "#F0EDE8",
        border: `2px solid ${selected ? "#1A5C7A" : hasItems ? "#3B82F6" : "#D9D4CC"}`,
        transition: "all 0.15s",
        cursor: "pointer",
        position: "relative",
      }}>
        {hasItems && !selected && (
          <div style={{ position: "absolute", top: -3, right: -3, width: 7, height: 7,
            borderRadius: "50%", background: "#3B82F6" }} />
        )}
      </div>
    </div>
  );
}

/* ─── Types ─────────────────────────────────────────────────────────────── */
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

/* ─── Default prestaciones (can be extended) ───────────────────────────── */
const DEFAULT_PRESTACIONES = [
  { name: "Consulta general",        price: 15000 },
  { name: "Limpieza dental",         price: 35000 },
  { name: "Radiografía periapical",  price: 8000  },
  { name: "Radiografía panorámica",  price: 25000 },
  { name: "Obturación (resina)",     price: 45000 },
  { name: "Endodoncia unirradicular",price: 180000 },
  { name: "Endodoncia birradicular", price: 220000 },
  { name: "Endodoncia multirrad.",   price: 260000 },
  { name: "Corona cerámica",         price: 350000 },
  { name: "Corona metalcerámica",    price: 280000 },
  { name: "Implante dental",         price: 750000 },
  { name: "Corona sobre implante",   price: 350000 },
  { name: "Ortodoncia (setup)",      price: 1200000 },
  { name: "Control ortodoncia",      price: 30000 },
  { name: "Extracción simple",       price: 35000 },
  { name: "Extracción quirúrgica",   price: 80000 },
  { name: "Blanqueamiento clínico",  price: 120000 },
  { name: "Carilla de porcelana",    price: 450000 },
  { name: "Prótesis removible",      price: 320000 },
];

const fmtCLP = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${Math.round(n / 1_000)}k`;

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  draft:    { label: "Borrador",   cls: "bg-gray-100 text-gray-500" },
  sent:     { label: "Enviado",    cls: "bg-blue-50 text-blue-700" },
  accepted: { label: "Aceptado",   cls: "bg-emerald-50 text-emerald-700" },
  rejected: { label: "Rechazado",  cls: "bg-red-50 text-red-600" },
};

/* ─── Odontogram tooth picker ────────────────────────────────────────────── */
function OdontogramPicker({
  selectedTooth, setSelectedTooth, itemsByTooth,
}: {
  selectedTooth: string | null;
  setSelectedTooth: (t: string | null) => void;
  itemsByTooth: Record<string, number>;
}) {
  const ToothBtn = ({ fdi }: { fdi: string }) => (
    <button
      onClick={() => setSelectedTooth(selectedTooth === fdi ? null : fdi)}
      style={{ background: "transparent", border: "none", padding: "2px", cursor: "pointer" }}
      title={fdi}
    >
      <ToothIcon fdi={fdi} selected={selectedTooth === fdi} hasItems={(itemsByTooth[fdi] ?? 0) > 0} />
    </button>
  );

  return (
    <div style={{ background: "#F7F5F1", borderRadius: 14, padding: "14px 10px", border: "1px solid #E5E0D9" }}>
      {/* Label */}
      <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em",
        color: "#9ca3af", textAlign: "center", margin: "0 0 10px" }}>Odontograma FDI</p>

      {/* Upper jaw */}
      <div style={{ display: "flex", justifyContent: "center", gap: 2, marginBottom: 4 }}>
        <div style={{ display: "flex", gap: 1 }}>
          {UPPER_RIGHT.map((fdi) => <ToothBtn key={fdi} fdi={fdi} />)}
        </div>
        <div style={{ width: 12, borderRight: "1px dashed #D9D4CC" }} />
        <div style={{ display: "flex", gap: 1 }}>
          {UPPER_LEFT.map((fdi) => <ToothBtn key={fdi} fdi={fdi} />)}
        </div>
      </div>

      {/* Jaw separator */}
      <div style={{ borderTop: "1px dashed #D9D4CC", margin: "4px 0" }} />

      {/* Lower jaw */}
      <div style={{ display: "flex", justifyContent: "center", gap: 2, marginTop: 4 }}>
        <div style={{ display: "flex", gap: 1 }}>
          {LOWER_RIGHT.map((fdi) => <ToothBtn key={fdi} fdi={fdi} />)}
        </div>
        <div style={{ width: 12, borderRight: "1px dashed #D9D4CC" }} />
        <div style={{ display: "flex", gap: 1 }}>
          {LOWER_LEFT.map((fdi) => <ToothBtn key={fdi} fdi={fdi} />)}
        </div>
      </div>

      {/* Selected info */}
      {selectedTooth ? (
        <p style={{ textAlign: "center", marginTop: 8, fontSize: 10, fontWeight: 700, color: "#1A5C7A" }}>
          Pieza {selectedTooth} seleccionada · Elige superficie y prestación abajo
        </p>
      ) : (
        <p style={{ textAlign: "center", marginTop: 8, fontSize: 10, color: "#9ca3af" }}>
          Clic en una pieza dental para asociar prestación · o usa "Sin pieza" para prestaciones generales
        </p>
      )}
    </div>
  );
}

/* ─── Add item form ──────────────────────────────────────────────────────── */
function AddItemForm({ selectedTooth, onAdd }: {
  selectedTooth: string | null;
  onAdd: (item: Omit<QuoteItem, "id" | "total">) => void;
}) {
  const [prestacion, setPrestacion] = useState("");
  const [customPrestacion, setCustomPrestacion] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [discount, setDiscount] = useState("0");
  const [selectedSurfaces, setSelectedSurfaces] = useState<string[]>([]);

  const selectedPreset = DEFAULT_PRESTACIONES.find((p) => p.name === prestacion);

  function toggleSurface(s: string) {
    setSelectedSurfaces((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  }

  function handleAdd() {
    const name = prestacion === "__custom__" ? customPrestacion : prestacion;
    const price = selectedPreset?.price ?? parseFloat(unitPrice);
    if (!name || !price) return;
    onAdd({
      toothFDI: selectedTooth,
      surfaces: selectedSurfaces.length > 0 ? selectedSurfaces.join(",") : null,
      prestacion: name,
      unitPrice: price,
      quantity: parseInt(quantity) || 1,
      discount: parseFloat(discount) || 0,
    });
    setPrestacion(""); setCustomPrestacion(""); setUnitPrice("");
    setQuantity("1"); setDiscount("0"); setSelectedSurfaces([]);
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full shrink-0"
          style={{ background: selectedTooth ? "#1A5C7A" : "#D9D4CC" }} />
        <p className="text-xs font-bold text-gray-700">
          {selectedTooth ? `Pieza ${selectedTooth}` : "Sin pieza específica"}
        </p>
      </div>

      {/* Surface selector — solo si hay pieza */}
      {selectedTooth && (
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Superficies</p>
          <div className="flex gap-1.5 flex-wrap">
            {SURFACES.map((s) => (
              <button key={s} onClick={() => toggleSurface(s)}
                title={SURF_LABEL[s]}
                className="px-2 py-1 rounded-lg text-[10px] font-bold border transition"
                style={selectedSurfaces.includes(s)
                  ? { background: "#1A5C7A", color: "#fff", borderColor: "#1A5C7A" }
                  : { background: "#F7F5F1", color: "#607281", borderColor: "#E5E0D9" }}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Prestación select */}
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Prestación</p>
        <select value={prestacion} onChange={(e) => {
          setPrestacion(e.target.value);
          const preset = DEFAULT_PRESTACIONES.find((p) => p.name === e.target.value);
          if (preset) setUnitPrice(String(preset.price));
        }}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="">Seleccionar prestación…</option>
          {DEFAULT_PRESTACIONES.map((p) => (
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

      {/* Price + qty + discount */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Precio CLP</p>
          <input type="number" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)}
            placeholder="0"
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

      <button onClick={handleAdd}
        disabled={!prestacion || (!selectedPreset && !unitPrice && !customPrestacion)}
        className="w-full py-2 rounded-xl text-xs font-bold text-white transition disabled:opacity-40"
        style={{ background: "#1A5C7A" }}>
        + Agregar al presupuesto
      </button>
    </div>
  );
}

/* ─── Quote builder modal ────────────────────────────────────────────────── */
function QuoteBuilderModal({ patient, onClose, onSaved }: {
  patient: { name: string; rut: string | null };
  onClose: () => void;
  onSaved: (q: DentalQuote) => void;
}) {
  const [selectedTooth, setSelectedTooth] = useState<string | null>(null);
  const [items, setItems] = useState<Omit<QuoteItem, "id">[]>([]);
  const [generalDiscount, setGeneralDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [paymentInfo, setPaymentInfo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const DOCTORS = ["Dra. Ana Aranda","Dra. Ivonne Poblete","Dr. Pedro Engel","Dr. Juan Garcés","Dra. Jacqueline Pérez"];
  const [doctor, setDoctor] = useState("");

  function addItem(item: Omit<QuoteItem, "id" | "total">) {
    const total = item.unitPrice * item.quantity * (1 - item.discount / 100);
    setItems((prev) => [...prev, { ...item, total }]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  const subtotal = items.reduce((s, i) => s + i.total, 0);
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
      const res = await fetch(`${API}/api/dental-quotes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          patientRut: patient.rut ?? undefined,
          patientName: patient.name,
          doctor: doctor || undefined,
          discount: generalDiscount,
          notes: notes || undefined,
          paymentInfo: paymentInfo || undefined,
          items: items.map((i) => ({
            toothFDI: i.toothFDI ?? undefined,
            surfaces: i.surfaces ?? undefined,
            prestacion: i.prestacion,
            unitPrice: i.unitPrice,
            quantity: i.quantity,
            discount: i.discount,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Error al guardar"); return; }
      onSaved(data);
    } catch { setError("Error de conexión"); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-gray-50 rounded-2xl border border-gray-200 shadow-2xl w-full max-w-3xl my-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-white border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-black text-gray-900">Nuevo presupuesto dental</h2>
            <p className="text-xs text-gray-400 mt-0.5">{patient.name}{patient.rut ? ` · ${patient.rut}` : ""}</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 transition flex items-center justify-center text-gray-500">✕</button>
        </div>

        <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: odontogram + add form */}
          <div className="flex flex-col gap-3">
            <OdontogramPicker
              selectedTooth={selectedTooth}
              setSelectedTooth={setSelectedTooth}
              itemsByTooth={itemsByTooth}
            />
            <AddItemForm selectedTooth={selectedTooth} onAdd={addItem} />
          </div>

          {/* Right: items table + totals + config */}
          <div className="flex flex-col gap-3">
            {/* Doctor */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Doctor responsable</p>
              <select value={doctor} onChange={(e) => setDoctor(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option value="">Sin asignar</option>
                {DOCTORS.map((d) => <option key={d} value={d}>{d.replace(/Dra?\. /, "")}</option>)}
              </select>
            </div>

            {/* Items list */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-gray-50">
                <p className="text-xs font-bold text-gray-800">Prestaciones ({items.length})</p>
              </div>
              {items.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">Sin prestaciones aún</p>
              ) : (
                <div className="divide-y divide-gray-50 overflow-y-auto" style={{ maxHeight: 220 }}>
                  {items.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2 px-4 py-2.5">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {item.toothFDI && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                              {item.toothFDI}
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

            {/* Totals */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Subtotal</span>
                <span className="font-semibold text-gray-800">{fmtCLP(subtotal)}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 shrink-0">Descuento general</span>
                <div className="flex items-center gap-1 flex-1">
                  <input type="range" min="0" max="50" value={generalDiscount}
                    onChange={(e) => setGeneralDiscount(Number(e.target.value))}
                    className="flex-1 accent-blue-600" />
                  <span className="text-xs font-bold text-blue-600 w-8 text-right">{generalDiscount}%</span>
                </div>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-gray-50">
                <span className="text-sm font-bold text-gray-900">Total</span>
                <span className="text-lg font-black" style={{ color: "#1A5C7A" }}>{fmtCLP(totalFinal)}</span>
              </div>
            </div>

            {/* Notes + payment info */}
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
              style={{ background: "#D95F45", boxShadow: "0 4px 16px rgba(217,95,69,0.3)" }}>
              {saving ? "Guardando…" : `Guardar presupuesto · ${fmtCLP(totalFinal)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Quote card ─────────────────────────────────────────────────────────── */
function QuoteCard({ quote, onStatusChange }: {
  quote: DentalQuote;
  onStatusChange: (id: string, status: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const st = STATUS_LABELS[quote.status] ?? STATUS_LABELS.draft;
  const MONTHS = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  const d = new Date(quote.createdAt);
  const dateStr = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

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
          {/* Items detail */}
          <div className="px-5 py-3">
            <div className="space-y-2">
              {quote.items.map((item, idx) => (
                <div key={item.id ?? idx} className="flex items-center gap-3">
                  <div className="flex gap-1 flex-wrap w-20 shrink-0">
                    {item.toothFDI && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">{item.toothFDI}</span>
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
            </div>
            {quote.paymentInfo && (
              <p className="text-[11px] text-gray-400 mt-3 pt-3 border-t border-gray-50">
                💳 {quote.paymentInfo}
              </p>
            )}
          </div>

          {/* Status actions */}
          {quote.status !== "accepted" && (
            <div className="px-5 py-3 border-t border-gray-50 flex gap-2 flex-wrap">
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
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Main DentalQuoteTab ────────────────────────────────────────────────── */
export function DentalQuoteTab({ patient }: {
  patient: { name: string; rut: string | null };
}) {
  const [quotes, setQuotes] = useState<DentalQuote[]>([]);
  const [loading, setLoading] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);

  useEffect(() => {
    const token = getToken(); if (!token) return;
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
      setQuotes((prev) => prev.map((q) => q.id === id ? updated : q));
    }
  }

  const totalSent = quotes.filter((q) => q.status !== "rejected").reduce((s, q) => s + q.totalAmount, 0);
  const totalAccepted = quotes.filter((q) => q.accepted).reduce((s, q) => s + q.totalAmount, 0);

  return (
    <div className="flex flex-col gap-3">
      {/* Summary */}
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

      {/* New quote button */}
      <div className="flex justify-end">
        <button onClick={() => setShowBuilder(true)}
          className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl text-white transition"
          style={{ background: "#D95F45" }}>
          + Nuevo presupuesto
        </button>
      </div>

      {/* Quote list */}
      {loading ? (
        <div className="space-y-2">
          {[1,2].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : quotes.length === 0 ? (
        <div className="flex flex-col items-center py-8 gap-2">
          <p className="text-2xl">🦷</p>
          <p className="text-sm text-gray-400">Sin presupuestos aún</p>
          <button onClick={() => setShowBuilder(true)}
            className="text-xs font-bold text-blue-600 hover:underline mt-1">Crear el primero</button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {quotes.map((q) => (
            <QuoteCard key={q.id} quote={q} onStatusChange={handleStatusChange} />
          ))}
        </div>
      )}

      {showBuilder && (
        <QuoteBuilderModal
          patient={patient}
          onClose={() => setShowBuilder(false)}
          onSaved={(q) => { setQuotes((prev) => [q, ...prev]); setShowBuilder(false); }}
        />
      )}
    </div>
  );
}
