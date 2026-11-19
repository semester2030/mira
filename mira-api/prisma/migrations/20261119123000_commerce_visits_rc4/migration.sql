-- RC4: structured consecutive visit requests (queryable; notes no longer the link source).

CREATE TABLE "commerce_visits" (
    "id" TEXT NOT NULL,
    "public_number" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'consecutive',
    "branch_id" TEXT,
    "branch_label" TEXT,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "contact_name" TEXT NOT NULL,
    "contact_phone" TEXT NOT NULL,
    "notes" TEXT,
    "idempotency_key" TEXT,
    "request_fingerprint" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commerce_visits_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "commerce_visits_public_number_key" ON "commerce_visits"("public_number");
CREATE UNIQUE INDEX "commerce_visits_user_id_idempotency_key_key" ON "commerce_visits"("user_id", "idempotency_key");
CREATE INDEX "commerce_visits_partner_id_created_at_idx" ON "commerce_visits"("partner_id", "created_at" DESC);
CREATE INDEX "commerce_visits_user_id_created_at_idx" ON "commerce_visits"("user_id", "created_at" DESC);

ALTER TABLE "commerce_visits" ADD CONSTRAINT "commerce_visits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "commerce_visits" ADD CONSTRAINT "commerce_visits_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "commerce_bookings" ADD COLUMN "visit_id" TEXT;
ALTER TABLE "commerce_bookings" ADD COLUMN "visit_sequence" INTEGER;

CREATE UNIQUE INDEX "commerce_bookings_visit_id_visit_sequence_key" ON "commerce_bookings"("visit_id", "visit_sequence");
CREATE INDEX "commerce_bookings_visit_id_idx" ON "commerce_bookings"("visit_id");

ALTER TABLE "commerce_bookings" ADD CONSTRAINT "commerce_bookings_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "commerce_visits"("id") ON DELETE SET NULL ON UPDATE CASCADE;
