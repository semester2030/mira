ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "review_status" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "review_revision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "submitted_revision" INTEGER;
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "review_status" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "review_revision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "submitted_revision" INTEGER;

ALTER TABLE "catalog_media" ADD COLUMN IF NOT EXISTS "pending_removal" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "catalog_media" ADD COLUMN IF NOT EXISTS "draft_sort_order" INTEGER;
ALTER TABLE "catalog_media" ADD COLUMN IF NOT EXISTS "draft_is_primary" BOOLEAN;
ALTER TABLE "catalog_media" ADD COLUMN IF NOT EXISTS "source_media_key" TEXT;

UPDATE "products"
SET "review_status" = "content_status", "content_status" = 'published'
WHERE "active" = true AND "content_status" IN ('draft', 'in_review', 'rejected');
UPDATE "products"
SET "review_status" = "content_status"
WHERE "active" = false AND "content_status" IN ('draft', 'in_review', 'rejected');
UPDATE "products"
SET "content_status" = 'draft'
WHERE "active" = false AND "content_status" IN ('in_review', 'rejected');

UPDATE "services"
SET "review_status" = "content_status", "content_status" = 'published'
WHERE "active" = true AND "content_status" IN ('draft', 'in_review', 'rejected');
UPDATE "services"
SET "review_status" = "content_status"
WHERE "active" = false AND "content_status" IN ('draft', 'in_review', 'rejected');
UPDATE "services"
SET "content_status" = 'draft'
WHERE "active" = false AND "content_status" IN ('in_review', 'rejected');

UPDATE "catalog_media"
SET "pending_removal" = true, "publication" = 'published', "active" = true
WHERE "publication" = 'pending_removal';

CREATE UNIQUE INDEX IF NOT EXISTS "catalog_media_owner_kind_owner_id_source_media_key_key"
  ON "catalog_media"("owner_kind", "owner_id", "source_media_key");
