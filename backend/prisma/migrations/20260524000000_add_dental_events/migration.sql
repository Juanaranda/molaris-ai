-- Odontograma event-sourced (Issue #13) — discovery validado en #11

-- Enums
CREATE TYPE "DentalEventType" AS ENUM ('DIAGNOSIS', 'TREATMENT', 'OBSERVATION');
CREATE TYPE "DentalSurface"   AS ENUM ('V', 'P', 'L', 'M', 'D', 'O', 'I');

-- Tabla de eventos clínicos (inmutables)
CREATE TABLE "dental_events" (
    "id"             TEXT NOT NULL,
    "clinicId"       TEXT NOT NULL,
    "patientId"      TEXT NOT NULL,
    "sessionId"      TEXT,
    "professionalId" TEXT NOT NULL,
    "toothFDI"       TEXT NOT NULL,
    "eventType"      "DentalEventType" NOT NULL,
    "conditionCode"  TEXT NOT NULL,
    "severity"       INTEGER,
    "notes"          TEXT,
    "occurredAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dental_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "dental_events_clinicId_patientId_idx"  ON "dental_events"("clinicId", "patientId");
CREATE INDEX "dental_events_patientId_toothFDI_idx" ON "dental_events"("patientId", "toothFDI");
CREATE INDEX "dental_events_sessionId_idx"          ON "dental_events"("sessionId");

ALTER TABLE "dental_events"
  ADD CONSTRAINT "dental_events_clinicId_fkey"
  FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dental_events"
  ADD CONSTRAINT "dental_events_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dental_events"
  ADD CONSTRAINT "dental_events_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "dental_events"
  ADD CONSTRAINT "dental_events_professionalId_fkey"
  FOREIGN KEY ("professionalId") REFERENCES "partner_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Junction M:N evento ↔ superficie
CREATE TABLE "dental_event_surfaces" (
    "eventId" TEXT NOT NULL,
    "surface" "DentalSurface" NOT NULL,
    CONSTRAINT "dental_event_surfaces_pkey" PRIMARY KEY ("eventId", "surface")
);

ALTER TABLE "dental_event_surfaces"
  ADD CONSTRAINT "dental_event_surfaces_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "dental_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tabla de imágenes (radiografías / fotos)
CREATE TABLE "tooth_images" (
    "id"             TEXT NOT NULL,
    "clinicId"       TEXT NOT NULL,
    "patientId"      TEXT NOT NULL,
    "sessionId"      TEXT,
    "professionalId" TEXT NOT NULL,
    "toothFDI"       TEXT,
    "imageType"      TEXT NOT NULL,
    "url"            TEXT NOT NULL,
    "notes"          TEXT,
    "takenAt"        TIMESTAMP(3) NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tooth_images_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tooth_images_clinicId_patientId_idx"  ON "tooth_images"("clinicId", "patientId");
CREATE INDEX "tooth_images_patientId_toothFDI_idx" ON "tooth_images"("patientId", "toothFDI");

ALTER TABLE "tooth_images"
  ADD CONSTRAINT "tooth_images_clinicId_fkey"
  FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tooth_images"
  ADD CONSTRAINT "tooth_images_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tooth_images"
  ADD CONSTRAINT "tooth_images_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tooth_images"
  ADD CONSTRAINT "tooth_images_professionalId_fkey"
  FOREIGN KEY ("professionalId") REFERENCES "partner_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
