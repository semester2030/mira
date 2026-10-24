-- Partner portal: email + password login; access_token remains opaque session only.
ALTER TABLE "partner_applications" ADD COLUMN IF NOT EXISTS "password_hash" TEXT;
ALTER TABLE "partner_users" ADD COLUMN IF NOT EXISTS "password_hash" TEXT;
