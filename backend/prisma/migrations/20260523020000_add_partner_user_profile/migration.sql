-- Add personal profile fields to partner_users
ALTER TABLE "partner_users" ADD COLUMN "photoUrl"   TEXT;
ALTER TABLE "partner_users" ADD COLUMN "occupation" TEXT;
ALTER TABLE "partner_users" ADD COLUMN "phone"      TEXT;
ALTER TABLE "partner_users" ADD COLUMN "bio"        TEXT;
