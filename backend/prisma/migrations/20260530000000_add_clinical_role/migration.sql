-- Permisos clínicos granulares (Issue #32)
CREATE TYPE "ClinicalRole" AS ENUM ('HYGIENIST', 'GENERAL_DENTIST', 'SPECIALIST', 'RECEPTION', 'CLINIC_ADMIN');

ALTER TABLE "partner_users" ADD COLUMN "clinicalRole" "ClinicalRole";
