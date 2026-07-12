-- Consentimientos informados firmados (Issue #36)

ALTER TABLE "clinics" ADD COLUMN "zapsignApiKey"   TEXT;
ALTER TABLE "clinics" ADD COLUMN "zapsignVerified" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "consent_templates" (
    "id"            TEXT NOT NULL,
    "clinicId"      TEXT NOT NULL,
    "title"         TEXT NOT NULL,
    "body"          TEXT NOT NULL,
    "procedureCode" TEXT,
    "version"       INTEGER NOT NULL,
    "active"        BOOLEAN NOT NULL DEFAULT true,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "consent_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "consent_templates_clinicId_version_title_key" ON "consent_templates"("clinicId", "version", "title");
CREATE INDEX "consent_templates_clinicId_active_idx"               ON "consent_templates"("clinicId", "active");

ALTER TABLE "consent_templates"
  ADD CONSTRAINT "consent_templates_clinicId_fkey"
  FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "consent_signatures" (
    "id"                TEXT NOT NULL,
    "clinicId"          TEXT NOT NULL,
    "templateId"        TEXT NOT NULL,
    "templateVersion"   INTEGER NOT NULL,
    "patientId"         TEXT NOT NULL,
    "patientName"       TEXT NOT NULL,
    "patientRut"        TEXT,
    "sessionId"         TEXT,
    "signatureMethod"   TEXT NOT NULL,
    "externalRef"       TEXT,
    "signedAt"          TIMESTAMP(3),
    "signedDocumentUrl" TEXT,
    "requestedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestedById"     TEXT NOT NULL,
    "status"            TEXT NOT NULL DEFAULT 'pending',
    "notes"             TEXT,
    CONSTRAINT "consent_signatures_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "consent_signatures_clinicId_patientId_idx" ON "consent_signatures"("clinicId", "patientId");
CREATE INDEX "consent_signatures_status_idx"             ON "consent_signatures"("status");

ALTER TABLE "consent_signatures"
  ADD CONSTRAINT "consent_signatures_clinicId_fkey"
  FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "consent_signatures"
  ADD CONSTRAINT "consent_signatures_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "consent_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "consent_signatures"
  ADD CONSTRAINT "consent_signatures_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "consent_signatures"
  ADD CONSTRAINT "consent_signatures_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "partner_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
