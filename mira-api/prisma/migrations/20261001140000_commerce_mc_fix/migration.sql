-- MC-FIX: quote confirmation + idempotency content + booking resource + draft clear flags
ALTER TABLE "commerce_orders" ADD COLUMN IF NOT EXISTS "request_fingerprint" TEXT;
ALTER TABLE "commerce_bookings" ADD COLUMN IF NOT EXISTS "request_fingerprint" TEXT;
ALTER TABLE "commerce_bookings" ADD COLUMN IF NOT EXISTS "resource_id" TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS "commerce_bookings_partner_resource_starts_idx"
  ON "commerce_bookings" ("partner_id", "resource_id", "starts_at");

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "draft_options_set" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "draft_variants_set" BOOLEAN NOT NULL DEFAULT false;
