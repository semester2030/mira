-- Phase 3: optional birth year for Age Intelligence
ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "birth_year" INTEGER;
