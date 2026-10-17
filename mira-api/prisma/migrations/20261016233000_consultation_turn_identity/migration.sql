ALTER TABLE "consultation_messages"
  ADD COLUMN "client_message_id" TEXT,
  ADD COLUMN "request_hash" TEXT,
  ADD COLUMN "reply_to_message_id" TEXT,
  ADD COLUMN "turn_status" TEXT;

CREATE UNIQUE INDEX "consultation_messages_session_id_client_message_id_key"
  ON "consultation_messages"("session_id", "client_message_id");

CREATE INDEX "consultation_messages_reply_to_message_id_idx"
  ON "consultation_messages"("reply_to_message_id");
