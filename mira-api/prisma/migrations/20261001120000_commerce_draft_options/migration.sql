-- Content-reviewed product options: drafts on published rows until admin approve.
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "draft_options_json" JSONB;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "draft_variants_json" JSONB;
