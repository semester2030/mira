-- MCE Phase 4 — Atelier recolor attempts (QEL metadata only, no images)

CREATE TABLE "atelier_recolor_attempts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "outfit_analysis_id" TEXT,
    "garment_label_ar" TEXT NOT NULL,
    "target_color_ar" TEXT NOT NULL,
    "target_color_hex" TEXT,
    "region_role" TEXT,
    "qel_gate" TEXT NOT NULL,
    "qel_scores_json" JSONB,
    "reject_reason_ar" TEXT,
    "recolor_scope" TEXT NOT NULL DEFAULT 'color_only',
    "processing_ms" INTEGER,
    "attempt_number" INTEGER NOT NULL DEFAULT 1,
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atelier_recolor_attempts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "atelier_recolor_attempts_user_id_created_at_idx"
    ON "atelier_recolor_attempts"("user_id", "created_at" DESC);

ALTER TABLE "atelier_recolor_attempts"
    ADD CONSTRAINT "atelier_recolor_attempts_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
