-- D1 corrective migration: backfill stock_source for pre-column order items.
-- Never invent a source without evidence. Idempotent.

-- 1) Untracked / no numeric hold → keep 'none' (already default). Explicit no-op for clarity.
UPDATE "commerce_order_items"
SET "stock_source" = 'none'
WHERE "stock_source" = 'none'
  AND "reserved_qty" = 0;

-- 2) Numeric hold + product never had variant inventory rows → historical product-mode pool.
UPDATE "commerce_order_items" AS i
SET "stock_source" = 'product'
WHERE i."stock_source" = 'none'
  AND i."reserved_qty" > 0
  AND NOT EXISTS (
    SELECT 1 FROM "product_variant_inventories" v
    WHERE v."product_id" = i."product_id"
  );

-- 3) Remaining none+reserved_qty>0 stay 'none' → runtime treats as STOCK_SOURCE_UNRESOLVED
--    (must not silently release/consume). Resolution may set product|variant when
--    exactly one holding pool matches; otherwise transition fails.
