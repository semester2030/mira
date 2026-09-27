-- Content review on the existing product and service rows. Existing rows stay published.
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "content_status" TEXT NOT NULL DEFAULT 'published';
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "review_note" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "draft_name_ar" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "draft_description_ar" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "submitted_at" TIMESTAMP(3);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMP(3);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "reviewed_by" TEXT;

ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "content_status" TEXT NOT NULL DEFAULT 'published';
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "review_note" TEXT;
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "draft_name_ar" TEXT;
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "draft_description_ar" TEXT;
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "submitted_at" TIMESTAMP(3);
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMP(3);
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "reviewed_by" TEXT;

ALTER TABLE "catalog_media" ADD COLUMN IF NOT EXISTS "mime_type" TEXT;
ALTER TABLE "catalog_media" ADD COLUMN IF NOT EXISTS "byte_size" INTEGER;
ALTER TABLE "catalog_media" ADD COLUMN IF NOT EXISTS "storage_key" TEXT;
ALTER TABLE "catalog_media" ADD COLUMN IF NOT EXISTS "is_primary" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "catalog_media" ADD COLUMN IF NOT EXISTS "publication" TEXT NOT NULL DEFAULT 'published';

CREATE TABLE IF NOT EXISTS "catalog_source_links" (
  "id" TEXT NOT NULL,
  "partner_id" TEXT NOT NULL,
  "owner_kind" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "external_id" TEXT NOT NULL,
  "mira_note_ar" TEXT,
  "last_synced_at" TIMESTAMP(3),
  CONSTRAINT "catalog_source_links_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "catalog_source_links_partner_id_source_external_id_key"
  ON "catalog_source_links"("partner_id", "source", "external_id");
DO $$ BEGIN
  ALTER TABLE "catalog_source_links"
    ADD CONSTRAINT "catalog_source_links_partner_id_fkey"
    FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "catalog_review_logs" (
  "id" TEXT NOT NULL,
  "owner_kind" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  "actor" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "catalog_review_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "catalog_review_logs_owner_kind_owner_id_created_at_idx"
  ON "catalog_review_logs"("owner_kind", "owner_id", "created_at");
