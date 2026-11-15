-- Qualified Discover views (idempotent by event_id).
CREATE TABLE IF NOT EXISTS "catalog_qualified_views" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "target_kind" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "catalog_qualified_views_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "catalog_qualified_views_event_id_key" ON "catalog_qualified_views"("event_id");
CREATE INDEX IF NOT EXISTS "catalog_qualified_views_target_kind_target_id_idx" ON "catalog_qualified_views"("target_kind", "target_id");
