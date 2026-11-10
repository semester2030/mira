-- Phase1 corrective: explicit product-sell capability for event_planner.
-- Additive only. Existing partners default to false (brand/developer unaffected via type checks).
ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "can_sell_products" BOOLEAN NOT NULL DEFAULT false;
