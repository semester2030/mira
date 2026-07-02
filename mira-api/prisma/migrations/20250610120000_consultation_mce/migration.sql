-- MCE Phase 1 — consultation tables
-- Reference: docs/mira-vision-platform.html#mce-consultation

CREATE TABLE "consultation_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title_ar" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "locale" TEXT NOT NULL DEFAULT 'ar',
    "occasion_id" TEXT,
    "active_snapshot_id" TEXT,
    "rolling_summary_ar" TEXT,
    "turn_count" INTEGER NOT NULL DEFAULT 0,
    "last_compacted_at" TIMESTAMP(3),
    "plan_tier" TEXT NOT NULL DEFAULT 'free',
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consultation_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "consultation_messages" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content_ar" TEXT NOT NULL,
    "payload_json" JSONB,
    "token_count_in" INTEGER,
    "token_count_out" INTEGER,
    "model_id" TEXT,
    "latency_ms" INTEGER,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultation_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "consultation_context_snapshots" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "skin_analysis_id" TEXT,
    "outfit_analysis_id" TEXT,
    "recolor_attempt_id" TEXT,
    "snapshot_json" JSONB NOT NULL,
    "fact_registry_json" JSONB NOT NULL,
    "content_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultation_context_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "consultation_recommendations" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "message_id" TEXT,
    "type" TEXT NOT NULL,
    "title_ar" TEXT NOT NULL,
    "rationale_ar" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "partner_id" TEXT,
    "product_id" TEXT,
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultation_recommendations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "consultation_sessions_user_id_updated_at_idx" ON "consultation_sessions"("user_id", "updated_at" DESC);
CREATE INDEX "consultation_sessions_user_id_status_idx" ON "consultation_sessions"("user_id", "status");
CREATE INDEX "consultation_messages_session_id_created_at_idx" ON "consultation_messages"("session_id", "created_at");
CREATE UNIQUE INDEX "consultation_context_snapshots_session_id_version_key" ON "consultation_context_snapshots"("session_id", "version");
CREATE INDEX "consultation_context_snapshots_skin_analysis_id_idx" ON "consultation_context_snapshots"("skin_analysis_id");
CREATE INDEX "consultation_context_snapshots_outfit_analysis_id_idx" ON "consultation_context_snapshots"("outfit_analysis_id");
CREATE INDEX "consultation_recommendations_session_id_created_at_idx" ON "consultation_recommendations"("session_id", "created_at");

ALTER TABLE "consultation_sessions" ADD CONSTRAINT "consultation_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "consultation_messages" ADD CONSTRAINT "consultation_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "consultation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "consultation_context_snapshots" ADD CONSTRAINT "consultation_context_snapshots_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "consultation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "consultation_recommendations" ADD CONSTRAINT "consultation_recommendations_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "consultation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
