-- E1 closure: pending taxonomy/attributes for published products (applied on approve only).
-- Additive. Rollback preference: keep columns and stop writing (app rollback); DROP only on unused env.

ALTER TABLE "products" ADD COLUMN "draft_category" TEXT;
ALTER TABLE "products" ADD COLUMN "draft_subcategory" TEXT;
ALTER TABLE "products" ADD COLUMN "draft_profile_id" TEXT;
ALTER TABLE "products" ADD COLUMN "draft_attributes_json" JSONB;
ALTER TABLE "products" ADD COLUMN "draft_taxonomy_set" BOOLEAN NOT NULL DEFAULT false;
