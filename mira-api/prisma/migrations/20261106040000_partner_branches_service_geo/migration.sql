-- P4/P7 service location: PartnerBranch + Service place/coverage (resource ≠ branch).
CREATE TABLE IF NOT EXISTS "partner_branches" (
    "id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "city_id" TEXT NOT NULL,
    "city_name_ar" TEXT NOT NULL,
    "address_ar" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "partner_branches_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "partner_branches_partner_id_active_idx" ON "partner_branches"("partner_id", "active");
CREATE INDEX IF NOT EXISTS "partner_branches_city_id_active_idx" ON "partner_branches"("city_id", "active");

ALTER TABLE "partner_branches"
  ADD CONSTRAINT "partner_branches_partner_id_fkey"
  FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "place_mode" TEXT;
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "branch_id" TEXT;
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "coverage_json" JSONB;

CREATE INDEX IF NOT EXISTS "services_branch_id_idx" ON "services"("branch_id");
CREATE INDEX IF NOT EXISTS "services_place_mode_idx" ON "services"("place_mode");

ALTER TABLE "services"
  ADD CONSTRAINT "services_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "partner_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
