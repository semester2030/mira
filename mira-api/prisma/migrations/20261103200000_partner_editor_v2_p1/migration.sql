-- P1 Partner Editor v2: additive only. No backfill. No drops.

CREATE TABLE "partner_editor_drafts" (
    "id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "client_draft_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "schema_version" INTEGER NOT NULL,
    "values_json" JSONB NOT NULL DEFAULT '{}',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'open',
    "target_owner_id" TEXT,
    "materialized_at" TIMESTAMP(3),
    "materialize_key" TEXT,
    "materialize_fingerprint" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_editor_drafts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "partner_editor_drafts_partner_id_client_draft_id_key"
  ON "partner_editor_drafts"("partner_id", "client_draft_id");

CREATE INDEX "partner_editor_drafts_partner_id_updated_at_idx"
  ON "partner_editor_drafts"("partner_id", "updated_at" DESC);

CREATE INDEX "partner_editor_drafts_partner_id_kind_target_owner_id_idx"
  ON "partner_editor_drafts"("partner_id", "kind", "target_owner_id");

ALTER TABLE "partner_editor_drafts"
  ADD CONSTRAINT "partner_editor_drafts_partner_id_fkey"
  FOREIGN KEY ("partner_id") REFERENCES "partners"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "products" ADD COLUMN "profile_id" TEXT;
ALTER TABLE "products" ADD COLUMN "schema_version" INTEGER;

ALTER TABLE "services" ADD COLUMN "profile_id" TEXT;
ALTER TABLE "services" ADD COLUMN "schema_version" INTEGER;
ALTER TABLE "services" ADD COLUMN "service_profile_json" JSONB;
ALTER TABLE "services" ADD COLUMN "draft_service_profile_json" JSONB;
ALTER TABLE "services" ADD COLUMN "draft_service_profile_set" BOOLEAN NOT NULL DEFAULT false;
