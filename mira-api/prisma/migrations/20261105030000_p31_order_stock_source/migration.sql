-- P3.1 fix: stamp the inventory source used at reservation time.
ALTER TABLE "commerce_order_items"
  ADD COLUMN IF NOT EXISTS "stock_source" TEXT NOT NULL DEFAULT 'none';
