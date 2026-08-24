/**
 * Piezas visuales chicas del panel: insignias, tarjetas de dato y campos de
 * texto. Salieron de page.tsx cuando ese archivo pasaba las 1.600 líneas — no
 * son "componentes de diseño" genéricos, son los del panel, por eso viven en
 * components/dashboard y no en la raíz.
 */

/** Formato corto de pesos: $1.2M / $850k. Para tablas, no para montos exactos. */
export const fmtCLP = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${(n / 1_000).toFixed(0)}k`;

export const MONTH_LABELS: Record<string, string> = {
  "01":"Ene","02":"Feb","03":"Mar","04":"Abr","05":"May","06":"Jun",
  "07":"Jul","08":"Ago","09":"Sep","10":"Oct","11":"Nov","12":"Dic",
};
export const DOW_LABELS = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

export function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    SUPERADMIN: "bg-purple-100 text-purple-700",
    ADMIN: "bg-blue-100 text-blue-700",
    USER: "bg-gray-100 text-gray-600",
  };
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${styles[role] ?? styles.USER}`}>{role}</span>;
}

export function IntentBadge({ intent }: { intent: string | null }) {
  if (!intent) return <span className="text-gray-300 text-xs">—</span>;
  const map: Record<string, { label: string; cls: string }> = {
    ready_to_book: { label: "Listo para agendar", cls: "bg-green-50 text-green-700 border border-green-100" },
    evaluating:    { label: "Evaluando",           cls: "bg-yellow-50 text-yellow-700 border border-yellow-100" },
    just_browsing: { label: "Explorando",          cls: "bg-gray-50 text-gray-500 border border-gray-100" },
  };
  const v = map[intent] ?? { label: intent, cls: "bg-gray-50 text-gray-500 border border-gray-100" };
  return <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${v.cls}`}>{v.label}</span>;
}

export function UrgencyDot({ urgency }: { urgency: string | null }) {
  const colors: Record<string, string> = { high: "bg-red-500", medium: "bg-yellow-400", low: "bg-gray-300" };
  if (!urgency) return null;
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[urgency] ?? "bg-gray-300"}`} title={urgency} />;
}

export function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-gray-300 text-xs">—</span>;
  const color = score >= 70 ? "text-green-600" : score >= 40 ? "text-yellow-500" : "text-gray-400";
  return <span className={`font-black text-sm ${color}`}>{score}</span>;
}

export function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-1">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</p>
      <p className={`text-3xl font-black leading-none ${accent ? "text-blue-600" : "text-gray-900"}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export function InfoField({ label, value, editable, onChange, placeholder }: {
  label: string; value: string; editable: boolean; onChange: (v: string) => void; placeholder?: string;
}) {
  if (!editable) return (
    <div>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm text-gray-800">{value || "—"}</p>
    </div>
  );
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">{label}</label>
      <input type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
    </div>
  );
}

export function MiniBar({ value, max, color = "#3B82F6" }: { value: number; max: number; color?: string }) {
  return (
    <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.round((value / Math.max(max, 1)) * 100)}%`, background: color }} />
    </div>
  );
}

export function StatusPill({ status, requestedVia }: { status: string; requestedVia?: string | null }) {
  // Una hora que el agente dejó pedida NO es lo mismo que una cita que alguien
  // creó a mano y está esperando al paciente: la primera necesita que un humano
  // decida, y si se ven iguales el doctor cree que tiene la agenda cerrada.
  const esperandoConfirmacion = status === "pending" && requestedVia === "agent";

  const map: Record<string, string> = {
    confirmed: "bg-emerald-50 text-emerald-700 border-emerald-100",
    pending:   "bg-amber-50 text-amber-700 border-amber-100",
    cancelled: "bg-gray-50 text-gray-400 border-gray-100",
  };
  const labels: Record<string, string> = { confirmed: "Confirmada", pending: "Pendiente", cancelled: "Cancelada" };

  if (esperandoConfirmacion) {
    return (
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap bg-amber-100 text-amber-900 border-amber-300">
        Por confirmar
      </span>
    );
  }
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${map[status] ?? map.pending}`}>
      {labels[status] ?? status}
    </span>
  );
}

