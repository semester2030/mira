CREATE TABLE "catalog_ads" (
    "id" TEXT NOT NULL,
    "target_kind" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "advertiser_partner_id" TEXT NOT NULL,
    "publisher_partner_id" TEXT NOT NULL,
    "caption_ar" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "review_revision" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "catalog_ads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "catalog_ad_actions" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "ad_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "catalog_ad_actions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "catalog_ad_actions_event_id_key" ON "catalog_ad_actions"("event_id");
CREATE INDEX "catalog_ads_target_kind_target_id_status_idx" ON "catalog_ads"("target_kind", "target_id", "status");
CREATE INDEX "catalog_ads_advertiser_partner_id_status_idx" ON "catalog_ads"("advertiser_partner_id", "status");
CREATE INDEX "catalog_ad_actions_ad_id_action_idx" ON "catalog_ad_actions"("ad_id", "action");

ALTER TABLE "catalog_ads" ADD CONSTRAINT "catalog_ads_advertiser_partner_id_fkey" FOREIGN KEY ("advertiser_partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "catalog_ads" ADD CONSTRAINT "catalog_ads_publisher_partner_id_fkey" FOREIGN KEY ("publisher_partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "catalog_ad_actions" ADD CONSTRAINT "catalog_ad_actions_ad_id_fkey" FOREIGN KEY ("ad_id") REFERENCES "catalog_ads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
