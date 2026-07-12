-- Audit log médico-legal (Issue #34) — Ley 20.584 / 21.719

CREATE TABLE "audit_logs" (
    "id"             TEXT NOT NULL,
    "clinicId"       TEXT NOT NULL,
    "actorId"        TEXT,
    "action"         TEXT NOT NULL,
    "resourceType"   TEXT NOT NULL,
    "resourceId"     TEXT NOT NULL,
    "snapshotBefore" JSONB,
    "snapshotAfter"  JSONB,
    "ip"             TEXT,
    "userAgent"      TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_clinicId_createdAt_idx"        ON "audit_logs"("clinicId", "createdAt");
CREATE INDEX "audit_logs_actorId_createdAt_idx"         ON "audit_logs"("actorId", "createdAt");
CREATE INDEX "audit_logs_resourceType_resourceId_idx"   ON "audit_logs"("resourceType", "resourceId");

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_clinicId_fkey"
  FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "partner_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
