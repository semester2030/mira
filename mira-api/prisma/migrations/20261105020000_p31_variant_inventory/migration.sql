-- P3.1: inventoryMode + ProductVariantInventory adapter
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "inventory_mode" TEXT NOT NULL DEFAULT 'product';

CREATE TABLE IF NOT EXISTS "product_variant_inventories" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "variant_key" TEXT NOT NULL DEFAULT '',
    "stock_mode" TEXT NOT NULL DEFAULT 'tracked',
    "stock_qty" INTEGER,
    "reserved_qty" INTEGER NOT NULL DEFAULT 0,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_variant_inventories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "product_variant_inventories_product_id_variant_id_key"
  ON "product_variant_inventories"("product_id", "variant_id");

CREATE UNIQUE INDEX IF NOT EXISTS "product_variant_inventories_product_id_variant_key_key"
  ON "product_variant_inventories"("product_id", "variant_key");

CREATE INDEX IF NOT EXISTS "product_variant_inventories_product_id_archived_at_idx"
  ON "product_variant_inventories"("product_id", "archived_at");

DO $$ BEGIN
  ALTER TABLE "product_variant_inventories"
    ADD CONSTRAINT "product_variant_inventories_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
