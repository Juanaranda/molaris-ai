-- Force password change on first login for invited team members
ALTER TABLE "partner_users" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
