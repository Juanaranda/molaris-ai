"use client";

import { useState } from "react";

export interface ServiceRow {
  name: string;
  pricingType: "fixed" | "range" | "variable";
  price?: string;
  priceMin?: string;
  priceMax?: string;
  priceNote?: string;
  /** Minutos de sillón que ocupa, incluyendo preparación y limpieza del box.
      Define el largo del bloque en la agenda. */
  durationMin?: number;
}

/** Opciones de duración; cubren desde un control corto hasta una cirugía. */
const DURACIONES = [15, 20, 30, 45, 60, 90, 120];

interface Props {
  services: ServiceRow[];
  canEdit: boolean;
  onSave: (services: ServiceRow[]) => Promise<void>;
}

const EMPTY: ServiceRow = { name: "", pricingType: "fixed", price: "", priceMin: "", priceMax: "", priceNote: "", durationMin: 45 };

/* Las duraciones son un punto de partida razonable, NO el dato de la clínica:
   cada equipo trabaja a su ritmo y debe ajustarlas. La agenda las usa para
   decidir el largo del bloque, así que conviene revisarlas al configurar. */
const SUGGESTED_SERVICES: ServiceRow[] = [
  { name: "Limpieza dental",                    pricingType: "range",    priceMin: "$25.000", priceMax: "$40.000", durationMin: 45 },
  { name: "Blanqueamiento dental",               pricingType: "variable", priceNote: "Varía según tipo y caso del paciente.", durationMin: 60 },
  { name: "Consulta general",                    pricingType: "fixed",    price: "$20.000", durationMin: 30 },
  { name: "Urgencias dentales",                  pricingType: "fixed",    price: "$35.000", durationMin: 30 },
  { name: "Ortodoncia (brackets / alineadores)", pricingType: "variable", priceNote: "Se evalúa en consulta.", durationMin: 45 },
  { name: "Carillas dentales",                   pricingType: "variable", priceNote: "Varía según número de piezas y material.", durationMin: 90 },
  { name: "Implantes dentales",                  pricingType: "variable", priceNote: "Depende del número de implantes.", durationMin: 90 },
  { name: "Endodoncia (tratamiento de conducto)",pricingType: "variable", priceNote: "Varía según número de conductos.", durationMin: 90 },
  { name: "Extracción dental simple",            pricingType: "range",    priceMin: "$20.000", priceMax: "$45.000", durationMin: 30 },
  { name: "Extracción de muela del juicio",      pricingType: "variable", priceNote: "Varía según posición e impactación.", durationMin: 60 },
  { name: "Radiografía dental",                  pricingType: "range",    priceMin: "$8.000",  priceMax: "$20.000", durationMin: 15 },
  { name: "Blanqueamiento en consulta",          pricingType: "range",    priceMin: "$80.000", priceMax: "$150.000", durationMin: 90 },
  { name: "Resina / obturación",                 pricingType: "range",    priceMin: "$25.000", priceMax: "$60.000", durationMin: 45 },
  { name: "Prótesis removible",                  pricingType: "variable", priceNote: "Depende del número de piezas.", durationMin: 60 },
  { name: "Corona dental",                       pricingType: "variable", priceNote: "Depende del material y la pieza.", durationMin: 60 },
];

function priceDisplay(svc: ServiceRow): string {
  if (svc.pricingType === "fixed") return svc.price ?? "—";
  if (svc.pricingType === "range") {
    if (svc.priceMin && svc.priceMax) return `${svc.priceMin} - ${svc.priceMax}`;
    if (svc.priceMin) return `Desde ${svc.priceMin}`;
    return svc.price ?? "—";
  }
  return svc.priceNote ?? "Variable";
}

export function ServicesEditor({ services, canEdit, onSave }: Props) {
  const [rows, setRows] = useState<ServiceRow[]>(services);
  const [editing, setEditing] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [form, setForm] = useState<ServiceRow>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [formError, setFormError] = useState("");

  function openAdd() { setForm(EMPTY); setEditIdx(null); setFormOpen(true); setShowSuggestions(false); setFormError(""); }
  function openEdit(i: number) { setForm({ ...rows[i] }); setEditIdx(i); setFormOpen(true); setShowSuggestions(false); setFormError(""); }

  function addSuggestion(svc: ServiceRow) {
    if (rows.some((r) => r.name === svc.name)) return;
    setRows((r) => [...r, { ...svc }]);
  }

  function saveRow() {
    if (!form.name.trim()) return;

    // Un precio fijo es UN valor. Si trae un guion entre cifras es un rango
    // disfrazado: la ficha mostraría "Precio fijo · $25.000 - $40.000" y el
    // agente le informaría al paciente un precio que no existe.
    if (form.pricingType === "fixed" && /\d\s*[-–—a]\s*\$?\s*\d/.test(form.price ?? "")) {
      setFormError('Eso es un rango. Cambia el tipo a "Rango de precios" y separa el mínimo del máximo.');
      return;
    }
    if (form.pricingType === "range" && (!form.priceMin?.trim() || !form.priceMax?.trim())) {
      setFormError("Un rango necesita precio mínimo y máximo.");
      return;
    }
    setFormError("");

    const clean: ServiceRow = {
      name: form.name,
      pricingType: form.pricingType,
      ...(form.pricingType === "fixed" && form.price ? { price: form.price } : {}),
      ...(form.pricingType === "range" ? { priceMin: form.priceMin, priceMax: form.priceMax } : {}),
      ...(form.priceNote ? { priceNote: form.priceNote } : {}),
    };
    if (editIdx === null) {
      setRows((r) => [...r, clean]);
    } else {
      setRows((r) => r.map((row, i) => (i === editIdx ? clean : row)));
    }
    setFormOpen(false);
    setForm(EMPTY);
  }

  function deleteRow(i: number) {
    setRows((r) => r.filter((_, idx) => idx !== i));
  }

  function cancelEdit() {
    setEditing(false);
    setRows(services);
    setMsg("");
    setShowSuggestions(false);
    setFormOpen(false);
  }

  async function handleSave() {
    setSaving(true);
    setMsg("");
    try {
      await onSave(rows);
      setEditing(false);
      setFormOpen(false);
      setShowSuggestions(false);
      setMsg("Guardado");
      setTimeout(() => setMsg(""), 3000);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  const availableSuggestions = SUGGESTED_SERVICES.filter((s) => !rows.some((r) => r.name === s.name));

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900">Servicios y precios</h2>
        <div className="flex items-center gap-3">
          {msg && <span className={`text-xs ${msg === "Guardado" ? "text-green-600" : "text-red-600"}`}>{msg}</span>}
          {canEdit && !editing && (
            <button onClick={() => setEditing(true)} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              Editar
            </button>
          )}
          {canEdit && editing && (
            <>
              <button onClick={cancelEdit} className="text-sm text-gray-500 hover:text-gray-700">Cancelar</button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="text-sm bg-blue-600 text-white font-medium px-4 py-1.5 rounded-full hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider pb-3">Servicio</th>
              <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider pb-3">Duración</th>
              <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider pb-3">Precio / nota</th>
              {editing && <th className="pb-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((svc, i) => (
              <tr key={i}>
                <td className="py-3 text-gray-800">{svc.name}</td>
                <td className="py-3 text-gray-600 whitespace-nowrap">
                  {svc.durationMin ? `${svc.durationMin} min` : <span className="text-gray-300">—</span>}
                </td>
                <td className="py-3 text-gray-600">{priceDisplay(svc)}</td>
                {editing && (
                  <td className="py-3 text-right whitespace-nowrap">
                    <button onClick={() => openEdit(i)} className="text-xs text-blue-500 hover:text-blue-700 mr-3">Editar</button>
                    <button onClick={() => deleteRow(i)} className="text-xs text-red-400 hover:text-red-600">Eliminar</button>
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={editing ? 3 : 2} className="py-6 text-center text-sm text-gray-400">Sin servicios registrados</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={openAdd}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            <span className="text-lg leading-none">+</span> Agregar servicio
          </button>
          {availableSuggestions.length > 0 && (
            <button
              onClick={() => setShowSuggestions((v) => !v)}
              className="text-sm text-gray-500 hover:text-gray-700 font-medium flex items-center gap-1"
            >
              <span className="text-lg leading-none">☰</span> Sugerencias ({availableSuggestions.length})
            </button>
          )}
        </div>
      )}

      {/* Sugerencias */}
      {editing && showSuggestions && availableSuggestions.length > 0 && (
        <div className="mt-4 bg-gray-50 rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Servicios comunes — haz clic en + para agregar</p>
          <div className="flex flex-col gap-1.5">
            {availableSuggestions.map((svc, i) => (
              <div key={i} className="flex items-center justify-between gap-2 py-1.5 border-b border-gray-100 last:border-0">
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-gray-800">{svc.name}</span>
                  <span className="ml-2 text-xs text-gray-400">{priceDisplay(svc)}</span>
                </div>
                <button
                  onClick={() => addSuggestion(svc)}
                  className="shrink-0 w-7 h-7 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 text-lg leading-none flex items-center justify-center font-bold transition-colors"
                >
                  +
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Formulario inline */}
      {editing && formOpen && (
        <div className="mt-5 bg-gray-50 rounded-xl border border-gray-200 p-4 flex flex-col gap-3">
          <p className="text-sm font-medium text-gray-700">{editIdx === null ? "Nuevo servicio" : "Editar servicio"}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Nombre del servicio</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ej: Limpieza dental"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Duración en sillón</label>
              <select
                value={form.durationMin ?? 45}
                onChange={(e) => setForm((f) => ({ ...f, durationMin: Number(e.target.value) }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {DURACIONES.map((d) => (
                  <option key={d} value={d}>{d < 60 ? `${d} minutos` : d === 60 ? "1 hora" : `${d / 60} horas`}</option>
                ))}
              </select>
              <p className="text-[11px] text-gray-400 mt-1">
                Define el largo del bloque en la agenda. Incluye la preparación y la limpieza del box.
              </p>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tipo de precio</label>
              <select
                value={form.pricingType}
                onChange={(e) => setForm((f) => ({ ...f, pricingType: e.target.value as ServiceRow["pricingType"] }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="fixed">Precio fijo</option>
                <option value="range">Rango de precios</option>
                <option value="variable">Precio a consultar</option>
              </select>
              <p className="text-[10px] text-gray-400 mt-1">
                {form.pricingType === "fixed" && "El agente informa el precio exacto al paciente."}
                {form.pricingType === "range" && "El agente informa que el precio varía entre un mínimo y un máximo según la complejidad del caso."}
                {form.pricingType === "variable" && "El agente informará que el precio varía según cada caso y se cotiza en la consulta."}
              </p>
            </div>

            {form.pricingType === "fixed" && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Precio</label>
                <input
                  value={form.price ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  placeholder="$35.000"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {form.pricingType === "range" && (
              <div className="col-span-2 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Precio mínimo</label>
                  <input
                    value={form.priceMin ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, priceMin: e.target.value }))}
                    placeholder="$25.000"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Precio máximo</label>
                  <input
                    value={form.priceMax ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, priceMax: e.target.value }))}
                    placeholder="$60.000"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            {form.pricingType === "variable" && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nota de precio</label>
                <input
                  value={form.priceNote ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, priceNote: e.target.value }))}
                  placeholder="Varía según el caso del paciente."
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>
          {formError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{formError}</p>
          )}
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setFormOpen(false); setForm(EMPTY); setFormError(""); }} className="text-sm text-gray-500 hover:text-gray-700">Cancelar</button>
            <button
              onClick={saveRow}
              disabled={!form.name.trim()}
              className="text-sm bg-gray-800 text-white font-medium px-4 py-1.5 rounded-full hover:bg-gray-900 disabled:opacity-40 transition-colors"
            >
              {editIdx === null ? "Agregar" : "Actualizar"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
