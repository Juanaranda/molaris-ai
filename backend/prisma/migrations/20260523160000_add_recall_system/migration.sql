-- Recall system: rules per clinic + audit log of sent recall events

CREATE TABLE "recall_rules" (
    "id"              TEXT NOT NULL,
    "clinicId"        TEXT NOT NULL,
    "triggerService"  TEXT NOT NULL,
    "intervalDays"    INTEGER NOT NULL,
    "messageTemplate" TEXT NOT NULL,
    "active"          BOOLEAN NOT NULL DEFAULT true,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "recall_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "recall_rules_clinicId_idx" ON "recall_rules"("clinicId");

CREATE TABLE "recall_events" (
    "id"            TEXT NOT NULL,
    "ruleId"        TEXT NOT NULL,
    "clinicId"      TEXT NOT NULL,
    "patientPhone"  TEXT NOT NULL,
    "patientName"   TEXT,
    "patientRut"    TEXT,
    "lastBookingAt" TIMESTAMP(3) NOT NULL,
    "sentAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channel"       TEXT NOT NULL DEFAULT 'whatsapp',
    "success"       BOOLEAN NOT NULL DEFAULT true,
    "errorMessage"  TEXT,
    CONSTRAINT "recall_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "recall_events_clinicId_sentAt_idx"      ON "recall_events"("clinicId", "sentAt");
CREATE INDEX "recall_events_patientPhone_ruleId_idx" ON "recall_events"("patientPhone", "ruleId");

ALTER TABLE "recall_events"
  ADD CONSTRAINT "recall_events_ruleId_fkey"
  FOREIGN KEY ("ruleId") REFERENCES "recall_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
