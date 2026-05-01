-- AlterTable
ALTER TABLE "patient_contexts" ADD COLUMN     "email" TEXT,
ADD COLUMN     "rut" TEXT,
ADD COLUMN     "slotBooked" BOOLEAN NOT NULL DEFAULT false;
