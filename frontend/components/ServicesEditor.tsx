"use client";

import { useState } from "react";

export interface ServiceRow {
  name: string;
  pricingType: "fixed" | "variable";
  price?: string;
  priceNote?: string;
}

interface Props {
  services: ServiceRow[];
  canEdit: boolean;
  onSave: (services: ServiceRow[]) => Promise<void>;
}

const EMPTY: ServiceRow = { name: "", pricingType: "fixed", price: "", priceNote: "" };

export function ServicesEditor({ services, canEdit, onSave }: Props) {
  const [rows, setRows] = useState<ServiceRow[]>(services);
  const [editing, setEditing] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [form, setForm] = useState<ServiceRow>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  function openAdd() { setForm(EMPTY); setEditIdx(null); setFormOpen(true); }
  function openEdit(i: number) { setForm({ ...rows[i] }); setEditIdx(i); setFormOpen(true); }

  function saveRow() {
    if (!form.name.trim()) return;
    const clean: ServiceRow = {
      name: form.name,
      pricingType: form.pricingType,
      ...(form.pricingType === "fixed" && form.price ? { price: form.price } : {}),
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
  }

  async function handleSave() {
    setSaving(true);
    setMsg("");
    try {
      await onSave(rows);
      setEditing(false);
      setFormOpen(false);
      setMsg("Guardado");
      setTimeout(() => setMsg(""), 3000);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

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
              <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider pb-3">Precio / nota</th>
              {editing && <th className="pb-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((svc, i) => (
              <tr key={i}>
                <td className="py-3 text-gray-800">{svc.name}</td>
                <td className="py-3 text-gray-600">
                  {svc.pricingType === "fixed" ? (svc.price ?? "—") : (svc.priceNote ?? "Variable")}
                </td>
                {editing && (
                  <td className="py-3 text-right">
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
        <button
          onClick={openAdd}
          className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
        >
          <span className="text-lg leading-none">+</span> Agregar servicio
        </button>
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
                placeholder="Limpieza dental"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tipo de precio</label>
              <select
                value={form.pricingType}
                onChange={(e) => setForm((f) => ({ ...f, pricingType: e.target.value as "fixed" | "variable" }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="fixed">Precio fijo</option>
                <option value="variable">Variable / a consultar</option>
              </select>
            </div>
            {form.pricingType === "fixed" ? (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Precio</label>
                <input
                  value={form.price ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  placeholder="$25.000 - $60.000"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ) : (
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
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setFormOpen(false); setForm(EMPTY); }} className="text-sm text-gray-500 hover:text-gray-700">Cancelar</button>
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
