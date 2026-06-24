-- Anamnesis cuestionario versionado (Issue #35)

CREATE TABLE "anamnesis_templates" (
    "id"        TEXT NOT NULL,
    "clinicId"  TEXT NOT NULL,
    "version"   INTEGER NOT NULL,
    "questions" JSONB NOT NULL,
    "active"    BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "anamnesis_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "anamnesis_templates_clinicId_version_key" ON "anamnesis_templates"("clinicId", "version");
CREATE INDEX "anamnesis_templates_clinicId_active_idx"        ON "anamnesis_templates"("clinicId", "active");

ALTER TABLE "anamnesis_templates"
  ADD CONSTRAINT "anamnesis_templates_clinicId_fkey"
  FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "anamnesis_responses" (
    "id"              TEXT NOT NULL,
    "clinicId"        TEXT NOT NULL,
    "patientId"       TEXT NOT NULL,
    "templateId"      TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "answers"         JSONB NOT NULL,
    "redFlags"        TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "recordedById"    TEXT NOT NULL,
    "completedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "anamnesis_responses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "anamnesis_responses_clinicId_patientId_idx"   ON "anamnesis_responses"("clinicId", "patientId");
CREATE INDEX "anamnesis_responses_patientId_completedAt_idx" ON "anamnesis_responses"("patientId", "completedAt");

ALTER TABLE "anamnesis_responses"
  ADD CONSTRAINT "anamnesis_responses_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "anamnesis_responses"
  ADD CONSTRAINT "anamnesis_responses_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "anamnesis_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "anamnesis_responses"
  ADD CONSTRAINT "anamnesis_responses_recordedById_fkey"
  FOREIGN KEY ("recordedById") REFERENCES "partner_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
