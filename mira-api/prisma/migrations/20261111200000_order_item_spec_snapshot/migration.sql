-- Frozen jewelry/product specs at purchase time (never mutate from live product).
ALTER TABLE "commerce_order_items" ADD COLUMN IF NOT EXISTS "spec_snapshot_json" JSONB;
