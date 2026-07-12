import { getToken } from "./auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface WaitlistEntry {
  id:                  string;
  patientName:         string;
  patientPhone:        string;
  patientRut:          string | null;
  preferredDoctor:     string | null;
  preferredService:    string | null;
  dateFrom:            string | null;
  dateTo:              string | null;
  notes:               string | null;
  status:              "waiting" | "notified" | "converted" | "expired" | "cancelled";
  notifiedAt:          string | null;
  notifiedForDate:     string | null;
  convertedBookingId:  string | null;
  createdAt:           string;
}

export async function listWaitlist(clinicId: string, params: { status?: string } = {}): Promise<WaitlistEntry[]> {
  const q = new URLSearchParams();
  if (params.status) q.set("status", params.status);
  const res = await fetch(`${API}/api/clinics/${clinicId}/waitlist?${q}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Error cargando waitlist");
  const data = await res.json();
  return data.entries;
}

export async function addToWaitlist(
  clinicId: string,
  data: {
    patientName: string;
    patientPhone: string;
    patientRut?: string;
    preferredDoctor?: string;
    preferredService?: string;
    dateFrom?: string;
    dateTo?: string;
    notes?: string;
  }
): Promise<WaitlistEntry> {
  const res = await fetch(`${API}/api/clinics/${clinicId}/waitlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? "Error");
  return (json as { entry: WaitlistEntry }).entry;
}

export async function updateWaitlistEntry(
  clinicId: string,
  entryId: string,
  data: { status?: "waiting" | "notified" | "converted" | "expired" | "cancelled"; convertedBookingId?: string }
): Promise<WaitlistEntry> {
  const res = await fetch(`${API}/api/clinics/${clinicId}/waitlist/${entryId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? "Error");
  return (json as { entry: WaitlistEntry }).entry;
}

export async function removeWaitlistEntry(clinicId: string, entryId: string): Promise<void> {
  const res = await fetch(`${API}/api/clinics/${clinicId}/waitlist/${entryId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Error");
  }
}
