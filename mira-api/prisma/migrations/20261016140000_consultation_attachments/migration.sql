CREATE TABLE "consultation_attachments" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "message_id" TEXT,
  "mime_type" TEXT NOT NULL,
  "byte_size" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "storage_key" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ready',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "consultation_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "consultation_attachments_user_id_session_id_created_at_idx"
  ON "consultation_attachments"("user_id", "session_id", "created_at");

CREATE INDEX "consultation_attachments_user_id_created_at_idx"
  ON "consultation_attachments"("user_id", "created_at");

ALTER TABLE "consultation_attachments"
  ADD CONSTRAINT "consultation_attachments_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "consultation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
