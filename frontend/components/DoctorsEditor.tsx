"use client";

import { useState } from "react";

export interface DoctorRow {
  name: string;
  specialty: string;
  schedule: string;
}

interface Props {
  doctors: DoctorRow[];
  boxes: number;
  canEdit: boolean;
  onSave: (doctors: DoctorRow[], boxes: number) => Promise<void>;
}

const EMPTY: DoctorRow = { name: "", specialty: "", schedule: "" };

export function DoctorsEditor({ doctors, boxes, canEdit, onSave }: Props) {
  const [rows, setRows] = useState<DoctorRow[]>(doctors);
  const [boxCount, setBoxCount] = useState(boxes);
  const [editing, setEditing] = useState(false);
  const [modalIdx, setModalIdx] = useState<number | null>(null); // null = nuevo
  const [form, setForm] = useState<DoctorRow>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  function openAdd() { setForm(EMPTY); setModalIdx(null); }
  function openEdit(i: number) { setForm({ ...rows[i] }); setModalIdx(i); }

  function saveRow() {
    if (!form.name.trim()) return;
    if (modalIdx === null) {
      setRows((r) => [...r, { ...form }]);
    } else {
      setRows((r) => r.map((row, i) => (i === modalIdx ? { ...form } : row)));
    }
    setForm(EMPTY);
    setModalIdx(undefined as unknown as null);
  }

  function deleteRow(i: number) {
    setRows((r) => r.filter((_, idx) => idx !== i));
  }

  function cancelEdit() {
    setEditing(false);
    setRows(doctors);
    setBoxCount(boxes);
    setMsg("");
  }

  async function handleSave() {
    setSaving(true);
    setMsg("");
    try {
      await onSave(rows, boxCount);
      setEditing(false);
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
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-gray-900">Doctores</h2>
          {editing && (
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-500">Boxes:</label>
              <input
                type="number"
                min={1}
                max={20}
                value={boxCount}
                onChange={(e) => setBoxCount(Number(e.target.value))}
                className="w-14 px-2 py-1 text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
          {!editing && (
            <span className="text-xs text-gray-400">{boxCount} box{boxCount !== 1 ? "es" : ""}</span>
          )}
        </div>

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
              <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider pb-3">Nombre</th>
              <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider pb-3">Especialidad</th>
              <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider pb-3">Horario</th>
              {editing && <th className="pb-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((doc, i) => (
              <tr key={i}>
                <td className="py-3 font-medium text-gray-800">{doc.name}</td>
                <td className="py-3 text-gray-600">{doc.specialty}</td>
                <td className="py-3 text-gray-600">{doc.schedule}</td>
                {editing && (
                  <td className="py-3 text-right">
                    <button onClick={() => openEdit(i)} className="text-xs text-blue-500 hover:text-blue-700 mr-3">Editar</button>
                    <button onClick={() => deleteRow(i)} className="text-xs text-red-400 hover:text-red-600">Eliminar</button>
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={editing ? 4 : 3} className="py-6 text-center text-sm text-gray-400">Sin doctores registrados</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <button
          onClick={openAdd}
          className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
        >
          <span className="text-lg leading-none">+</span> Agregar doctor
        </button>
      )}

      {/* Modal inline */}
      {editing && (form.name !== "" || modalIdx === null) && modalIdx !== undefined && (
        <div className="mt-5 bg-gray-50 rounded-xl border border-gray-200 p-4 flex flex-col gap-3">
          <p className="text-sm font-medium text-gray-700">{modalIdx === null ? "Nuevo doctor" : "Editar doctor"}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nombre</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Dra. Ana García"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Especialidad</label>
              <input
                value={form.specialty}
                onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))}
                placeholder="Ortodoncia"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Horario</label>
              <input
                value={form.schedule}
                onChange={(e) => setForm((f) => ({ ...f, schedule: e.target.value }))}
                placeholder="Lun/Mié/Vie"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setForm(EMPTY); setModalIdx(undefined as unknown as null); }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancelar
            </button>
            <button
              onClick={saveRow}
              disabled={!form.name.trim()}
              className="text-sm bg-gray-800 text-white font-medium px-4 py-1.5 rounded-full hover:bg-gray-900 disabled:opacity-40 transition-colors"
            >
              {modalIdx === null ? "Agregar" : "Actualizar"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
