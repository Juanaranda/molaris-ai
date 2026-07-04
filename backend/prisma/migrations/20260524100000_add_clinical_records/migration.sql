-- Ficha clínica (Issue #17) — extensiones a Identity + PatientUser + nuevo ClinicalNote

-- ── Identity: datos demográficos + tutor para menores ──
ALTER TABLE "identities" ADD COLUMN "gender"                   TEXT;
ALTER TABLE "identities" ADD COLUMN "address"                  TEXT;
ALTER TABLE "identities" ADD COLUMN "emergencyContactName"     TEXT;
ALTER TABLE "identities" ADD COLUMN "emergencyContactPhone"    TEXT;
ALTER TABLE "identities" ADD COLUMN "emergencyContactRelation" TEXT;
ALTER TABLE "identities" ADD COLUMN "guardianIdentityId"       TEXT;

ALTER TABLE "identities"
  ADD CONSTRAINT "identities_guardianIdentityId_fkey"
  FOREIGN KEY ("guardianIdentityId") REFERENCES "identities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "identities_guardianIdentityId_idx" ON "identities"("guardianIdentityId");

-- ── PatientUser: previsión + marketing consent ──
ALTER TABLE "patient_users" ADD COLUMN "insuranceProvider"       TEXT;
ALTER TABLE "patient_users" ADD COLUMN "insuranceTier"           TEXT;
ALTER TABLE "patient_users" ADD COLUMN "insuranceCompany"        TEXT;
ALTER TABLE "patient_users" ADD COLUMN "marketingImagesConsent"  BOOLEAN NOT NULL DEFAULT false;

-- ── Notas clínicas por sesión (Decreto 41 MINSAL) ──
CREATE TABLE "clinical_notes" (
    "id"             TEXT NOT NULL,
    "clinicId"       TEXT NOT NULL,
    "patientId"      TEXT NOT NULL,
    "sessionId"      TEXT,
    "professionalId" TEXT NOT NULL,
    "reason"         TEXT,
    "reasonCategory" TEXT,
    "findings"       TEXT,
    "procedures"     TEXT,
    "prescriptions"  TEXT,
    "nextVisitPlan"  TEXT,
    "occurredAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "clinical_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "clinical_notes_clinicId_patientId_idx"  ON "clinical_notes"("clinicId", "patientId");
CREATE INDEX "clinical_notes_patientId_occurredAt_idx" ON "clinical_notes"("patientId", "occurredAt");

ALTER TABLE "clinical_notes"
  ADD CONSTRAINT "clinical_notes_clinicId_fkey"
  FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "clinical_notes"
  ADD CONSTRAINT "clinical_notes_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "clinical_notes"
  ADD CONSTRAINT "clinical_notes_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "clinical_notes"
  ADD CONSTRAINT "clinical_notes_professionalId_fkey"
  FOREIGN KEY ("professionalId") REFERENCES "partner_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
