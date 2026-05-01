-- AlterTable
ALTER TABLE "bookings" ADD COLUMN "reminderDaySent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "bookings" ADD COLUMN "reminderHourSent" BOOLEAN NOT NULL DEFAULT false;
