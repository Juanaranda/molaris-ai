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

export interface AvailabilityDoctor {
  name: string;
  specialty?: string;
  schedule?: string;    // "Lun-Vie" o "Lun/Mié/Vie"
  workDays?: number[];  // alternativa pre-parseada
  services?: string[];
  box?: string | null;
}

export interface ClinicAvailabilityConfig {
  doctors?: AvailabilityDoctor[];
  boxes?: number | string[];
  slotDurationMin?: number;
}

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const DAY_MAP: Record<string, number> = {
  Dom: 0, Lun: 1, Mar: 2, "Mié": 3, Jue: 4, Vie: 5, "Sáb": 6,
};

function parseDoctorDays(schedule: string): number[] {
  if (schedule.includes("-")) {
    const [start, end] = schedule.split("-").map((s) => s.trim());
    const s = DAY_MAP[start];
    const e = DAY_MAP[end];
    if (s == null || e == null) return [];
    return Array.from({ length: e - s + 1 }, (_, i) => s + i);
  }
  return schedule.split("/").map((d) => DAY_MAP[d.trim()]).filter((d) => d != null);
}

function getWorkDays(doc: AvailabilityDoctor): number[] {
  if (doc.workDays && doc.workDays.length > 0) return doc.workDays;
  if (doc.schedule) return parseDoctorDays(doc.schedule);
  return [];
}

function buildBoxPool(boxes: ClinicAvailabilityConfig["boxes"]): string[] {
  if (Array.isArray(boxes)) return boxes;
  if (typeof boxes === "number" && boxes > 0) {
    return Array.from({ length: boxes }, (_, i) => `Box ${i + 1}`);
  }
  return ["Box 1"];
}

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
  return slotDate.getTime() < now.getTime() + 30 * 60 * 1000;
}

export function getWeekAvailability(
  weekStart: string,
  clinicConfig: ClinicAvailabilityConfig,
  service?: string
): DayAvailability[] {
  const start = new Date(weekStart + "T12:00:00");
  const result: DayAvailability[] = [];
  const doctors = clinicConfig.doctors ?? [];
  const duration = clinicConfig.slotDurationMin ?? 45;
  const allBoxes = buildBoxPool(clinicConfig.boxes);

  const todayStr = new Date().toISOString().slice(0, 10);

  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const dow = date.getDay();
    const isWeekday = dow >= 1 && dow <= 5;
    const isSaturday = dow === 6;
    const isOpen = isWeekday || isSaturday;
    const dateStr = date.toISOString().slice(0, 10);

    if (!isOpen || dateStr < todayStr) {
      result.push({ date: dateStr, dayName: DAY_NAMES[dow], isOpen: false, slots: [] });
      continue;
    }

    const workingDoctors = doctors.filter((d) => getWorkDays(d).includes(dow));

    const eligibleDoctors = service
      ? workingDoctors.filter((d) =>
          d.services?.some((s) => s.toLowerCase().includes(service.toLowerCase()))
        )
      : workingDoctors;

    const activeDoctors = eligibleDoctors.length > 0 ? eligibleDoctors : workingDoctors;

    if (activeDoctors.length === 0) {
      result.push({ date: dateStr, dayName: DAY_NAMES[dow], isOpen: false, slots: [] });
      continue;
    }

    const times = getSlotsForDay(isWeekday, duration);

    const busyBoxes = new Set(
      workingDoctors.filter((d) => d.box).map((d) => d.box as string)
    );
    const freePool = allBoxes.filter((b) => !busyBoxes.has(b));

    const slots: Slot[] = times.map((time) => {
      const isPast = isSlotInPast(dateStr, time);
      const rand = seededRandom(`${dateStr}-${time}`);
      const available = !isPast && rand > 0.3;

      const doctorIdx = Math.floor(seededRandom(`${dateStr}-${time}-doc`) * activeDoctors.length);
      const doctor = activeDoctors[doctorIdx];

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
