ALTER TABLE "consultation_messages" ADD COLUMN "attempt_token" TEXT;
ALTER TABLE "consultation_messages" ADD COLUMN "attempt_expires_at" TIMESTAMP(3);
