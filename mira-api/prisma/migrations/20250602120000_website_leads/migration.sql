-- CreateTable
CREATE TABLE "website_leads" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "type" TEXT NOT NULL DEFAULT 'contact',
    "message" TEXT NOT NULL,
    "ip_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "website_leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "website_leads_created_at_idx" ON "website_leads"("created_at" DESC);
