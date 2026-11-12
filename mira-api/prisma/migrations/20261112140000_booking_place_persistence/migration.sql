-- Jamalak §3: persist real booking place (branch vs customer visit). All columns optional/additive.
ALTER TABLE "commerce_bookings" ADD COLUMN IF NOT EXISTS "place_mode" TEXT;
ALTER TABLE "commerce_bookings" ADD COLUMN IF NOT EXISTS "branch_id" TEXT;
ALTER TABLE "commerce_bookings" ADD COLUMN IF NOT EXISTS "visit_city_id" TEXT;
ALTER TABLE "commerce_bookings" ADD COLUMN IF NOT EXISTS "visit_address" TEXT;
ALTER TABLE "commerce_bookings" ADD COLUMN IF NOT EXISTS "travel_fee_halalas" INTEGER;
CREATE INDEX IF NOT EXISTS "commerce_bookings_branch_id_idx" ON "commerce_bookings"("branch_id");
