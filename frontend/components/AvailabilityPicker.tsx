"use client";

import { useEffect, useState } from "react";
import { getMondayOf } from "@/lib/dateParser";

interface Slot {
  time: string;
  doctor: string;
  box: string | null;
  available: boolean;
}

interface DayAvailability {
  date: string;
  dayName: string;
  isOpen: boolean;
  slots: Slot[];
}

interface Props {
  service?: string;
  doctorFilter?: string;
  preferredDate?: string;
  color?: string;
  onSelect: (slot: { date: string; dayName: string; time: string; doctor: string; box: string | null }) => void;
  onDismiss?: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function getMondayOfWeek(offset = 0): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff + offset * 7);
  return monday.toISOString().slice(0, 10);
}

function formatTabDate(date: string): string {
  return new Date(date + "T12:00:00").getDate().toString();
}

function weekOffsetForDate(targetDate: string): number {
  const targetMonday = getMondayOf(targetDate);
  const currentMonday = getMondayOfWeek(0);
  const diffMs = new Date(targetMonday).getTime() - new Date(currentMonday).getTime();
  return Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
}

export function AvailabilityPicker({ service, doctorFilter, preferredDate, color = "#0891B2", onSelect, onDismiss }: Props) {
  const initialOffset = preferredDate ? weekOffsetForDate(preferredDate) : 0;
  const [weekOffset, setWeekOffset] = useState(Math.max(0, initialOffset));
  const [days, setDays] = useState<DayAvailability[]>([]);
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [loading, setLoading] = useState(true);

  const weekStart = getMondayOfWeek(weekOffset);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setSelectedSlot(null);
    const params = new URLSearchParams({ weekStart });
    if (service) params.set("service", service);
    if (doctorFilter) params.set("doctor", doctorFilter);

    fetch(`${API_URL}/api/availability?${params}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error("non-200");
        return r.json();
      })
      .then((data: { days: DayAvailability[] }) => {
        const fetchedDays = data.days ?? [];
        setDays(fetchedDays);

        // Saltar al día preferido si cae en esta semana, si no al primer día abierto
        if (preferredDate) {
          const idx = fetchedDays.findIndex((d) => d.date === preferredDate && d.isOpen);
          if (idx >= 0) { setSelectedDay(idx); return; }
        }
        const firstOpen = fetchedDays.findIndex((d) => d.isOpen);
        setSelectedDay(firstOpen >= 0 ? firstOpen : 0);
      })
      .catch((err) => { if (err.name !== "AbortError") setDays([]); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });

    return () => controller.abort();
  }, [weekStart, service, doctorFilter, preferredDate]);

  const currentDay = days[selectedDay];

  // Filtrar slots por doctor si hay filtro
  const visibleSlots = doctorFilter
    ? currentDay?.slots.filter((s) => s.doctor.toLowerCase().includes(doctorFilter.toLowerCase()))
    : currentDay?.slots;

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-4 text-sm text-gray-400 text-center">
        Cargando disponibilidad...
      </div>
    );
  }

  return (
    <div style={{ borderColor: `${color}22` }} className="rounded-2xl border bg-white shadow-sm overflow-hidden w-full max-w-sm">
      {/* Header semana */}
      <div style={{ backgroundColor: `${color}11`, borderColor: `${color}22` }} className="flex items-center justify-between px-4 py-2.5 border-b">
        <button
          onClick={() => setWeekOffset((w) => w - 1)}
          disabled={weekOffset === 0}
          style={{ color }} className="disabled:opacity-30 transition p-1 rounded font-bold text-lg leading-none"
        >‹</button>
        <span style={{ color }} className="text-xs font-semibold uppercase tracking-wide">
          {weekOffset === 0 ? "Esta semana" : weekOffset === 1 ? "Próxima semana" : `Sem. del ${weekStart}`}
        </span>
        <button onClick={() => setWeekOffset((w) => w + 1)} style={{ color }} className="transition p-1 rounded font-bold text-lg leading-none">›</button>
      </div>

      {/* Tabs de días */}
      <div className="flex border-b border-gray-100 overflow-x-auto">
        {days.map((day, idx) => (
          <button
            key={day.date}
            disabled={!day.isOpen}
            onClick={() => { setSelectedDay(idx); setSelectedSlot(null); }}
            style={idx === selectedDay && day.isOpen ? { color, borderColor: color, backgroundColor: `${color}0d` } : {}}
            className={`flex-1 min-w-[44px] py-2 px-1 text-center text-xs font-medium transition border-b-2 ${
              !day.isOpen
                ? "text-gray-300 cursor-not-allowed border-transparent"
                : idx === selectedDay
                ? "border-current"
                : "text-gray-500 border-transparent"
            }`}
          >
            <div className="text-[10px] uppercase">{day.dayName.slice(0, 3)}</div>
            <div className="font-bold text-sm">{formatTabDate(day.date)}</div>
          </button>
        ))}
      </div>

      {/* Grilla de slots */}
      <div className="p-3 max-h-52 overflow-y-auto">
        {currentDay?.isOpen && visibleSlots && visibleSlots.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {visibleSlots.map((slot) => {
              const isSelected = selectedSlot?.time === slot.time && selectedSlot?.doctor === slot.doctor;
              return (
                <button
                  key={`${slot.time}-${slot.doctor}`}
                  disabled={!slot.available}
                  onClick={() => setSelectedSlot(isSelected ? null : slot)}
                  style={isSelected ? { backgroundColor: color, borderColor: color } : {}}
                  className={`rounded-xl px-3 py-2 text-left transition border ${
                    !slot.available
                      ? "bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed"
                      : isSelected
                      ? "text-white shadow"
                      : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <div className="font-bold text-sm">{slot.time}</div>
                  <div className={`text-[10px] truncate ${isSelected ? "text-white/70" : "text-gray-400"}`}>
                    {slot.doctor}{slot.box ? ` · ${slot.box}` : ""}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-center text-gray-400 text-sm py-4">
            {currentDay?.isOpen ? "Sin horarios disponibles" : "Cerrado"}
          </p>
        )}
      </div>

      {/* Confirmar */}
      {selectedSlot && currentDay && (
        <div className="px-3 pt-1 pb-2">
          <button
            onClick={() => onSelect({ date: currentDay.date, dayName: currentDay.dayName, time: selectedSlot.time, doctor: selectedSlot.doctor, box: selectedSlot.box })}
            style={{ backgroundColor: color }}
            className="w-full text-white font-semibold rounded-xl py-2.5 text-sm transition hover:opacity-90"
          >
            Confirmar {currentDay.dayName} {formatTabDate(currentDay.date)} · {selectedSlot.time}
          </button>
        </div>
      )}

      {/* Continuar conversando sin agendar */}
      {onDismiss && (
        <div className="px-3 pb-3">
          <button
            onClick={onDismiss}
            className="w-full text-gray-400 text-xs py-1.5 hover:text-gray-600 transition"
          >
            Continuar conversando →
          </button>
        </div>
      )}
    </div>
  );
}
