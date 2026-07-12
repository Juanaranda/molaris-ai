-- SII / OpenFactura: credenciales y configuración de facturación por clínica
ALTER TABLE "clinics" ADD COLUMN "siiProvider"     TEXT DEFAULT 'openfactura';
ALTER TABLE "clinics" ADD COLUMN "siiApiKey"       TEXT;
ALTER TABLE "clinics" ADD COLUMN "siiRutEmisor"    TEXT;
ALTER TABLE "clinics" ADD COLUMN "siiRazonSocial"  TEXT;
ALTER TABLE "clinics" ADD COLUMN "siiGiro"         TEXT;
ALTER TABLE "clinics" ADD COLUMN "siiDocumentType" INTEGER DEFAULT 39;
ALTER TABLE "clinics" ADD COLUMN "siiExenta"       BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "clinics" ADD COLUMN "siiVerified"     BOOLEAN NOT NULL DEFAULT false;

-- Tabla de boletas / DTE
CREATE TABLE "boletas" (
    "id"           TEXT NOT NULL,
    "clinicId"     TEXT NOT NULL,
    "bookingId"    TEXT,
    "documentType" INTEGER NOT NULL DEFAULT 39,
    "folio"        INTEGER,
    "rutReceptor"  TEXT,
    "patientName"  TEXT,
    "description"  TEXT,
    "netAmount"    DOUBLE PRECISION NOT NULL,
    "iva"          DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount"  DOUBLE PRECISION NOT NULL,
    "status"       TEXT NOT NULL DEFAULT 'draft',
    "provider"     TEXT NOT NULL DEFAULT 'openfactura',
    "providerRef"  TEXT,
    "pdfUrl"       TEXT,
    "xmlContent"   TEXT,
    "timbreUrl"    TEXT,
    "errorMessage" TEXT,
    "emittedAt"    TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "boletas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "boletas_clinicId_status_idx" ON "boletas"("clinicId", "status");
CREATE INDEX "boletas_bookingId_idx"       ON "boletas"("bookingId");

ALTER TABLE "boletas"
  ADD CONSTRAINT "boletas_clinicId_fkey"
  FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "boletas"
  ADD CONSTRAINT "boletas_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
