-- Mercado Pago credentials per clinic
ALTER TABLE "clinics" ADD COLUMN "mpAccessToken" TEXT;
ALTER TABLE "clinics" ADD COLUMN "mpVerified"    BOOLEAN NOT NULL DEFAULT false;

-- Payment table — tracking de pagos online (Mercado Pago, etc.)
CREATE TABLE "payments" (
    "id"                TEXT NOT NULL,
    "clinicId"          TEXT NOT NULL,
    "bookingId"         TEXT,
    "provider"          TEXT NOT NULL DEFAULT 'mercadopago',
    "providerPaymentId" TEXT,
    "externalRef"       TEXT NOT NULL,
    "amount"            DOUBLE PRECISION NOT NULL,
    "currency"          TEXT NOT NULL DEFAULT 'CLP',
    "status"            TEXT NOT NULL DEFAULT 'pending',
    "payerEmail"        TEXT,
    "initPoint"         TEXT,
    "description"       TEXT,
    "paidAt"            TIMESTAMP(3),
    "raw"               JSONB,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payments_providerPaymentId_key" ON "payments"("providerPaymentId");
CREATE UNIQUE INDEX "payments_externalRef_key"       ON "payments"("externalRef");
CREATE INDEX "payments_clinicId_status_idx"          ON "payments"("clinicId", "status");
CREATE INDEX "payments_bookingId_idx"                ON "payments"("bookingId");

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_clinicId_fkey"
  FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
