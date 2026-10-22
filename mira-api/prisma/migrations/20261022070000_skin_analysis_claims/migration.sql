-- Recoverable skin analysis claims (idempotent clientRequestId retries).
CREATE TABLE "skin_analysis_claims" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "client_request_id" TEXT NOT NULL,
    "input_fingerprint" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempt_token" TEXT,
    "attempt_expires_at" TIMESTAMP(3),
    "provider_task_id" TEXT,
    "analysis_id" TEXT,
    "rate_limit_charged" BOOLEAN NOT NULL DEFAULT false,
    "error_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skin_analysis_claims_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "skin_analysis_claims_user_id_client_request_id_key" ON "skin_analysis_claims"("user_id", "client_request_id");
CREATE INDEX "skin_analysis_claims_user_id_created_at_idx" ON "skin_analysis_claims"("user_id", "created_at" DESC);

ALTER TABLE "skin_analysis_claims" ADD CONSTRAINT "skin_analysis_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "skin_analysis_claims" ADD CONSTRAINT "skin_analysis_claims_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "skin_analyses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
