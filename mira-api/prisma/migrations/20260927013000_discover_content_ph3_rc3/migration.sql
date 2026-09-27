ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "catalog_source" TEXT NOT NULL DEFAULT 'catalog';
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "catalog_source" TEXT NOT NULL DEFAULT 'catalog';

UPDATE "products" AS product
SET "catalog_source" = 'simulated'
FROM "catalog_source_links" AS link
WHERE link.owner_kind = 'product'
  AND link.owner_id = product.id
  AND link.source = 'simulated';

UPDATE "services" AS service
SET "catalog_source" = 'simulated'
FROM "catalog_source_links" AS link
WHERE link.owner_kind = 'service'
  AND link.owner_id = service.id
  AND link.source = 'simulated';
