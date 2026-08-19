"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getToken,
  listPendingClinics,
  approveClinic,
  rejectClinic,
  deleteClinicAsAdmin,
  type PendingClinic,
} from "@/lib/auth";
import { Search, TriangleAlert } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// ── Types ──────────────────────────────────────────────────────────────────

interface ClinicRow {
  id: string;
  slug: string;
  name: string;
  plan: string;
  active: boolean;
  createdAt: string;
  agentEnabled: boolean;
  agentDisabledAt: string | null;
  agentDisabledReason: string | null;
  _count: { sessions: number; bookings: number; partnerUsers: number };
  usage30d: { calls: number; tokensIn: number; tokensOut: number; costUsd: number };
}

interface ModelRow {
  model: string;
  tier: string;
  calls: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}

interface DayRow { day: string; cost: number; calls: number }

interface Overview {
  totals: {
    clinics: number; sessions: number; leads: number; bookings: number;
    calls: number; tokensIn: number; tokensOut: number; costUsd: number; avgLatencyMs: number;
  };
  clinics: ClinicRow[];
  modelBreakdown: ModelRow[];
  dailyCost: DayRow[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number) { return n.toLocaleString("es-CL"); }
function fmtUsd(n: number) { return `$${n.toFixed(4)}`; }
function fmtK(n: number) { return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n); }

function planBadge(plan: string) {
  const map: Record<string, string> = {
    starter: "bg-slate-100 text-slate-600",
    pro:     "bg-teal-100 text-teal-700",
    scale:   "bg-purple-100 text-purple-700",
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${map[plan] ?? "bg-gray-100 text-gray-600"}`}>
      {plan}
    </span>
  );
}

function tierColor(tier: string) {
  return tier === "smart" ? "text-purple-600" : tier === "balanced" ? "text-teal-600" : "text-slate-400";
}

// ── Mini sparkline for daily cost ──────────────────────────────────────────

function CostSparkline({ data }: { data: DayRow[] }) {
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => d.cost), 0.0001);
  const W = 200, H = 40, pad = 4;

  const pts = data.map((d, i) => {
    const x = pad + (i / (data.length - 1 || 1)) * (W - pad * 2);
    const y = H - pad - ((d.cost / max) * (H - pad * 2));
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={W} height={H} className="overflow-visible">
      <polyline points={pts} fill="none" stroke="var(--teal-mid, #1A5C7A)" strokeWidth="1.5" strokeLinejoin="round" />
      {data.map((d, i) => {
        const x = pad + (i / (data.length - 1 || 1)) * (W - pad * 2);
        const y = H - pad - ((d.cost / max) * (H - pad * 2));
        return <circle key={i} cx={x} cy={y} r="2" fill="var(--teal-mid, #1A5C7A)" />;
      })}
    </svg>
  );
}

// ── StatCard ───────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border p-4" style={{ borderColor: "var(--border)" }}>
      <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--ink-muted)" }}>{label}</p>
      <p className="text-2xl font-bold" style={{ color: "var(--ink)" }}>{value}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: "var(--ink-muted)" }}>{sub}</p>}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<PendingClinic[]>([]);
  const [acting, setActing] = useState<string | null>(null);

  function loadPending() {
    listPendingClinics().then(setPending).catch(() => {});
  }

  useEffect(() => {
    const token = getToken();
    if (!token) { router.push("/login"); return; }

    fetch(`${API}/api/admin/overview`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (r.status === 403) { setError("Acceso denegado. Solo SUPERADMIN puede ver esta página."); setLoading(false); return null; }
        if (!r.ok) throw new Error("Error cargando datos");
        return r.json();
      })
      .then((d) => { if (d) setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });

    loadPending();
  }, [router]);

  async function handleApprove(id: string) {
    setActing(id);
    try {
      await approveClinic(id);
      setPending((p) => p.filter((c) => c.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error al aprobar");
    } finally {
      setActing(null);
    }
  }

  const [deleting, setDeleting] = useState<string | null>(null);
  async function handleDelete(c: ClinicRow) {
    // Confirmación fuerte: hay que escribir el slug exacto. Evita borrar una
    // clínica real por un clic accidental. Acción irreversible (cascada).
    const typed = window.prompt(
   ` Esto elimina la clínica "${c.name}" y TODOS sus datos (pacientes, citas, fichas, conversaciones). Es IRREVERSIBLE.\n\nEscribe el slug exacto para confirmar: ${c.slug}`
    );
    if (typed === null) return;
    if (typed.trim() !== c.slug) { alert("El slug no coincide. No se eliminó nada."); return; }
    setDeleting(c.id);
    try {
      await deleteClinicAsAdmin(c.id);
      setData((d) => d ? { ...d, clinics: d.clinics.filter((x) => x.id !== c.id) } : d);
      setPending((p) => p.filter((x) => x.id !== c.id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error al eliminar");
    } finally {
      setDeleting(null);
    }
  }

  async function handleReject(id: string) {
    const reason = window.prompt("Motivo del rechazo (se guarda y se muestra a la clínica):");
    if (reason === null) return;
    setActing(id);
    try {
      await rejectClinic(id, reason);
      setPending((p) => p.filter((c) => c.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error al rechazar");
    } finally {
      setActing(null);
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--surface)" }}>
      <p style={{ color: "var(--ink-muted)" }}>Cargando...</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--surface)" }}>
      <div className="bg-white rounded-xl border p-8 text-center max-w-sm" style={{ borderColor: "var(--border)" }}>
        <p className="font-semibold mb-1" style={{ color: "var(--ink)" }}>Sin acceso</p>
        <p className="text-sm" style={{ color: "var(--ink-muted)" }}>{error}</p>
      </div>
    </div>
  );

  if (!data) return null;

  const { totals, clinics, modelBreakdown, dailyCost } = data;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--surface)" }}>
      {/* Header */}
      <nav className="bg-white border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold" style={{ color: "var(--teal-dark)" }}>molari.ai</span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">SUPERADMIN</span>
        </div>
        <button
          onClick={() => router.push("/partners/dashboard")}
          className="text-sm font-medium hover:opacity-70 transition-opacity"
          style={{ color: "var(--ink-muted)" }}
        >
          Panel clínica
        </button>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        <div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--ink)" }}>Panel de monitoreo</h1>
          <p className="text-sm" style={{ color: "var(--ink-muted)" }}>Uso de plataforma, costos y actividad por clínica</p>
        </div>

        {/* Alertas: agentes apagados (Issue #49/#50) */}
        {clinics.some((c) => !c.agentEnabled) && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm font-bold text-red-700 mb-1"><TriangleAlert className="w-4 h-4 inline-block align-[-3px]" aria-hidden /> Agentes apagados</p>
            <ul className="text-xs text-red-600 space-y-0.5">
              {clinics.filter((c) => !c.agentEnabled).map((c) => (
                <li key={c.id}>
                  <span className="font-semibold">{c.name}</span>
                  {c.agentDisabledAt && <> · desde {new Date(c.agentDisabledAt).toLocaleString("es-CL")}</>}
                  {c.agentDisabledReason && <> · {c.agentDisabledReason}</>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Clínicas por revisar (KYC #66) */}
        {pending.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
            <div className="px-5 py-3 border-b border-amber-200 flex items-center justify-between">
              <p className="text-sm font-bold text-amber-800">
                <Search className="w-4 h-4 inline-block align-[-3px]" aria-hidden /> Clínicas por revisar
                <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-200 text-amber-800">{pending.length}</span>
              </p>
              <p className="text-xs text-amber-700">Verificación manual de identidad profesional</p>
            </div>
            <div className="divide-y divide-amber-100">
              {pending.map((c) => (
                <div key={c.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm" style={{ color: "var(--ink)" }}>{c.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--ink-muted)" }}>
                      /{c.slug}
                      {c.location && <> · {c.location}</>}
                      {" · "}{new Date(c.createdAt).toLocaleDateString("es-CL")}
                    </p>
                    <p className="text-xs mt-1" style={{ color: "var(--ink-muted)" }}>
                      {c.partnerUsers[0]
                        ? <>Admin: <span className="font-medium">{c.partnerUsers[0].name}</span> · {c.partnerUsers[0].email}</>
                        : "Sin admin"}
                    </p>
                    <p className="text-xs mt-1" style={{ color: "var(--ink)" }}>
                      RUT prof.: <span className="font-medium">{c.professionalRut ?? "—"}</span>
                      {"   ·   "}RNPI: <span className="font-medium">{c.professionalRegNumber ?? "—"}</span>
                      {c.rnpiCertUrl && (
                        <>{"   ·   "}<a href={c.rnpiCertUrl} target="_blank" rel="noopener noreferrer" className="underline text-teal-700">certificado</a></>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleReject(c.id)}
                      disabled={acting === c.id}
                      className="px-3 py-2 rounded-lg text-xs font-semibold border border-red-300 text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                    >
                      Rechazar
                    </button>
                    <button
                      onClick={() => handleApprove(c.id)}
                      disabled={acting === c.id}
                      className="px-3 py-2 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition disabled:opacity-50"
                    >
                      {acting === c.id ? "…" : "Aprobar"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* KPIs globales */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard label="Clínicas" value={totals.clinics} />
          <StatCard label="Conversaciones" value={fmt(totals.sessions)} />
          <StatCard label="Leads" value={fmt(totals.leads)} />
          <StatCard label="Citas" value={fmt(totals.bookings)} />
          <StatCard label="Costo total" value={fmtUsd(totals.costUsd)} sub={`${fmt(totals.tokensIn + totals.tokensOut)} tokens`} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Costo diario sparkline */}
          <div className="bg-white rounded-xl border p-5 lg:col-span-2" style={{ borderColor: "var(--border)" }}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--ink-muted)" }}>Costo diario (14 días)</p>
            <CostSparkline data={dailyCost} />
            <div className="flex justify-between mt-2 text-xs" style={{ color: "var(--ink-muted)" }}>
              {dailyCost.length > 0 && (
                <>
                  <span>{new Date(dailyCost[0].day).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}</span>
                  <span>{new Date(dailyCost[dailyCost.length - 1].day).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}</span>
                </>
              )}
            </div>
          </div>

          {/* Breakdown por modelo */}
          <div className="bg-white rounded-xl border p-5" style={{ borderColor: "var(--border)" }}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--ink-muted)" }}>Uso por modelo</p>
            <div className="space-y-3">
              {modelBreakdown.map((m) => (
                <div key={m.model} className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: "var(--ink)", maxWidth: 150 }}>
                      {m.model.split("/").pop()?.replace(":free", " (free)")}
                    </p>
                    <p className={`text-xs font-medium ${tierColor(m.tier)}`}>{m.tier} · {fmt(m.calls)} llamadas</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{fmtUsd(m.costUsd)}</p>
                    <p className="text-xs" style={{ color: "var(--ink-muted)" }}>{fmtK(m.tokensIn + m.tokensOut)} tok</p>
                  </div>
                </div>
              ))}
              {modelBreakdown.length === 0 && (
                <p className="text-xs" style={{ color: "var(--ink-muted)" }}>Sin datos aún</p>
              )}
            </div>
          </div>
        </div>

        {/* Tabla de clínicas */}
        <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
          <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
            <p className="font-semibold text-sm" style={{ color: "var(--ink)" }}>Clínicas registradas</p>
            <p className="text-xs" style={{ color: "var(--ink-muted)" }}>Uso: últimos 30 días</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs font-semibold uppercase tracking-wide" style={{ borderColor: "var(--border)", color: "var(--ink-muted)" }}>
                  <th className="text-left px-5 py-3">Clínica</th>
                  <th className="text-center px-3 py-3">Plan</th>
                  <th className="text-right px-3 py-3">Sesiones</th>
                  <th className="text-right px-3 py-3">Citas</th>
                  <th className="text-right px-3 py-3">Llamadas LLM</th>
                  <th className="text-right px-3 py-3">Tokens (30d)</th>
                  <th className="text-right px-5 py-3">Costo (30d)</th>
                  <th className="text-right px-3 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {clinics.map((c, i) => (
                  <tr
                    key={c.id}
                    className={`border-b transition-colors hover:bg-slate-50 ${!c.active ? "opacity-50" : ""}`}
                    style={{ borderColor: "var(--border)" }}
                  >
                    <td className="px-5 py-3">
                      <div>
                        <p className="font-semibold" style={{ color: "var(--ink)" }}>{c.name}</p>
                        <p className="text-xs" style={{ color: "var(--ink-muted)" }}>/{c.slug} · {new Date(c.createdAt).toLocaleDateString("es-CL")}</p>
                      </div>
                    </td>
                    <td className="text-center px-3 py-3">{planBadge(c.plan)}</td>
                    <td className="text-right px-3 py-3 font-medium" style={{ color: "var(--ink)" }}>{fmt(c._count.sessions)}</td>
                    <td className="text-right px-3 py-3 font-medium" style={{ color: "var(--ink)" }}>{fmt(c._count.bookings)}</td>
                    <td className="text-right px-3 py-3 font-medium" style={{ color: "var(--ink)" }}>{fmt(c.usage30d.calls)}</td>
                    <td className="text-right px-3 py-3 text-xs" style={{ color: "var(--ink-muted)" }}>
                      {fmtK(c.usage30d.tokensIn)}↑ / {fmtK(c.usage30d.tokensOut)}↓
                    </td>
                    <td className="text-right px-5 py-3 font-semibold" style={{ color: c.usage30d.costUsd > 1 ? "var(--coral)" : "var(--ink)" }}>
                      {fmtUsd(c.usage30d.costUsd)}
                    </td>
                    <td className="text-right px-3 py-3">
                      <button
                        onClick={() => handleDelete(c)}
                        disabled={deleting === c.id}
                        title="Eliminar clínica y todos sus datos"
                        className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                      >
                        {deleting === c.id ? "…" : "Eliminar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Latencia promedio */}
        <p className="text-xs text-center pb-4" style={{ color: "var(--ink-muted)" }}>
          Latencia promedio LLM: {totals.avgLatencyMs}ms · {fmt(totals.calls)} llamadas totales
        </p>
      </div>
    </div>
  );
}
