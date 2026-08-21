/**
 * Tipos compartidos del panel. Viven acá y no dentro de page.tsx para que las
 * piezas que se separaron de ese archivo (analítica, vista de doctor) puedan
 * usarlos sin importar desde una página, que sería una dependencia al revés.
 */
import type { DoctorRow } from "@/components/DoctorsEditor";
import type { ServiceRow } from "@/components/ServicesEditor";

export interface ReminderConfig {
  enabled: boolean;
  dayBefore: boolean;
  twoHours: boolean;
  customEnabled: boolean;
  customHours: number;
}

export interface SurveyConfig {
  enabled: boolean;
  hoursAfter: number;
  message: string;
}

export interface RecallConfig {
  enabled: boolean;
  daysInactive: number;
  message: string;
}

export interface ClinicConfig {
  tone?: string;
  assistantName?: string;
  doctors?: DoctorRow[];
  services?: ServiceRow[];
  boxes?: number;
  sedes?: string[];
  schedule?: { weekdays?: string; saturday?: string; sunday?: string };
  reminders?: ReminderConfig;
  recallCampaign?: RecallConfig;
  postApptSurvey?: boolean | SurveyConfig;
}

export interface Analytics {
  totals: { sessions: number; leads: number; readyToBook: number; slotBooked: number; bookings: number; avgScore: number };
  conversionRate: number;
  bookingRate: number;
  intentBreakdown: { intent: string; count: number }[];
  urgencyBreakdown: { urgency: string; count: number }[];
  topServices: { name: string; count: number }[];
  recentLeads: {
    id: string; patientName: string | null; serviceInterest: string | null;
    intent: string | null; urgency: string | null; score: number | null;
    slotBooked: boolean; channel: string; createdAt: string;
  }[];
  sessionsByDay: { day: string; count: number }[];
  payments?: {
    thisMonth: { income: number; count: number };
    lastMonth: { income: number; count: number };
    byStatus: { status: string | null; count: number; totalCharged: number; totalPaid: number }[];
    incomeByMonth: { month: string; income: number; count: number }[];
  };
  doctors?: { doctor: string; bookings: number; cancelled: number; cancellationRate: number; income: number }[];
  patients?: { total: number; newThisMonth: number; returning: number; retentionRate: number };
  operations?: {
    cancellationRate: number;
    bookingsByDow: { dow: number; count: number }[];
    bookingsByHour: { hour: number; count: number }[];
    avgTicket: number;
    paidBookings: number;
  };
  services?: { service: string; count: number; income: number }[];
}


/** Pestañas del panel. */
export type Tab =
  | "inicio" | "conversaciones" | "agenda" | "analytics" | "patients"
  | "bookings" | "perfil" | "equipo" | "inventario" | "clinica" | "config";
