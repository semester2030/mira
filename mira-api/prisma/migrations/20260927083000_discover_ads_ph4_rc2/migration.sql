ALTER TABLE "catalog_ads" ADD COLUMN "submitted_revision" INTEGER;
ALTER TABLE "catalog_ads" ADD COLUMN "review_note" TEXT;
ALTER TABLE "catalog_ads" ADD COLUMN "reviewed_by" TEXT;
ALTER TABLE "catalog_ads" ADD COLUMN "submitted_at" TIMESTAMP(3);

CREATE TABLE "catalog_ad_decisions" (
    "id" TEXT NOT NULL,
    "ad_id" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "decision" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "catalog_ad_decisions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "catalog_ad_decisions_ad_id_created_at_idx" ON "catalog_ad_decisions"("ad_id", "created_at");

ALTER TABLE "catalog_ad_decisions" ADD CONSTRAINT "catalog_ad_decisions_ad_id_fkey" FOREIGN KEY ("ad_id") REFERENCES "catalog_ads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
