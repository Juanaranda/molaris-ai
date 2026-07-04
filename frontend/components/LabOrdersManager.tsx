"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LabOrder, LabOrderStatus, LabOrderType, ORDER_TYPE_LABELS,
  listLabOrders, createLabOrder, updateLabOrder, deleteLabOrder,
} from "@/lib/labOrders";

interface Props {
  clinicId:   string;
  patientId?: string;  // si se pasa, filtra a ese paciente y oculta filtro
  onClose:    () => void;
}

const STATUS_META: Record<LabOrderStatus, { label: string; cls: string; next?: LabOrderStatus }> = {
  pending:    { label: "Pendiente", cls: "bg-amber-100 text-amber-800", next: "in_transit" },
  in_transit: { label: "En camino", cls: "bg-blue-100 text-blue-700",   next: "received" },
  received:   { label: "Recibida",  cls: "bg-emerald-100 text-emerald-800", next: "installed" },
  installed:  { label: "Instalada", cls: "bg-violet-100 text-violet-800" },
  rejected:   { label: "Rechazada", cls: "bg-red-100 text-red-700" },
};

const STATUS_NEXT_LABEL: Record<LabOrderStatus, string | null> = {
  pending:    "Marcar en camino",
  in_transit: "Marcar recibida",
  received:   "Marcar instalada",
  installed:  null,
  rejected:   null,
};

export function LabOrdersManager({ clinicId, patientId, onClose }: Props) {
  const [orders,  setOrders]  = useState<LabOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [busyId,  setBusyId]  = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "overdue" | LabOrderStatus>("active");

  const fetchAll = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params: { status?: string; patientId?: string; overdue?: boolean } = { patientId };
      if (filterStatus === "overdue")    params.overdue = true;
      else if (filterStatus !== "all" && filterStatus !== "active") params.status = filterStatus;
      setOrders(await listLabOrders(clinicId, params));
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally     { setLoading(false); }
  }, [clinicId, patientId, filterStatus]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function setStatus(order: LabOrder, status: LabOrderStatus) {
    setBusyId(order.id);
    try {
      const updated = await updateLabOrder(clinicId, order.id, { status });
      setOrders((arr) => arr.map((o) => o.id === order.id ? updated : o));
    } catch (e) { alert(e instanceof Error ? e.message : "Error"); }
    finally    { setBusyId(null); }
  }

  async function remove(order: LabOrder) {
    if (!confirm("Eliminar esta orden?")) return;
    setBusyId(order.id);
    try {
      await deleteLabOrder(clinicId, order.id);
      setOrders((arr) => arr.filter((o) => o.id !== order.id));
    } catch (e) { alert(e instanceof Error ? e.message : "Error"); }
    finally    { setBusyId(null); }
  }

  const filtered = useMemo(() => {
    if (filterStatus === "active") {
      return orders.filter((o) => ["pending", "in_transit"].includes(o.status));
    }
    return orders;
  }, [orders, filterStatus]);

  const now = new Date();
  const counts = useMemo(() => ({
    active:  orders.filter((o) => ["pending", "in_transit"].includes(o.status)).length,
    overdue: orders.filter((o) =>
      ["pending", "in_transit"].includes(o.status) &&
      o.expectedReturnAt && new Date(o.expectedReturnAt) < now
    ).length,
  }), [orders, now]);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-stretch sm:items-center justify-center sm:p-4">
      <div className="bg-white rounded-none sm:rounded-2xl shadow-2xl w-full sm:max-w-4xl flex flex-col max-h-[100vh] sm:max-h-[92vh] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">🦷 Laboratorio</h2>
            <p className="text-[11px] text-gray-400">
              {counts.active} activa{counts.active !== 1 ? "s" : ""}
              {counts.overdue > 0 && <span className="text-red-500 font-bold"> · {counts.overdue} atrasada{counts.overdue !== 1 ? "s" : ""}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowAdd(true)}
              className="text-xs font-bold px-3 py-1.5 rounded-xl bg-[#1A5C7A] text-white hover:bg-[#0e4560] transition">
              + Nueva orden
            </button>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-400 text-lg leading-none">✕</button>
          </div>
        </div>

        {/* Filtros */}
        <div className="px-5 py-3 border-b border-gray-50 flex gap-1.5 flex-wrap">
          {([
            ["active",   "Activas",   counts.active],
            ["overdue",  "Atrasadas", counts.overdue],
            ["pending",  "Pendientes", null],
            ["in_transit","En camino", null],
            ["received",  "Recibidas", null],
            ["installed", "Instaladas", null],
            ["all",       "Todas",     null],
          ] as [typeof filterStatus, string, number | null][]).map(([key, label, count]) => (
            <button key={key} onClick={() => setFilterStatus(key)}
              className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition ${
                filterStatus === key
                  ? "bg-[#1A5C7A] text-white border-[#1A5C7A]"
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
              } ${key === "overdue" && count && count > 0 ? "ring-1 ring-red-300" : ""}`}>
              {label}
              {count !== null && count > 0 && <span className="ml-1 opacity-70">({count})</span>}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading && <div className="text-center text-sm text-gray-400 py-10">Cargando…</div>}
          {error && <div className="text-center text-sm text-red-500 py-10">{error}</div>}
          {!loading && !error && filtered.length === 0 && (
            <div className="text-center text-sm text-gray-400 py-10">
              Sin órdenes para los filtros actuales.
            </div>
          )}
          {!loading && filtered.length > 0 && (
            <div className="flex flex-col gap-2">
              {filtered.map((o) => (
                <OrderRow key={o.id} order={o} busy={busyId === o.id}
                  onSetStatus={(s) => setStatus(o, s)} onRemove={() => remove(o)} />
              ))}
            </div>
          )}
        </div>

        {showAdd && (
          <AddModal clinicId={clinicId} patientId={patientId}
            onClose={() => setShowAdd(false)}
            onAdded={(o) => { setOrders((arr) => [o, ...arr]); setShowAdd(false); }} />
        )}
      </div>
    </div>
  );
}

function OrderRow({ order, busy, onSetStatus, onRemove }: {
  order: LabOrder; busy: boolean;
  onSetStatus: (s: LabOrderStatus) => void;
  onRemove: () => void;
}) {
  const meta = STATUS_META[order.status];
  const nextStatus = meta.next;
  const nextLabel  = STATUS_NEXT_LABEL[order.status];
  const overdue = order.expectedReturnAt && new Date(order.expectedReturnAt) < new Date()
                  && ["pending", "in_transit"].includes(order.status);

  const patientName = order.patient
    ? (order.patient.identity ? `${order.patient.identity.firstName} ${order.patient.identity.lastName}` : order.patient.name ?? "Paciente")
    : "(sin paciente)";

  return (
    <div className={`bg-white rounded-2xl border p-3 flex items-start gap-3 ${overdue ? "border-red-200 bg-red-50/30" : "border-gray-100"}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-sm font-bold text-gray-900 truncate">{ORDER_TYPE_LABELS[order.orderType]}</span>
          {order.toothFDI && (
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
              Pieza {order.toothFDI}
            </span>
          )}
          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${meta.cls}`}>{meta.label}</span>
          {overdue && (
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-100 text-red-700">⏰ Atrasada</span>
          )}
        </div>
        <p className="text-[11px] text-gray-500 truncate">
          👤 {patientName} · 🏭 {order.labName}
          {order.cost != null && <span> · 💰 ${order.cost.toLocaleString("es-CL")}</span>}
        </p>
        <div className="flex gap-3 mt-1 text-[10px] text-gray-400">
          <span>📤 Enviada: {new Date(order.sentAt).toLocaleDateString("es-CL")}</span>
          {order.expectedReturnAt && <span>⏳ Esperada: {new Date(order.expectedReturnAt).toLocaleDateString("es-CL")}</span>}
          {order.receivedAt && <span>📦 Recibida: {new Date(order.receivedAt).toLocaleDateString("es-CL")}</span>}
          {order.installedAt && <span>✓ Instalada: {new Date(order.installedAt).toLocaleDateString("es-CL")}</span>}
        </div>
        {order.notes && <p className="text-[11px] text-gray-400 italic mt-1">{order.notes}</p>}
      </div>

      <div className="flex flex-col gap-1 shrink-0">
        {nextStatus && nextLabel && (
          <button onClick={() => onSetStatus(nextStatus)} disabled={busy}
            className="text-[11px] font-bold px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
            {nextLabel}
          </button>
        )}
        {!["installed", "rejected"].includes(order.status) && (
          <button onClick={() => onSetStatus("rejected")} disabled={busy}
            className="text-[11px] font-bold px-2 py-1 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50">
            Rechazar
          </button>
        )}
        <button onClick={onRemove} disabled={busy}
          className="text-[11px] font-bold px-2 py-1 rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-50">
          ✕
        </button>
      </div>
    </div>
  );
}

function AddModal({ clinicId, patientId, onClose, onAdded }: {
  clinicId: string; patientId?: string;
  onClose: () => void; onAdded: (o: LabOrder) => void;
}) {
  const [labName,   setLabName]   = useState("");
  const [orderType, setOrderType] = useState<LabOrderType>("corona");
  const [toothFDI,  setToothFDI]  = useState("");
  const [description, setDescription] = useState("");
  const [sentAt,    setSentAt]    = useState<string>(new Date().toISOString().slice(0, 10));
  const [expected,  setExpected]  = useState<string>("");
  const [cost,      setCost]      = useState<string>("");
  const [notes,     setNotes]     = useState<string>("");
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!labName.trim()) { setError("Lab requerido"); return; }
    setSaving(true); setError("");
    try {
      const order = await createLabOrder(clinicId, {
        patientId, toothFDI: toothFDI.trim() || undefined,
        labName: labName.trim(), orderType,
        description: description.trim() || undefined,
        sentAt:    sentAt ? new Date(sentAt).toISOString() : undefined,
        expectedReturnAt: expected ? new Date(expected).toISOString() : undefined,
        cost:      cost ? Number(cost) : undefined,
        notes:     notes.trim() || undefined,
      });
      onAdded(order);
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally    { setSaving(false); }
  }

  const inputCls = "w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1A5C7A]/30 focus:border-[#1A5C7A]";

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
          <h3 className="text-sm font-bold text-gray-800">Nueva orden de laboratorio</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 text-lg">✕</button>
        </div>
        <form onSubmit={submit} className="p-5 flex flex-col gap-3 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Laboratorio *</label>
              <input autoFocus value={labName} onChange={(e) => setLabName(e.target.value)} placeholder="Ej: Lab Aravena" className={inputCls} />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Tipo *</label>
              <select value={orderType} onChange={(e) => setOrderType(e.target.value as LabOrderType)} className={inputCls}>
                {(Object.entries(ORDER_TYPE_LABELS) as [LabOrderType, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Pieza (FDI)</label>
              <input value={toothFDI} onChange={(e) => setToothFDI(e.target.value)} placeholder="Ej: 36" className={inputCls} />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Costo (CLP)</label>
              <input type="number" min="0" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Enviada</label>
              <input type="date" value={sentAt} onChange={(e) => setSentAt(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Esperada</label>
              <input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Descripción</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej: Corona porcelana zirconio" className={inputCls} />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Notas</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputCls} resize-none`} />
          </div>
          {!patientId && (
            <p className="text-[10px] text-gray-400 italic">Para asociar a un paciente, crear desde su ficha clínica.</p>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-500 text-sm font-bold hover:border-gray-300">Cancelar</button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 rounded-xl bg-[#1A5C7A] text-white text-sm font-bold hover:bg-[#0e4560] disabled:opacity-50">
              {saving ? "Guardando…" : "Crear orden"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
