-- RC4: finalize retry schedule + complete intent for crash recovery
ALTER TABLE "partner_upload_sessions" ADD COLUMN IF NOT EXISTS "finalize_next_attempt_at" TIMESTAMP(3);
ALTER TABLE "partner_upload_sessions" ADD COLUMN IF NOT EXISTS "complete_intent_at" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "partner_upload_sessions_status_finalize_next_attempt_at_idx"
  ON "partner_upload_sessions"("status", "finalize_next_attempt_at");
