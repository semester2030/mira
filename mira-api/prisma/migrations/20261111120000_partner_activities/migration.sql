-- Partner activity requests, line decisions, and grants (additive).
CREATE TABLE IF NOT EXISTS "pa_requests" (
  "id" TEXT NOT NULL,
  "application_id" TEXT,
  "partner_id" TEXT,
  "kind" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "meta" JSONB NOT NULL,
  "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed_at" TIMESTAMP(3),
  "reviewer_id" TEXT,
  "reason" TEXT,
  CONSTRAINT "pa_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pa_requests_kind_check" CHECK ("kind" IN ('join','expand')),
  CONSTRAINT "pa_requests_state_check" CHECK ("state" IN ('pending','approved','partial','rejected')),
  CONSTRAINT "pa_requests_join_or_expand" CHECK (
    ("kind" = 'join' AND "application_id" IS NOT NULL) OR
    ("kind" = 'expand' AND "application_id" IS NULL AND "partner_id" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS "pa_requests_application_id_key" ON "pa_requests"("application_id");
CREATE UNIQUE INDEX IF NOT EXISTS "pa_one_pending_expand" ON "pa_requests"("partner_id") WHERE "kind" = 'expand' AND "state" = 'pending';
CREATE INDEX IF NOT EXISTS "pa_queue" ON "pa_requests"("state", "submitted_at");

CREATE TABLE IF NOT EXISTS "pa_lines" (
  "id" TEXT NOT NULL,
  "request_id" TEXT NOT NULL,
  "activity" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "item_name" TEXT NOT NULL DEFAULT '',
  "decision" TEXT NOT NULL DEFAULT 'pending',
  CONSTRAINT "pa_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pa_lines_scope_check" CHECK ("scope" IN ('category','one')),
  CONSTRAINT "pa_lines_decision_check" CHECK ("decision" IN ('pending','approved','rejected')),
  CONSTRAINT "pa_lines_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "pa_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "pa_lines_request_activity_scope_item_key"
  ON "pa_lines"("request_id", "activity", "scope", "item_name");

CREATE TABLE IF NOT EXISTS "pa_grants" (
  "partner_id" TEXT NOT NULL,
  "activity" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "item_name" TEXT NOT NULL DEFAULT '',
  "line_id" TEXT NOT NULL,
  "bound_item" TEXT,
  CONSTRAINT "pa_grants_pkey" PRIMARY KEY ("partner_id", "activity", "scope", "item_name"),
  CONSTRAINT "pa_grants_scope_check" CHECK ("scope" IN ('category','one')),
  CONSTRAINT "pa_grants_line_id_key" UNIQUE ("line_id"),
  CONSTRAINT "pa_grants_line_id_fkey" FOREIGN KEY ("line_id") REFERENCES "pa_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "pa_grants_partner_id_idx" ON "pa_grants"("partner_id");

CREATE TABLE IF NOT EXISTS "pa_history" (
  "id" TEXT NOT NULL,
  "request_id" TEXT NOT NULL,
  "actor" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "happened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "detail" JSONB NOT NULL,
  CONSTRAINT "pa_history_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pa_history_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "pa_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "pa_history_request_id_idx" ON "pa_history"("request_id");

ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "activities_meta" JSONB;
