-- One assistant answer per user turn. Null reply ids stay unrestricted.
CREATE UNIQUE INDEX "consultation_messages_reply_to_message_id_key"
ON "consultation_messages"("reply_to_message_id");
