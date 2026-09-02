"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getMe, getToken, logout, updateClinic, AuthUser, ClinicData } from "@/lib/auth";
import { BookingsTab } from "@/components/BookingsTab";
import { SetupChecklist } from "@/components/SetupChecklist";
import { AgendaTab } from "@/components/AgendaTab";
import { PatientsTab } from "@/components/PatientsTab";
import { DashboardTab } from "@/components/DashboardTab";
import { ClinicProfileTab } from "@/components/ClinicProfileTab";
import { MyProfileTab } from "@/components/MyProfileTab";
import { TeamTab } from "@/components/TeamTab";
import { ConversationsTab } from "@/components/ConversationsTab";
import { ChangePasswordGate } from "@/components/ChangePasswordGate";
import { InventoryManager } from "@/components/InventoryManager";
import { EmailVerificationBanner } from "@/components/EmailVerificationBanner";
import { AnalyticsPanel } from "@/components/dashboard/AnalyticsPanel";
import { ConfigTab } from "@/components/dashboard/ConfigTab";
import { DoctorView } from "@/components/dashboard/DoctorView";
import { InfoField, RoleBadge } from "@/components/dashboard/widgets";
import type { Analytics, ClinicConfig, Tab } from "@/components/dashboard/types";
import { TriangleAlert, X, Zap } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/* ─── Dashboard principal ──────────────────────────────────────────────────── */
export default function PartnersDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  const [clinic, setClinic] = useState<ClinicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("inicio");
  // Al saltar a una pestaña desde un acceso rápido, en móvil puede quedar fuera
  // de la parte visible de la barra y parece que no pasó nada.
  useEffect(() => {
    const activa = tabsRef.current?.querySelector<HTMLElement>("[data-tab-activa=\"true\"]");
    activa?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [activeTab]);
  const [agendaAutoOpen, setAgendaAutoOpen] = useState(false);
  const [mpNotice, setMpNotice] = useState<"connected" | "error" | null>(null);

  // Retorno del OAuth de Mercado Pago (Issue #48): ?mp=connected|error
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mp = params.get("mp");
    if (mp === "connected" || mp === "error") {
      setMpNotice(mp);
      setActiveTab("clinica");
      params.delete("mp");
      const qs = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
    }
  }, []);

  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [forceFull, setForceFull] = useState(false);


  useEffect(() => {
    let mounted = true;
    getMe().then((data) => {
      if (!mounted) return;
      if (!data) { router.push("/login"); return; }
      setUser(data.user);
      setClinic(data.clinic);
      setLoading(false);
      if (data.clinic) fetchAnalytics(data.clinic.id);
    });
    return () => { mounted = false; };
  }, [router]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchAnalytics(clinicId: string) {
    setAnalyticsLoading(true);
    try {
      const res = await fetch(`${API}/api/clinics/${clinicId}/analytics`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) setAnalytics(await res.json());
    } catch {}
    finally { setAnalyticsLoading(false); }
  }

  function handleLogout() { logout(); router.push("/"); }


  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERADMIN";
  const cfg = (clinic?.config as ClinicConfig) ?? {};

  if (!loading && user?.role === "USER" && clinic && !forceFull) {
    return <DoctorView user={user} clinic={clinic} onShowFull={() => setForceFull(true)} />;
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Gate bloqueante: forzar cambio de password en primer login */}
      {user?.mustChangePassword && (
        <ChangePasswordGate onSuccess={() => setUser({ ...user, mustChangePassword: false })} />
      )}

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 sm:px-8 py-4 border-b border-gray-100 sticky top-0 z-10" style={{ backgroundColor: "#FDFCFB" }}>
        <Link href="/"><Image src="/logo.svg" alt="molari.ai" width={120} height={42} style={{ height: "auto" }} preload /></Link>
        <div className="flex items-center gap-4">
{user && <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 hidden sm:block">{user.name}</span>
            <RoleBadge role={user.role} />
          </div>}
          <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-900 transition-colors py-2.5 px-1 -mx-1">Cerrar sesión</button>
        </div>
      </nav>

      <div className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-8 py-8 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{clinic?.name ?? "Sin clínica"}</h1>
            <p className="text-sm text-gray-500 mt-0.5">Panel de administración · molari.ai</p>
          </div>
          {clinic && (
            <Link href="/partners/preview"
              className="text-sm text-white font-bold px-5 py-2.5 rounded-full shadow-md hover:shadow-lg hover:scale-105 transition-all duration-150 active:scale-95"
              style={{ backgroundColor: "#D95F45" }}>
              Probar asistente
            </Link>
          )}
        </div>

        <EmailVerificationBanner user={user} />

        {!clinic && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6 text-sm text-yellow-800">
            Tu usuario no tiene una clínica asignada. Contacta al equipo de molari.ai.
          </div>
        )}

        {clinic && (() => {
          const cfg = clinic.config as Record<string, unknown>;
          const doctorsArr = Array.isArray(cfg.doctors) ? cfg.doctors : [];
          const onboardingDone = cfg.onboardingDone === true || doctorsArr.length > 0;
          return !onboardingDone ? (
            <div className="flex items-center gap-4 px-5 py-4 rounded-2xl border"
              style={{ backgroundColor: "#FFF8F1", borderColor: "#FDD9A0" }}>
              <span className="text-2xl shrink-0"><Zap className="w-4 h-4" aria-hidden /></span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold" style={{ color: "#92400E" }}>Completa la configuración inicial</p>
                <p className="text-xs mt-0.5" style={{ color: "#B45309" }}>
                  Agrega tus doctores, horario y canales para que el asistente funcione correctamente.
                </p>
              </div>
              <Link href="/partners/setup"
                className="shrink-0 px-4 py-2 rounded-xl text-xs font-bold text-white transition hover:opacity-90"
                style={{ backgroundColor: "#D95F45" }}>
                Configurar
              </Link>
            </div>
          ) : null;
        })()}

        {clinic && (
          <>
            {/* Aviso de retorno del OAuth de Mercado Pago */}
            {mpNotice && (
              <div className={`mb-4 rounded-xl px-4 py-2.5 text-sm font-medium flex items-center justify-between ${
                mpNotice === "connected" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-600 border border-red-200"
              }`}>
                <span>{mpNotice === "connected" ? "Mercado Pago conectado correctamente." : "No se pudo conectar Mercado Pago. Intenta de nuevo."}</span>
                <button onClick={() => setMpNotice(null)} className="text-current opacity-60 hover:opacity-100"><X className="w-4 h-4" aria-hidden /></button>
              </div>
            )}

            {/* Tabs — en móvil no caben todas y hay que deslizar. El degradado del
                borde derecho es la única pista de que hay más: sin él, "Equipo",
                "Inventario" y "Mi Clínica" son invisibles en un teléfono. */}
            <div className="relative -mx-4 sm:mx-0">
              <div
                ref={tabsRef}
                className="overflow-x-auto px-4 sm:px-0 scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
              <div className="flex border-b border-gray-200 gap-1 min-w-max sm:min-w-0">
                {(([
                  ["inicio", "Inicio"], ["conversaciones", "Conversaciones"], ["agenda", "Agenda"], ["analytics", "Analítica"],
                  ["patients", "Pacientes"], ["bookings", "Citas"], ["perfil", "Mi Perfil"],
                  // Modo solo (#69): un doctor independiente no tiene equipo ni inventario de clínica
                  ...(user && user.role !== "USER" && clinic?.accountType !== "solo" ? [["equipo", "Equipo"]] as [Tab, string][] : []),
                  ...(clinic?.accountType !== "solo" ? [["inventario", "Inventario"]] as [Tab, string][] : []),
                  ["clinica", clinic?.accountType === "solo" ? "Mi consulta" : "Mi Clínica"], ["config", "Configuración"],
                ] as [Tab, string][])).map(([tab, label]) => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    data-tab-activa={activeTab === tab}
                    className={`px-3.5 sm:px-4 py-3 sm:py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                      activeTab === tab
                        ? "border-blue-600 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
              </div>
              <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-[#FDFCFB] to-transparent sm:hidden" />
            </div>

            {/* ══ Estado de verificación (KYC #66) ═══════════════════════════ */}
            {clinic?.verificationStatus === "REJECTED" && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm font-bold text-red-700 mb-0.5">Cuenta no verificada</p>
                <p className="text-xs text-red-600">
                  No pudimos verificar tu clínica.
                  {clinic.rejectionReason ? ` Motivo: ${clinic.rejectionReason}.` : ""}
                  {" "}Escríbenos a soporte para revisarlo.
                </p>
              </div>
            )}
            {clinic?.verificationStatus === "PENDING" && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-sm font-bold text-amber-700 mb-0.5">Verificación en revisión</p>
                <p className="text-xs text-amber-600">
                  Estamos verificando los datos de tu clínica. Puedes seguir configurando tu cuenta mientras tanto.
                </p>
              </div>
            )}

            {/* ══ TAB INICIO ═════════════════════════════════════════════════ */}
            {activeTab === "inicio" && clinic && (
              <DashboardTab
                clinicId={clinic.id}
                onNewBooking={() => { setAgendaAutoOpen(true); setActiveTab("agenda"); }}
                onNewPatient={() => setActiveTab("patients")}
              />
            )}

            {/* ══ TAB CONVERSACIONES ═════════════════════════════════════════ */}
            {activeTab === "conversaciones" && <ConversationsTab />}

            {/* ══ TAB ANALÍTICA ══════════════════════════════════════════════ */}
            {activeTab === "analytics" && (
              <AnalyticsPanel
                clinic={clinic}
                analytics={analytics}
                loading={analyticsLoading}
                onGoToConfig={() => setActiveTab("config")}
                onRetry={() => fetchAnalytics(clinic.id)}
              />
            )}

            {/* ══ TAB AGENDA ═════════════════════════════════════════════════ */}
            {activeTab === "agenda" && user && (
              <div className="flex flex-col gap-4">
                {/* Canales activos */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                  {/* WhatsApp */}
                  <a
                    href={clinic.whatsapp ? `https://wa.me/${clinic.whatsapp.replace(/\D/g, "")}` : undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl border transition-shadow hover:shadow-md"
                    style={{ backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }}
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "#25D366" }}>
                      <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.099.546 4.07 1.5 5.786L0 24l6.389-1.674A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.65-.51-5.17-1.4L2.5 21.5l.93-4.194A9.944 9.944 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-800">WhatsApp</p>
                      <p className="text-[10px] font-semibold" style={{ color: clinic.whatsapp ? "#16a34a" : "#9ca3af" }}>
                        {clinic.whatsapp ? "Activo" : "Sin configurar"}
                      </p>
                    </div>
                    {clinic.whatsapp && (
                      <span className="ml-auto w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
                    )}
                  </a>

                  {/* Web Widget */}
                  <a
                    href="/partners/preview"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl border transition-shadow hover:shadow-md"
                    style={{ backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }}
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "#1A5C7A" }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.8} className="w-5 h-5">
                        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-800">Web Widget</p>
                      <p className="text-[10px] font-semibold text-blue-600">Probar asistente</p>
                    </div>
                    <span className="ml-auto w-2 h-2 rounded-full bg-blue-400 animate-pulse shrink-0" />
                  </a>
                </div>

                <AgendaTab
                  user={user}
                  boxes={(clinic.config as ClinicConfig).boxes ?? 2}
                  doctors={(clinic.config as ClinicConfig).doctors?.map((d) => d.name) ?? []}
                  sedes={(clinic.config as ClinicConfig).sedes ?? []}
                  scheduleConfig={(clinic.config as ClinicConfig).schedule as Record<string, string> | undefined}
                  openNewBookingOnMount={agendaAutoOpen}
                />
              </div>
            )}

            {/* ══ TAB PACIENTES ══════════════════════════════════════════════ */}
            {activeTab === "patients" && (
              <PatientsTab />
            )}

            {/* ══ TAB CITAS ══════════════════════════════════════════════════ */}
            {activeTab === "bookings" && (
              <BookingsTab clinicId={clinic.id} />
            )}

            {/* ══ TAB MI PERFIL ══════════════════════════════════════════════ */}
            {activeTab === "perfil" && user && (
              <MyProfileTab
                user={user}
                onUpdate={(updated) => { setUser(updated); }}
              />
            )}

            {/* ══ TAB EQUIPO ═════════════════════════════════════════════════ */}
            {activeTab === "equipo" && user && clinic && user.role !== "USER" && (
              <TeamTab clinicId={clinic.id} currentUser={user} />
            )}

            {/* ══ TAB INVENTARIO ═════════════════════════════════════════════ */}
            {activeTab === "inventario" && clinic && (
              <InventoryManager clinicId={clinic.id} />
            )}

            {/* ══ TAB CONFIGURACIÓN — su estado vive en el propio componente ═ */}
            {activeTab === "config" && clinic && (
              <ConfigTab clinic={clinic} canEdit={canEdit} onClinicUpdated={setClinic} />
            )}

            {/* ══ TAB MI CLÍNICA ═════════════════════════════════════════════ */}
            {activeTab === "clinica" && clinic && (
              <ClinicProfileTab
                clinic={clinic}
                canEdit={canEdit}
                onUpdate={(updated) => { setClinic(updated); }}
              />
            )}

          </>
        )}
      </div>
    </div>
  );
}
