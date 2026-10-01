-- MC-FIX-05 RC2: mark prior non-null draft option/variant payloads as intentional draft sets.
-- Does NOT invent historical clear requests from null alone.
UPDATE "products"
SET "draft_options_set" = true
WHERE "draft_options_json" IS NOT NULL
  AND "draft_options_set" = false;

UPDATE "products"
SET "draft_variants_set" = true
WHERE "draft_variants_json" IS NOT NULL
  AND "draft_variants_set" = false;
