-- Atomic outfit snapshot retries: same clientSaveId does not insert twice.
ALTER TABLE "outfit_analyses" ADD COLUMN IF NOT EXISTS "client_save_id" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "outfit_analyses_user_id_client_save_id_key"
  ON "outfit_analyses"("user_id", "client_save_id");
