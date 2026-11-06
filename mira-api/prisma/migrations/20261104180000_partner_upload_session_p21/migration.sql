-- P2.1 PartnerUploadSession — additive only; does not alter catalog rows.
CREATE TABLE IF NOT EXISTS "partner_upload_sessions" (
    "id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "owner_kind" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "client_draft_id" TEXT,
    "client_media_id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'created',
    "declared_mime_type" TEXT NOT NULL,
    "declared_byte_size" INTEGER NOT NULL,
    "declared_checksum" TEXT,
    "object_key" TEXT NOT NULL,
    "storage_upload_id" TEXT,
    "completed_parts_json" JSONB NOT NULL DEFAULT '[]',
    "part_size_bytes" INTEGER NOT NULL,
    "total_parts" INTEGER NOT NULL,
    "placement" TEXT NOT NULL DEFAULT 'main',
    "verified_mime_type" TEXT,
    "verified_byte_size" INTEGER,
    "verified_duration_sec" DOUBLE PRECISION,
    "failure_code" TEXT,
    "failure_message_ar" TEXT,
    "catalog_media_id" TEXT,
    "finalize_attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "ready_at" TIMESTAMP(3),
    "aborted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_upload_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "partner_upload_sessions_partner_id_idempotency_key_key"
  ON "partner_upload_sessions"("partner_id", "idempotency_key");

CREATE INDEX IF NOT EXISTS "partner_upload_sessions_partner_id_status_updated_at_idx"
  ON "partner_upload_sessions"("partner_id", "status", "updated_at" DESC);

CREATE INDEX IF NOT EXISTS "partner_upload_sessions_owner_kind_owner_id_idx"
  ON "partner_upload_sessions"("owner_kind", "owner_id");

CREATE INDEX IF NOT EXISTS "partner_upload_sessions_status_expires_at_idx"
  ON "partner_upload_sessions"("status", "expires_at");

DO $$ BEGIN
  ALTER TABLE "partner_upload_sessions"
    ADD CONSTRAINT "partner_upload_sessions_partner_id_fkey"
    FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
