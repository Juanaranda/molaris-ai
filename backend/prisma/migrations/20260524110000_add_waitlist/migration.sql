-- Lista de espera con auto-aviso al abrirse cupo (Issue #26)

CREATE TABLE "waitlist_entries" (
    "id"                  TEXT NOT NULL,
    "clinicId"            TEXT NOT NULL,
    "patientName"         TEXT NOT NULL,
    "patientPhone"        TEXT NOT NULL,
    "patientRut"          TEXT,
    "preferredDoctor"     TEXT,
    "preferredService"    TEXT,
    "dateFrom"            TIMESTAMP(3),
    "dateTo"              TIMESTAMP(3),
    "notes"               TEXT,
    "status"              TEXT NOT NULL DEFAULT 'waiting',
    "notifiedAt"          TIMESTAMP(3),
    "notifiedForDate"     TIMESTAMP(3),
    "convertedBookingId"  TEXT,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL,
    CONSTRAINT "waitlist_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "waitlist_entries_clinicId_status_idx" ON "waitlist_entries"("clinicId", "status");

ALTER TABLE "waitlist_entries"
  ADD CONSTRAINT "waitlist_entries_clinicId_fkey"
  FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
