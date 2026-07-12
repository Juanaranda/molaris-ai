const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const TOKEN_KEY = "molari_patient_token";

export interface PatientData {
  id: string;
  firstName: string;
  lastName: string;
  rut: string;
  email: string | null;
  phone?: string | null;
  birthDate?: string | null;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
  clinicId: string;
  enrolledAt?: string;
  lastVisit?: string | null;
}

export interface PatientBoleta {
  id: string;
  folio: number | null;
  totalAmount: number;
  netAmount: number;
  iva: number;
  description: string | null;
  pdfUrl: string | null;
  emittedAt: string | null;
}

export async function patientUpdateProfile(data: {
  firstName?: string;
  lastName?: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
}): Promise<PatientData> {
  const token = getPatientToken();
  const res = await fetch(`${API}/api/auth/patient/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Error al guardar");
  }
  const json = await res.json();
  return json.patient;
}

export async function getMyBoletas(): Promise<PatientBoleta[]> {
  const token = getPatientToken();
  const res = await fetch(`${API}/api/auth/patient/boletas`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Error cargando boletas");
  const json = await res.json();
  return json.boletas;
}

export interface PatientClinic {
  id: string;
  slug: string;
  name: string;
}

// ─── Derechos del titular — ARCO+ (Ley 21.719) ─────────────────────────────────

/** Descarga todos los datos que la clínica mantiene sobre el paciente (JSON). */
export async function downloadMyData(): Promise<Record<string, unknown>> {
  const token = getPatientToken();
  const res = await fetch(`${API}/api/auth/patient/my-data`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Error descargando tus datos");
  return res.json();
}

/** Solicita la supresión de datos (revoca marketing al instante). */
export async function requestMyDataDeletion(): Promise<{ message: string }> {
  const token = getPatientToken();
  const res = await fetch(`${API}/api/auth/patient/my-data`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? "Error procesando la solicitud");
  return json as { message: string };
}

// ─── Token helpers ────────────────────────────────────────────────────────────

export function getPatientToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function clearPatientToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// ─── Auth requests ────────────────────────────────────────────────────────────

export interface DataPurpose {
  key: string;
  label: string;
  description: string;
  legalBasis: string;
  required: boolean;
}

/** Catálogo de propósitos de tratamiento de datos para el signup (Ley 21.719). */
export async function getPurposes(): Promise<DataPurpose[]> {
  const res = await fetch(`${API}/api/auth/patient/purposes`);
  if (!res.ok) return [];
  const json = await res.json();
  return json.purposes ?? [];
}

export async function patientRegister(data: {
  rut: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  password: string;
  clinicSlug: string;
  consents?: Record<string, boolean>;
}): Promise<{ token: string; patient: PatientData }> {
  const res = await fetch(`${API}/api/auth/patient/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Error al registrarse");
  }
  const result = await res.json();
  localStorage.setItem(TOKEN_KEY, result.token);
  return result;
}

export async function patientLogin(data: {
  rut?: string;
  email?: string;
  password: string;
  clinicSlug: string;
}): Promise<{ token: string; patient: PatientData }> {
  const res = await fetch(`${API}/api/auth/patient/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Credenciales incorrectas");
  }
  const result = await res.json();
  localStorage.setItem(TOKEN_KEY, result.token);
  return result;
}

export async function getPatientMe(): Promise<{ patient: PatientData; clinic: PatientClinic } | null> {
  const token = getPatientToken();
  if (!token) return null;
  const res = await fetch(`${API}/api/auth/patient/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    clearPatientToken();
    return null;
  }
  return res.json();
}

// ─── Booking requests ─────────────────────────────────────────────────────────

export interface DoctorSlots {
  doctor: string;
  specialty: string;
  availableSlots: string[];
}

export interface ClinicBookingInfo {
  id: string;
  slug: string;
  name: string;
  location: string | null;
  doctors: { name: string; specialty: string; schedule: string }[];
  services: { name: string }[];
  schedule: Record<string, string>;
}

export interface PrefillData {
  firstName?: string;
  lastName?: string;
  rut?: string;
  email?: string;
}

export async function getPrefillData(slug: string, sessionId: string): Promise<PrefillData | null> {
  const res = await fetch(`${API}/api/book/${slug}/prefill?s=${encodeURIComponent(sessionId)}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.prefill ?? null;
}

export async function getClinicBookingInfo(slug: string): Promise<ClinicBookingInfo> {
  const res = await fetch(`${API}/api/book/${slug}`);
  if (!res.ok) throw new Error("Clínica no encontrada");
  const data = await res.json();
  return data.clinic;
}

export async function getAvailableSlots(
  slug: string,
  date: string,
  doctor?: string
): Promise<{ date: string; slots: DoctorSlots[] }> {
  const params = new URLSearchParams({ date });
  if (doctor) params.set("doctor", doctor);
  const res = await fetch(`${API}/api/book/${slug}/slots?${params}`);
  if (!res.ok) throw new Error("Error al obtener horarios");
  return res.json();
}

export interface MyBooking {
  id: string;
  doctor: string;
  date: string;
  time: string;
  service: string | null;
  status: string;
  patientName: string | null;
}

export async function getMyBookings(slug: string): Promise<{ bookings: MyBooking[]; clinicName: string }> {
  const token = getPatientToken();
  const res = await fetch(`${API}/api/book/${slug}/my-appointments`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Error cargando tus citas");
  return res.json();
}

export async function cancelMyBooking(slug: string, bookingId: string): Promise<void> {
  const token = getPatientToken();
  const res = await fetch(`${API}/api/book/${slug}/appointments/${bookingId}/cancel`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Error al cancelar");
  }
}

export async function createBooking(
  slug: string,
  data: {
    doctor: string; date: string; time: string; service?: string;
    patientData?: { firstName: string; lastName: string; rut?: string };
  }
): Promise<{ booking: { id: string; doctor: string; date: string; time: string; service: string | null; status: string; patientName: string | null; clinicName: string } }> {
  const token = getPatientToken();
  const res = await fetch(`${API}/api/book/${slug}/appointments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Error al agendar");
  }
  return res.json();
}
