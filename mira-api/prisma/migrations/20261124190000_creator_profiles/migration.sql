-- Celebrity public profile (1:1 with partners). Ads keep linking via CatalogAd.
CREATE TABLE "creator_profiles" (
    "id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "display_name_ar" TEXT NOT NULL,
    "bio_ar" TEXT,
    "avatar_key" TEXT,
    "avatar_mime" TEXT,
    "public_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creator_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "creator_profiles_partner_id_key" ON "creator_profiles"("partner_id");
CREATE INDEX "creator_profiles_public_active_created_at_idx" ON "creator_profiles"("public_active", "created_at" DESC);
ALTER TABLE "creator_profiles" ADD CONSTRAINT "creator_profiles_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
