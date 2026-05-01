-- CreateTable: identities (persona universal, RUT como clave única)
CREATE TABLE "identities" (
    "id"        TEXT         NOT NULL,
    "rut"       TEXT         NOT NULL,
    "firstName" TEXT         NOT NULL,
    "lastName"  TEXT         NOT NULL,
    "email"     TEXT,
    "phone"     TEXT,
    "birthDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable: patient_users (identidad enrolada en una clínica)
CREATE TABLE "patient_users" (
    "id"           TEXT         NOT NULL,
    "identityId"   TEXT         NOT NULL,
    "clinicId"     TEXT         NOT NULL,
    "passwordHash" TEXT,
    "enrolledAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastVisit"    TIMESTAMP(3),
    "notes"        TEXT,
    "active"       BOOLEAN      NOT NULL DEFAULT true,

    CONSTRAINT "patient_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: rut y email únicos en identities
CREATE UNIQUE INDEX "identities_rut_key"   ON "identities"("rut");
CREATE UNIQUE INDEX "identities_email_key" ON "identities"("email");

-- CreateIndex: una persona no puede enrolarse dos veces en la misma clínica
CREATE UNIQUE INDEX "patient_users_identityId_clinicId_key"
    ON "patient_users"("identityId", "clinicId");

-- AlterTable: patients — FK opcional a identity (se enlaza cuando el chat identifica al paciente)
ALTER TABLE "patients" ADD COLUMN "identityId" TEXT;

-- AlterTable: bookings — FK opcional a patient_user (citas hechas desde la app)
ALTER TABLE "bookings" ADD COLUMN "patientUserId" TEXT;

-- AddForeignKey: patient_users → identities
ALTER TABLE "patient_users"
    ADD CONSTRAINT "patient_users_identityId_fkey"
    FOREIGN KEY ("identityId") REFERENCES "identities"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: patient_users → clinics
ALTER TABLE "patient_users"
    ADD CONSTRAINT "patient_users_clinicId_fkey"
    FOREIGN KEY ("clinicId") REFERENCES "clinics"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: bookings → patient_users (nullable)
ALTER TABLE "bookings"
    ADD CONSTRAINT "bookings_patientUserId_fkey"
    FOREIGN KEY ("patientUserId") REFERENCES "patient_users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: patients → identities (nullable)
ALTER TABLE "patients"
    ADD CONSTRAINT "patients_identityId_fkey"
    FOREIGN KEY ("identityId") REFERENCES "identities"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
