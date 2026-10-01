-- AlterTable
ALTER TABLE "products" ADD COLUMN     "delivery_fee_halalas" INTEGER,
ADD COLUMN     "options_json" JSONB,
ADD COLUMN     "purchase_mode" TEXT NOT NULL DEFAULT 'external',
ADD COLUMN     "reserved_qty" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stock_qty" INTEGER,
ADD COLUMN     "variants_json" JSONB;

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "availability_json" JSONB,
ADD COLUMN     "pay_mode" TEXT NOT NULL DEFAULT 'pay_at_venue';

-- CreateTable
CREATE TABLE "commerce_carts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "partner_id" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commerce_carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commerce_cart_items" (
    "id" TEXT NOT NULL,
    "cart_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_key" TEXT NOT NULL DEFAULT '',
    "selections_json" JSONB,
    "quantity" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commerce_cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commerce_orders" (
    "id" TEXT NOT NULL,
    "public_number" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "fulfillment_status" TEXT NOT NULL DEFAULT 'new',
    "delivery_status" TEXT NOT NULL DEFAULT 'pending',
    "payment_method" TEXT NOT NULL DEFAULT 'cod',
    "payment_collection_status" TEXT NOT NULL DEFAULT 'uncollected',
    "collection_actor" TEXT,
    "collected_at" TIMESTAMP(3),
    "subtotal_halalas" INTEGER NOT NULL,
    "delivery_fee_halalas" INTEGER,
    "total_halalas" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "contact_name" TEXT NOT NULL,
    "contact_phone" TEXT NOT NULL,
    "address_line" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "notes" TEXT,
    "idempotency_key" TEXT,
    "client_request_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commerce_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commerce_order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "product_name_ar" TEXT NOT NULL,
    "variant_key" TEXT NOT NULL DEFAULT '',
    "selections_json" JSONB,
    "unit_price_halalas" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "line_total_halalas" INTEGER NOT NULL,
    "reserved_qty" INTEGER NOT NULL DEFAULT 0,
    "stock_state" TEXT NOT NULL DEFAULT 'none',

    CONSTRAINT "commerce_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commerce_order_events" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "actor_type" TEXT NOT NULL,
    "actor_id" TEXT,
    "from_status" TEXT,
    "to_status" TEXT,
    "field" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commerce_order_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commerce_bookings" (
    "id" TEXT NOT NULL,
    "public_number" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "service_name_ar" TEXT NOT NULL,
    "branch_label" TEXT,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "duration_min" INTEGER NOT NULL,
    "price_halalas" INTEGER NOT NULL,
    "pay_mode" TEXT NOT NULL DEFAULT 'pay_at_venue',
    "status" TEXT NOT NULL DEFAULT 'requested',
    "contact_name" TEXT NOT NULL,
    "contact_phone" TEXT NOT NULL,
    "notes" TEXT,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commerce_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commerce_booking_events" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "actor_type" TEXT NOT NULL,
    "actor_id" TEXT,
    "from_status" TEXT,
    "to_status" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commerce_booking_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "commerce_carts_user_id_key" ON "commerce_carts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "commerce_cart_items_cart_id_product_id_variant_key_key" ON "commerce_cart_items"("cart_id", "product_id", "variant_key");

-- CreateIndex
CREATE UNIQUE INDEX "commerce_orders_public_number_key" ON "commerce_orders"("public_number");

-- CreateIndex
CREATE INDEX "commerce_orders_partner_id_created_at_idx" ON "commerce_orders"("partner_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "commerce_orders_user_id_created_at_idx" ON "commerce_orders"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "commerce_orders_user_id_idempotency_key_key" ON "commerce_orders"("user_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "commerce_order_items_order_id_idx" ON "commerce_order_items"("order_id");

-- CreateIndex
CREATE INDEX "commerce_order_events_order_id_created_at_idx" ON "commerce_order_events"("order_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "commerce_bookings_public_number_key" ON "commerce_bookings"("public_number");

-- CreateIndex
CREATE INDEX "commerce_bookings_partner_id_service_id_starts_at_idx" ON "commerce_bookings"("partner_id", "service_id", "starts_at");

-- CreateIndex
CREATE INDEX "commerce_bookings_user_id_created_at_idx" ON "commerce_bookings"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "commerce_bookings_user_id_idempotency_key_key" ON "commerce_bookings"("user_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "commerce_booking_events_booking_id_created_at_idx" ON "commerce_booking_events"("booking_id", "created_at");

-- AddForeignKey
ALTER TABLE "commerce_carts" ADD CONSTRAINT "commerce_carts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_carts" ADD CONSTRAINT "commerce_carts_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_cart_items" ADD CONSTRAINT "commerce_cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "commerce_carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_orders" ADD CONSTRAINT "commerce_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_orders" ADD CONSTRAINT "commerce_orders_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_order_items" ADD CONSTRAINT "commerce_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "commerce_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_order_events" ADD CONSTRAINT "commerce_order_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "commerce_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_bookings" ADD CONSTRAINT "commerce_bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_bookings" ADD CONSTRAINT "commerce_bookings_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_booking_events" ADD CONSTRAINT "commerce_booking_events_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "commerce_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

