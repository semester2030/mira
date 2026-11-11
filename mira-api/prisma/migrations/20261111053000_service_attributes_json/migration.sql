-- Service attribute bag for occasions (occasionTypeIds / occasionServiceOffer) and dual-read legacy eventType.
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "attributes_json" JSONB;
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "draft_attributes_json" JSONB;
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "draft_attributes_set" BOOLEAN NOT NULL DEFAULT false;
