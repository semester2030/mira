-- Partner portal automation tables

CREATE TABLE "partner_applications" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "type" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "contact_name" TEXT NOT NULL,
    "contact_email" TEXT NOT NULL,
    "contact_phone" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT 'الرياض',
    "description_ar" TEXT,
    "store_url" TEXT,
    "cr_number" TEXT,
    "vat_number" TEXT,
    "message" TEXT,
    "status_token" TEXT NOT NULL,
    "partner_id" TEXT,
    "reject_reason" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_applications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "partner_applications_status_token_key" ON "partner_applications"("status_token");
CREATE INDEX "partner_applications_status_created_at_idx" ON "partner_applications"("status", "created_at" DESC);

ALTER TABLE "partner_applications" ADD CONSTRAINT "partner_applications_partner_id_fkey"
    FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "partner_users" (
    "id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'owner',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "partner_users_partner_id_key" ON "partner_users"("partner_id");
CREATE UNIQUE INDEX "partner_users_email_key" ON "partner_users"("email");
CREATE UNIQUE INDEX "partner_users_access_token_key" ON "partner_users"("access_token");

ALTER TABLE "partner_users" ADD CONSTRAINT "partner_users_partner_id_fkey"
    FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "partner_events" (
    "id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "target_id" TEXT,
    "target_type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "partner_events_partner_id_event_type_created_at_idx" ON "partner_events"("partner_id", "event_type", "created_at" DESC);

ALTER TABLE "partner_events" ADD CONSTRAINT "partner_events_partner_id_fkey"
    FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
