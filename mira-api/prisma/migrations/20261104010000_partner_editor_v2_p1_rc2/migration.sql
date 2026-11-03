-- P1 RC2: resume materialize → submit-review without DROP.
ALTER TABLE "partner_editor_drafts" ADD COLUMN IF NOT EXISTS "submit_review_status" TEXT;
ALTER TABLE "partner_editor_drafts" ADD COLUMN IF NOT EXISTS "submit_review_error" TEXT;
