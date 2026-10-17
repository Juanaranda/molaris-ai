"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { AuthUser, ClinicData } from "@/lib/auth";
import {
  citasActivasDelDoctor,
  fechaLocal,
  fetchAgendaDelDia,
  proximaCita,
  saludo,
  type AgendaBooking,
} from "@/lib/doctorView";
import { Button, Card } from "@/components/ui";
import { RoleBadge, StatusPill } from "./widgets";

/**
 * Vista reducida para quien tiene rol USER: ve sus propias citas y poco más.
 * Sale de page.tsx porque es una pantalla completa distinta, no una sección
 * del panel de administración.
 *
 * Es la pantalla que ve un doctor como Juan Garcés al abrir la app en el
 * celular. Con la base de diseño (MOL-46): fondo y textos de la marca,
 * contraste legible, botones de 44px y saludo según la hora.
 */

export function DoctorView({ user, clinic, onShowFull }: { user: AuthUser; clinic: ClinicData; onShowFull: () => void }) {
  const [activeBookings, setActiveBookings] = useState<AgendaBooking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);

  const todayStr = fechaLocal();
  const firstName = user.name?.split(" ")[0] ?? user.name ?? "";

  // Solo la primera letra en mayúscula: con la clase `capitalize` salía
  // "Sábado, 17 De Octubre".
  const fecha = new Date().toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });
  const todayLabel = fecha.charAt(0).toUpperCase() + fecha.slice(1);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoadingBookings(true);
      try {
        const data = await fetchAgendaDelDia(todayStr, controller.signal);
        setActiveBookings(citasActivasDelDoctor(data, user.name ?? ""));
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
      } finally { if (!controller.signal.aborted) setLoadingBookings(false); }
    }
    load();
    return () => controller.abort();
  }, [todayStr, user.name]);

  const nextBooking = proximaCita(activeBookings);

  return (
    <div className="min-h-screen flex flex-col bg-ground text-ink">
      <nav className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3 sm:px-8">
        <Link href="/"><Image src="/logo.svg" alt="molari.ai" width={120} height={42} style={{ height: "auto" }} preload /></Link>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-ink-muted sm:block">{user.name}</span>
          <RoleBadge role={user.role} />
          <Button variant="secondary" onClick={onShowFull}>Panel completo</Button>
        </div>
      </nav>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
        <header>
          <p className="text-sm font-semibold text-ink-muted">{todayLabel}</p>
          <h1 className="mt-0.5 text-[28px] font-extrabold tracking-tight text-brand-strong">
            {saludo()}{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="mt-0.5 text-sm text-ink-muted">{clinic.name}</p>
        </header>

        <div className="grid grid-cols-2 gap-3">
          <Card>
            <p className="text-sm text-ink-muted">Citas hoy</p>
            <p className="mt-1 text-3xl font-extrabold leading-none text-brand-strong">
              {loadingBookings ? "—" : activeBookings.length}
            </p>
          </Card>
          <Card>
            <p className="text-sm text-ink-muted">Próxima cita</p>
            <p className="mt-1 text-3xl font-extrabold leading-none text-brand-strong tabular-nums">
              {loadingBookings ? "—" : nextBooking ? nextBooking.time : "—"}
            </p>
            {nextBooking && (
              <p className="mt-1 truncate text-sm text-ink-muted">{nextBooking.patientName ?? "Paciente"}</p>
            )}
          </Card>
        </div>

        <Card title="Agenda de hoy" padded={false}
          action={!loadingBookings ? (
            <span className="text-sm text-ink-muted">{activeBookings.length} cita{activeBookings.length !== 1 ? "s" : ""}</span>
          ) : undefined}>
          {loadingBookings && (
            <div className="flex items-center justify-center py-12" role="status" aria-label="Cargando tu agenda">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-strong border-t-transparent" />
            </div>
          )}

          {!loadingBookings && activeBookings.length === 0 && (
            <p className="py-12 text-center text-sm text-ink-muted">No tienes citas para hoy.</p>
          )}

          {!loadingBookings && activeBookings.length > 0 && (
            <ul>
              {activeBookings.map((b) => (
                <li key={b.id} className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3 border-t border-line-soft px-5 py-3.5">
                  <span className="text-[15px] font-bold tabular-nums text-brand-strong">{b.time}</span>
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold">{b.patientName ?? "Paciente"}</p>
                    {b.service && <p className="truncate text-sm text-ink-muted">{b.service}</p>}
                  </div>
                  <StatusPill status={b.status} requestedVia={b.requestedVia} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Button variant="secondary" block onClick={onShowFull}>Ver agenda completa</Button>
      </main>
    </div>
  );
}
