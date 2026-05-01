-- CreateEnum
CREATE TYPE "PartnerRole" AS ENUM ('SUPERADMIN', 'ADMIN', 'USER');

-- CreateTable
CREATE TABLE "partner_users" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "PartnerRole" NOT NULL DEFAULT 'USER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "partner_users_email_key" ON "partner_users"("email");

-- AddForeignKey
ALTER TABLE "partner_users" ADD CONSTRAINT "partner_users_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE SET NULL ON UPDATE CASCADE;
