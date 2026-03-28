import { galanaConfig, type Doctor } from "../../config/clinics/galana";

export interface Slot {
  time: string;
  doctor: string;
  box: string | null;
  available: boolean;
}

export interface DayAvailability {
  date: string;
  dayName: string;
  isOpen: boolean;
  slots: Slot[];
}

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function getSlotsForDay(isWeekday: boolean, durationMin: number): string[] {
  const [startH, endH] = isWeekday ? [10, 18] : [10, 14];
  const times: string[] = [];
  let current = startH * 60;
  const end = endH * 60;
  while (current + durationMin <= end) {
    const hh = Math.floor(current / 60).toString().padStart(2, "0");
    const mm = (current % 60).toString().padStart(2, "0");
    times.push(`${hh}:${mm}`);
    current += durationMin;
  }
  return times;
}

function seededRandom(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h) / 2147483647;
}

function isSlotInPast(dateStr: string, time: string): boolean {
  const now = new Date();
  const [hh, mm] = time.split(":").map(Number);
  const slotDate = new Date(dateStr + "T12:00:00");
  slotDate.setHours(hh, mm, 0, 0);
  // Agregar buffer de 30 min (no se puede agendar para "ahora mismo")
  return slotDate.getTime() < now.getTime() + 30 * 60 * 1000;
}

export function getWeekAvailability(weekStart: string, service?: string): DayAvailability[] {
  const start = new Date(weekStart + "T12:00:00");
  const result: DayAvailability[] = [];
  const { doctors, boxes, slotDurationMin } = galanaConfig;
  const duration = slotDurationMin ?? 45;

  const todayStr = new Date().toISOString().slice(0, 10);

  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const dow = date.getDay(); // 0=Dom, 1=Lun ... 6=Sáb
    const isWeekday = dow >= 1 && dow <= 5;
    const isSaturday = dow === 6;
    const isOpen = isWeekday || isSaturday;
    const dateStr = date.toISOString().slice(0, 10);

    // Días pasados o domingo: cerrado
    if (!isOpen || dateStr < todayStr) {
      result.push({ date: dateStr, dayName: DAY_NAMES[dow], isOpen: false, slots: [] });
      continue;
    }

    // Doctores que trabajan este día del mes
    const workingDoctors = doctors.filter((d) => d.workDays.includes(dow));

    // Filtrar por servicio si se indica
    const eligibleDoctors: Doctor[] = service
      ? workingDoctors.filter((d) =>
          d.services.some((s) => s.toLowerCase().includes(service.toLowerCase()))
        )
      : workingDoctors;

    const activeDoctors = eligibleDoctors.length > 0 ? eligibleDoctors : workingDoctors;

    if (activeDoctors.length === 0) {
      // Nadie trabaja este día
      result.push({ date: dateStr, dayName: DAY_NAMES[dow], isOpen: false, slots: [] });
      continue;
    }

    const times = getSlotsForDay(isWeekday, duration);

    // Pool dinámico: todos los boxes de la clínica.
    // Los boxes de especialistas que NO trabajan hoy se liberan al pool.
    const busyBoxes = new Set(
      workingDoctors.filter((d) => d.box).map((d) => d.box as string)
    );
    const freePool = boxes.filter((b) => !busyBoxes.has(b));

    const slots: Slot[] = times.map((time) => {
      const isPast = isSlotInPast(dateStr, time);
      const rand = seededRandom(`${dateStr}-${time}`);
      const available = !isPast && rand > 0.3;

      const doctorIdx = Math.floor(seededRandom(`${dateStr}-${time}-doc`) * activeDoctors.length);
      const doctor = activeDoctors[doctorIdx];

      // Box: asignado al doctor > pool libre > null (sin sistema de boxes)
      let box: string | null = null;
      if (doctor.box) {
        box = doctor.box;
      } else if (freePool.length > 0) {
        const boxIdx = Math.floor(seededRandom(`${dateStr}-${time}-box`) * freePool.length);
        box = freePool[boxIdx];
      }

      return { time, doctor: doctor.name, box, available };
    });

    result.push({ date: dateStr, dayName: DAY_NAMES[dow], isOpen: true, slots });
  }

  return result;
}
