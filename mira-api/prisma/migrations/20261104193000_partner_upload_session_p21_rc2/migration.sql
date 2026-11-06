-- P2.1 RC2 — additive recovery/lease/cleanup columns for PartnerUploadSession.
ALTER TABLE "partner_upload_sessions" ADD COLUMN IF NOT EXISTS "failure_class" TEXT;
ALTER TABLE "partner_upload_sessions" ADD COLUMN IF NOT EXISTS "finalize_lease_owner" TEXT;
ALTER TABLE "partner_upload_sessions" ADD COLUMN IF NOT EXISTS "finalize_lease_until" TIMESTAMP(3);
ALTER TABLE "partner_upload_sessions" ADD COLUMN IF NOT EXISTS "storage_completed_at" TIMESTAMP(3);
ALTER TABLE "partner_upload_sessions" ADD COLUMN IF NOT EXISTS "verified_checksum" TEXT;
ALTER TABLE "partner_upload_sessions" ADD COLUMN IF NOT EXISTS "cleaned_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "partner_upload_sessions_status_finalize_lease_until_idx"
  ON "partner_upload_sessions"("status", "finalize_lease_until");
