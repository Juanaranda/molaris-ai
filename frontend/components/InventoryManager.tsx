"use client";

import { useCallback, useEffect, useState } from "react";
import {
  InventoryItem, getInventory, createInventoryItem,
  deleteInventoryItem, registerMovement,
} from "@/lib/inventory";
import { TriangleAlert, X } from "lucide-react";

const fmtCLP = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");

export function InventoryManager({ clinicId }: { clinicId: string }) {
  const [items, setItems]   = useState<InventoryItem[]>([]);
  const [lowCount, setLow]  = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const r = await getInventory(); setItems(r.items); setLow(r.lowStockCount); }
    catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally   { setLoading(false); }
  }, []);

  // clinicId no se usa en las queries (el backend lo deriva del token) pero
  // recargamos si cambia de clínica.
  useEffect(() => { load(); }, [load, clinicId]);

  if (loading) return <div className="text-sm text-gray-400 py-8 text-center">Cargando inventario…</div>;

  return (
    <div className="flex flex-col gap-5 py-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Inventario de insumos</h2>
          <p className="text-[11px] text-gray-400">Controla stock y recibe aviso cuando algo está por agotarse.</p>
        </div>
        <button onClick={() => setAdding((v) => !v)}
          className="text-xs font-bold px-3 py-1.5 rounded-xl bg-[#1A5C7A] text-white hover:bg-[#0e4560] transition">
          {adding ? "Cerrar" : "+ Nuevo insumo"}
        </button>
      </div>

      {lowCount > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700 font-semibold">
          <TriangleAlert className="w-4 h-4 inline-block align-[-3px]" aria-hidden /> {lowCount} insumo{lowCount !== 1 ? "s" : ""} con stock bajo o agotado.
        </div>
      )}

      {adding && <AddItemForm onCreated={() => { setAdding(false); load(); }} />}

      {error && <p className="text-xs text-red-500">{error}</p>}

      {items.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">Aún no hay insumos. Agrega el primero.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((it) => <ItemRow key={it.id} item={it} onChange={load} />)}
        </div>
      )}
    </div>
  );
}

function AddItemForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName]     = useState("");
  const [category, setCat]  = useState("");
  const [unit, setUnit]     = useState("unidad");
  const [stock, setStock]   = useState("");
  const [min, setMin]       = useState("");
  const [cost, setCost]     = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState("");

  async function save() {
    if (!name.trim()) { setErr("El nombre es obligatorio"); return; }
    setSaving(true); setErr("");
    try {
      await createInventoryItem({
        name: name.trim(), category: category.trim() || undefined, unit: unit.trim() || "unidad",
        currentStock: Number(stock) || 0, minStock: Number(min) || 0,
        cost: cost ? Number(cost) : undefined,
      });
      onCreated();
    } catch (e) { setErr(e instanceof Error ? e.message : "Error"); }
    finally     { setSaving(false); }
  }

  const inputCls = "w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1A5C7A]/30 focus:border-[#1A5C7A]";

  return (
    <div className="bg-gray-50 rounded-2xl border border-gray-100 p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
      <div className="col-span-2 sm:col-span-1"><label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Nombre *</label><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Anestesia lidocaína" /></div>
      <div><label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Categoría</label><input value={category} onChange={(e) => setCat(e.target.value)} className={inputCls} placeholder="Anestesia" /></div>
      <div><label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Unidad</label><input value={unit} onChange={(e) => setUnit(e.target.value)} className={inputCls} placeholder="caja" /></div>
      <div><label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Stock inicial</label><input type="number" value={stock} onChange={(e) => setStock(e.target.value)} className={inputCls} placeholder="0" /></div>
      <div><label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Stock mínimo</label><input type="number" value={min} onChange={(e) => setMin(e.target.value)} className={inputCls} placeholder="0" /></div>
      <div><label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Costo unitario</label><input type="number" value={cost} onChange={(e) => setCost(e.target.value)} className={inputCls} placeholder="CLP" /></div>
      <div className="col-span-2 sm:col-span-3 flex items-center gap-2">
        <button onClick={save} disabled={saving} className="text-xs font-bold px-3 py-1.5 rounded-xl bg-[#1A5C7A] text-white hover:bg-[#0e4560] transition disabled:opacity-50">{saving ? "Guardando…" : "Guardar insumo"}</button>
        {err && <span className="text-xs text-red-500">{err}</span>}
      </div>
    </div>
  );
}

function ItemRow({ item, onChange }: { item: InventoryItem; onChange: () => void }) {
  const [qty, setQty]   = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState("");

  async function move(kind: "in" | "out") {
    const q = Number(qty);
    if (!(q > 0)) { setErr("Cantidad inválida"); return; }
    setBusy(true); setErr("");
    try { await registerMovement(item.id, { kind, quantity: q }); setQty(""); onChange(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Error"); }
    finally   { setBusy(false); }
  }

  async function remove() {
    if (!confirm(`¿Eliminar "${item.name}" del inventario?`)) return;
    setBusy(true);
    try { await deleteInventoryItem(item.id); onChange(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Error"); }
    finally   { setBusy(false); }
  }

  return (
    <div className={`bg-white rounded-2xl border p-4 flex flex-wrap items-center gap-3 ${item.lowStock ? "border-amber-300" : "border-gray-100"}`}>
      <div className="flex-1 min-w-[160px]">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-800">{item.name}</span>
          {item.category && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{item.category}</span>}
          {item.lowStock && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">stock bajo</span>}
        </div>
        <p className="text-[11px] text-gray-400">
          {item.currentStock} {item.unit} · mín {item.minStock}{item.cost ? ` · ${fmtCLP(item.cost)}/u` : ""}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        <input type="number" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="cant."
          className="w-16 px-2 py-1.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1A5C7A]/30" />
        <button onClick={() => move("in")} disabled={busy} title="Entrada (compra)"
          className="text-xs font-bold px-2 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50">+ Entrada</button>
        <button onClick={() => move("out")} disabled={busy} title="Salida (consumo)"
          className="text-xs font-bold px-2 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 disabled:opacity-50">− Salida</button>
        <button onClick={remove} disabled={busy} title="Eliminar"
          className="text-xs px-2 py-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"><X className="w-4 h-4" aria-hidden /></button>
      </div>
      {err && <span className="text-xs text-red-500 w-full">{err}</span>}
    </div>
  );
}
