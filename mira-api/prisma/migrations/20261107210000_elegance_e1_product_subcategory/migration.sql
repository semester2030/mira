-- E1 elegance taxonomy foundation: additive subcategory + attributes_json.
-- No backfill. No drops. Rollback: DROP COLUMN subcategory, attributes_json (after confirming no production dependency).

ALTER TABLE "products" ADD COLUMN "subcategory" TEXT;
ALTER TABLE "products" ADD COLUMN "attributes_json" JSONB;

CREATE INDEX "products_category_subcategory_idx"
  ON "products"("category", "subcategory");
