-- Compatible catalog fields for Discover phase 2. No production row updates.
ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "contact_phone" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "category" TEXT;

CREATE TABLE IF NOT EXISTS "catalog_media" (
  "id" TEXT NOT NULL,
  "owner_kind" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "kind" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "catalog_media_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "catalog_media_owner_kind_owner_id_sort_order_idx"
  ON "catalog_media"("owner_kind", "owner_id", "sort_order");

CREATE TABLE IF NOT EXISTS "catalog_favorites" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "owner_kind" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "catalog_favorites_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "catalog_favorites_user_id_owner_kind_owner_id_key"
  ON "catalog_favorites"("user_id", "owner_kind", "owner_id");
CREATE INDEX IF NOT EXISTS "catalog_favorites_user_id_idx" ON "catalog_favorites"("user_id");
DO $$ BEGIN
  ALTER TABLE "catalog_favorites"
    ADD CONSTRAINT "catalog_favorites_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
