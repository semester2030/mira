-- Additive schema. Text IDs refer to MIRA-issued application/partner IDs.
-- Approval + activation must share the same host transaction.
CREATE TABLE IF NOT EXISTS pa_requests (
 id TEXT PRIMARY KEY, application_id TEXT UNIQUE, partner_id TEXT, kind TEXT NOT NULL CHECK(kind IN ('join','expand')),
 state TEXT NOT NULL CHECK(state IN ('pending','approved','partial','rejected')),
 description TEXT NOT NULL, meta TEXT NOT NULL, submitted_at TEXT NOT NULL,
 reviewed_at TEXT, reviewer_id TEXT, reason TEXT,
 CHECK((kind='join' AND application_id IS NOT NULL) OR (kind='expand' AND application_id IS NULL AND partner_id IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS pa_one_pending_expand ON pa_requests(partner_id) WHERE kind='expand' AND state='pending';
CREATE INDEX IF NOT EXISTS pa_queue ON pa_requests(state,submitted_at);
CREATE TABLE IF NOT EXISTS pa_lines (
 id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES pa_requests(id), activity TEXT NOT NULL,
 scope TEXT NOT NULL CHECK(scope IN ('category','one')), item_name TEXT NOT NULL,
 decision TEXT NOT NULL CHECK(decision IN ('pending','approved','rejected')),
 UNIQUE(request_id, activity, scope, item_name)
);
CREATE TABLE IF NOT EXISTS pa_grants (
 partner_id TEXT NOT NULL, activity TEXT NOT NULL, scope TEXT NOT NULL CHECK(scope IN ('category','one')),
 item_name TEXT NOT NULL, line_id TEXT NOT NULL UNIQUE REFERENCES pa_lines(id),
 bound_item TEXT, PRIMARY KEY(partner_id,activity,scope,item_name)
);
CREATE TABLE IF NOT EXISTS pa_history (
 id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES pa_requests(id), actor TEXT NOT NULL,
 action TEXT NOT NULL, happened_at TEXT NOT NULL, detail TEXT NOT NULL
);
