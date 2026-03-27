"use client";

import { useEffect, useState } from "react";

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
  onSelect: (slot: { date: string; dayName: string; time: string; doctor: string; box: string | null }) => void;
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
  const d = new Date(date + "T12:00:00");
  return d.getDate().toString();
}

export function AvailabilityPicker({ service, onSelect }: Props) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [days, setDays] = useState<DayAvailability[]>([]);
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [loading, setLoading] = useState(true);

  const weekStart = getMondayOfWeek(weekOffset);

  useEffect(() => {
    setLoading(true);
    setSelectedSlot(null);
    const serviceParam = service ? `&service=${encodeURIComponent(service)}` : "";
    fetch(`${API_URL}/api/availability?weekStart=${weekStart}${serviceParam}`)
      .then((r) => r.json())
      .then((data) => {
        setDays(data.days ?? []);
        // Auto-select primer día abierto
        const firstOpen = (data.days ?? []).findIndex((d: DayAvailability) => d.isOpen);
        setSelectedDay(firstOpen >= 0 ? firstOpen : 0);
      })
      .finally(() => setLoading(false));
  }, [weekStart]);

  const openDays = days.filter((d) => d.isOpen);
  const currentDay = days[selectedDay];

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-4 text-sm text-gray-400 text-center">
        Cargando disponibilidad...
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-sky-100 bg-white shadow-sm overflow-hidden w-full max-w-sm">
      {/* Header semana */}
      <div className="flex items-center justify-between px-4 py-3 bg-sky-50 border-b border-sky-100">
        <button
          onClick={() => setWeekOffset((w) => w - 1)}
          disabled={weekOffset === 0}
          className="text-sky-500 disabled:opacity-30 hover:text-sky-700 transition p-1 rounded"
        >
          ‹
        </button>
        <span className="text-xs font-semibold text-sky-700 uppercase tracking-wide">
          {weekOffset === 0 ? "Esta semana" : weekOffset === 1 ? "Próxima semana" : `Semana del ${weekStart}`}
        </span>
        <button
          onClick={() => setWeekOffset((w) => w + 1)}
          className="text-sky-500 hover:text-sky-700 transition p-1 rounded"
        >
          ›
        </button>
      </div>

      {/* Tabs de días */}
      <div className="flex border-b border-gray-100 overflow-x-auto scrollbar-hide">
        {days.map((day, idx) => (
          <button
            key={day.date}
            disabled={!day.isOpen}
            onClick={() => { setSelectedDay(idx); setSelectedSlot(null); }}
            className={`flex-1 min-w-[44px] py-2 px-1 text-center text-xs font-medium transition border-b-2 ${
              !day.isOpen
                ? "text-gray-300 cursor-not-allowed border-transparent"
                : idx === selectedDay
                ? "text-sky-600 border-sky-500 bg-sky-50/60"
                : "text-gray-500 border-transparent hover:text-sky-500"
            }`}
          >
            <div className="text-[10px] uppercase">{day.dayName.slice(0, 3)}</div>
            <div className="font-bold text-sm">{formatTabDate(day.date)}</div>
          </button>
        ))}
      </div>

      {/* Grilla de slots */}
      <div className="p-3 max-h-56 overflow-y-auto">
        {currentDay?.isOpen ? (
          <div className="grid grid-cols-2 gap-2">
            {currentDay.slots.map((slot) => {
              const isSelected = selectedSlot?.time === slot.time;
              return (
                <button
                  key={slot.time}
                  disabled={!slot.available}
                  onClick={() => setSelectedSlot(isSelected ? null : slot)}
                  className={`rounded-xl px-3 py-2 text-left transition border ${
                    !slot.available
                      ? "bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed"
                      : isSelected
                      ? "bg-sky-500 border-sky-500 text-white shadow"
                      : "bg-white border-gray-200 text-gray-700 hover:border-sky-300 hover:bg-sky-50"
                  }`}
                >
                  <div className="font-bold text-sm">{slot.time}</div>
                  <div className={`text-[10px] truncate ${isSelected ? "text-sky-100" : "text-gray-400"}`}>
                    {slot.doctor}{slot.box ? ` · ${slot.box}` : ""}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-center text-gray-400 text-sm py-4">Cerrado</p>
        )}
      </div>

      {/* Confirmar */}
      {selectedSlot && currentDay && (
        <div className="px-3 pb-3">
          <button
            onClick={() =>
              onSelect({
                date: currentDay.date,
                dayName: currentDay.dayName,
                time: selectedSlot.time,
                doctor: selectedSlot.doctor,
                box: selectedSlot.box,
              })
            }
            className="w-full bg-sky-500 hover:bg-sky-600 text-white font-semibold rounded-xl py-2.5 text-sm transition"
          >
            Confirmar {currentDay.dayName} {formatTabDate(currentDay.date)} a las {selectedSlot.time}
          </button>
        </div>
      )}
    </div>
  );
}
