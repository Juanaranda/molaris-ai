-- Órdenes de laboratorio (Issue #37) — tracking de prótesis enviadas/recibidas

CREATE TABLE "lab_orders" (
    "id"               TEXT NOT NULL,
    "clinicId"         TEXT NOT NULL,
    "patientId"        TEXT,
    "toothFDI"         TEXT,
    "labName"          TEXT NOT NULL,
    "orderType"        TEXT NOT NULL,
    "description"      TEXT,
    "sentAt"           TIMESTAMP(3) NOT NULL,
    "expectedReturnAt" TIMESTAMP(3),
    "receivedAt"       TIMESTAMP(3),
    "installedAt"      TIMESTAMP(3),
    "status"           TEXT NOT NULL DEFAULT 'pending',
    "cost"             DOUBLE PRECISION,
    "notes"            TEXT,
    "createdById"      TEXT NOT NULL,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,
    CONSTRAINT "lab_orders_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lab_orders_clinicId_status_idx" ON "lab_orders"("clinicId", "status");
CREATE INDEX "lab_orders_patientId_idx"       ON "lab_orders"("patientId");

ALTER TABLE "lab_orders"
  ADD CONSTRAINT "lab_orders_clinicId_fkey"
  FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lab_orders"
  ADD CONSTRAINT "lab_orders_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lab_orders"
  ADD CONSTRAINT "lab_orders_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "partner_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
