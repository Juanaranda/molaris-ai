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

/** Rango horario "HH:MM"–"HH:MM". */
export interface HoraRango { from: string; to: string }

export interface AvailabilityDoctor {
  name: string;
  specialty?: string;
  schedule?: string;    // "Lun-Vie" o "Lun/Mié/Vie"
  workDays?: number[];  // alternativa pre-parseada
  services?: string[];
  box?: string | null;
  /** Horario propio del profesional. Si falta, hereda el de la clínica. */
  hours?: HoraRango;
}

/** Servicio con su duración en sillón. */
export interface AvailabilityService {
  name: string;
  durationMin?: number;
}

export interface ClinicAvailabilityConfig {
  doctors?: AvailabilityDoctor[];
  boxes?: number | string[];
  /** Duración por defecto cuando el servicio no declara la suya. */
  slotDurationMin?: number;
  services?: AvailabilityService[];
  /** Horario de la clínica por día de semana (0 = domingo). null = cerrado. */
  openingHours?: Record<string, HoraRango | null>;
}

/** Horario por defecto mientras la clínica no configure el suyo. */
const HORARIO_POR_DEFECTO: Record<number, HoraRango | null> = {
  0: null,
  1: { from: "10:00", to: "18:00" }, 2: { from: "10:00", to: "18:00" },
  3: { from: "10:00", to: "18:00" }, 4: { from: "10:00", to: "18:00" },
  5: { from: "10:00", to: "18:00" },
  6: { from: "10:00", to: "14:00" },
};

/** "HH:MM" → minutos desde medianoche. Devuelve null si no parsea. */
function aMinutos(hhmm: string | undefined): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function aHHMM(mins: number): string {
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

/** Horario de la clínica ese día, con fallback al por defecto. */
function horarioClinica(cfg: ClinicAvailabilityConfig, dow: number): HoraRango | null {
  const propio = cfg.openingHours?.[String(dow)];
  return propio !== undefined ? propio : HORARIO_POR_DEFECTO[dow];
}

/**
 * Ventana en que ese profesional atiende ese día: la intersección de su
 * horario con el de la clínica. Si el doctor no declara horario, hereda el
 * de la clínica. Devuelve null si no hay solapamiento (o la clínica cierra).
 */
export function ventanaAtencion(
  cfg: ClinicAvailabilityConfig,
  doc: AvailabilityDoctor | undefined,
  dow: number,
): { desde: number; hasta: number } | null {
  const clinica = horarioClinica(cfg, dow);
  if (!clinica) return null;
  const cDesde = aMinutos(clinica.from), cHasta = aMinutos(clinica.to);
  if (cDesde == null || cHasta == null || cHasta <= cDesde) return null;

  const dDesde = aMinutos(doc?.hours?.from);
  const dHasta = aMinutos(doc?.hours?.to);
  const desde = Math.max(cDesde, dDesde ?? cDesde);
  const hasta = Math.min(cHasta, dHasta ?? cHasta);
  return hasta > desde ? { desde, hasta } : null;
}

/**
 * Duración de un servicio, en minutos.
 *
 * Se busca por coincidencia flexible porque el nombre que llega desde el chat
 * o la reserva pública no siempre calza exacto con el del catálogo
 * ("limpieza" vs "Limpieza dental").
 */
export function duracionDeServicio(
  cfg: ClinicAvailabilityConfig,
  servicio: string | undefined,
): number {
  const pordefecto = cfg.slotDurationMin ?? 45;
  if (!servicio) return pordefecto;
  const q = servicio.trim().toLowerCase();
  if (!q) return pordefecto;
  const lista = cfg.services ?? [];
  const exacto = lista.find((s) => s.name.trim().toLowerCase() === q);
  const parcial = exacto ?? lista.find((s) => {
    const n = s.name.trim().toLowerCase();
    return n.includes(q) || q.includes(n);
  });
  return parcial?.durationMin && parcial.durationMin > 0 ? parcial.durationMin : pordefecto;
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

/** Slots que caben en una ventana [desde, hasta) para una duración dada. */
function slotsEnVentana(desde: number, hasta: number, durationMin: number): string[] {
  const times: string[] = [];
  // Una cita no puede terminar después del cierre: el último slot válido
  // empieza como máximo a (hasta - duración).
  for (let t = desde; t + durationMin <= hasta; t += durationMin) times.push(aHHMM(t));
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
  // La duración sale del servicio pedido: una limpieza y un implante no
  // pueden ocupar el mismo bloque. Sin servicio, cae al valor de la clínica.
  const duration = duracionDeServicio(clinicConfig, service);
  const allBoxes = buildBoxPool(clinicConfig.boxes);

  const todayStr = new Date().toISOString().slice(0, 10);

  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const dow = date.getDay();
    const dateStr = date.toISOString().slice(0, 10);
    const abierta = horarioClinica(clinicConfig, dow) !== null;

    if (!abierta || dateStr < todayStr) {
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

    const busyBoxes = new Set(
      workingDoctors.filter((d) => d.box).map((d) => d.box as string)
    );
    const freePool = allBoxes.filter((b) => !busyBoxes.has(b));

    // Los horarios ya no son de la clínica entera: cada profesional aporta los
    // slots de SU ventana. Así una doctora que entra a las 15:00 no ofrece
    // horas de la mañana, y el último slot nunca se pasa de su hora de salida.
    const porHora = new Map<string, AvailabilityDoctor[]>();
    for (const doc of activeDoctors) {
      const ventana = ventanaAtencion(clinicConfig, doc, dow);
      if (!ventana) continue;
      for (const time of slotsEnVentana(ventana.desde, ventana.hasta, duration)) {
        const lista = porHora.get(time);
        if (lista) lista.push(doc); else porHora.set(time, [doc]);
      }
    }

    if (porHora.size === 0) {
      result.push({ date: dateStr, dayName: DAY_NAMES[dow], isOpen: false, slots: [] });
      continue;
    }

    const times = [...porHora.keys()].sort();

    const slots: Slot[] = times.map((time) => {
      const candidatos = porHora.get(time) ?? [];
      const isPast = isSlotInPast(dateStr, time);
      const rand = seededRandom(`${dateStr}-${time}`);
      const available = !isPast && rand > 0.3;

      const doctorIdx = Math.floor(seededRandom(`${dateStr}-${time}-doc`) * candidatos.length);
      const doctor = candidatos[doctorIdx];

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
