"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { getToken, type AuthUser, type ClinicData } from "@/lib/auth";
import { RoleBadge, StatusPill } from "./widgets";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/**
 * Vista reducida para quien tiene rol USER: ve sus propias citas y poco más.
 * Sale de page.tsx porque es una pantalla completa distinta, no una sección
 * del panel de administración.
 */

interface DoctorBooking {
  id: string;
  startTime: string;
  patientName: string | null;
  service: string | null;
  status: string;
  doctor: string | null;
}

export function DoctorView({ user, clinic, onShowFull }: { user: AuthUser; clinic: ClinicData; onShowFull: () => void }) {
  const [bookings, setBookings] = useState<DoctorBooking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);

  const todayStr = new Date().toISOString().slice(0, 10);
  const firstName = user.name?.split(" ")[0] ?? user.name ?? "Doctor/a";

  const todayLabel = new Date().toLocaleDateString("es-CL", {
    weekday: "long", day: "numeric", month: "long",
  });

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoadingBookings(true);
      try {
        const res = await fetch(`${API}/api/agenda/bookings?date=${todayStr}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
          signal: controller.signal,
        });
        if (res.ok) {
          const data: DoctorBooking[] = await res.json();
          const filtered = data.filter((b) =>
            b.doctor && b.doctor.toLowerCase().includes(user.name?.split(" ").pop()?.toLowerCase() ?? "")
          );
          setBookings(filtered);
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
      } finally { if (!controller.signal.aborted) setLoadingBookings(false); }
    }
    load();
    return () => controller.abort();
  }, [todayStr, user.name]);

  const activeBookings = bookings.filter((b) => b.status !== "cancelled");
  const nextBooking = activeBookings.find((b) => new Date(b.startTime) > new Date());

  function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#F8FAFC" }}>
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 sm:px-8 py-4 bg-white border-b border-gray-100 sticky top-0 z-10">
        <Link href="/"><Image src="/logo.svg" alt="molari.ai" width={120} height={42} style={{ height: "auto" }} preload /></Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600 hidden sm:block">{user.name}</span>
          <RoleBadge role={user.role} />
          <button
            onClick={onShowFull}
            className="text-xs font-medium text-gray-500 hover:text-gray-800 border border-gray-200 px-3 py-1.5 rounded-lg transition-colors">
            Ver panel completo
          </button>
        </div>
      </nav>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 py-8 flex flex-col gap-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-black" style={{ color: "#0B2F42" }}>
            Buenos dias, {firstName}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5 capitalize">{todayLabel}</p>
          <p className="text-xs text-gray-400 mt-0.5">{clinic.name}</p>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-1">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Citas hoy</p>
            <p className="text-3xl font-black leading-none" style={{ color: "#0B2F42" }}>
              {loadingBookings ? "—" : activeBookings.length}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-1">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Proxima cita</p>
            <p className="text-3xl font-black leading-none" style={{ color: "#D95F45" }}>
              {loadingBookings ? "—" : nextBooking ? fmtTime(nextBooking.startTime) : "—"}
            </p>
            {nextBooking && (
              <p className="text-xs text-gray-400 mt-0.5 truncate">{nextBooking.patientName ?? "Paciente"}</p>
            )}
          </div>
        </div>

        {/* Appointments list */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 text-sm">Agenda de hoy</h2>
            {!loadingBookings && (
              <span className="text-xs text-gray-400">{activeBookings.length} cita{activeBookings.length !== 1 ? "s" : ""}</span>
            )}
          </div>

          {loadingBookings && (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#0B2F42", borderTopColor: "transparent" }} />
            </div>
          )}

          {!loadingBookings && activeBookings.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-sm text-gray-400">Sin citas programadas para hoy.</p>
            </div>
          )}

          {!loadingBookings && activeBookings.length > 0 && (
            <div className="divide-y divide-gray-50">
              {activeBookings.map((b) => (
                <div key={b.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                  <div className="shrink-0 w-14 text-center">
                    <span className="text-sm font-black" style={{ color: "#0B2F42" }}>{fmtTime(b.startTime)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{b.patientName ?? "Paciente"}</p>
                    {b.service && <p className="text-xs text-gray-400 truncate mt-0.5">{b.service}</p>}
                  </div>
                  <StatusPill status={b.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Link to full agenda */}
        <button
          onClick={onShowFull}
          className="text-sm font-semibold text-center py-3 rounded-2xl border-2 transition-colors hover:bg-gray-50"
          style={{ borderColor: "#0B2F42", color: "#0B2F42" }}>
          Ver agenda completa
        </button>
      </div>
    </div>
  );
}

