# Phase 3 — Provider Call Graphs

## Skin / Perfect Corp

Flutter + Firebase token → Render `/ai/skin-analysis` → Prisma
subscription → Redis rate gate (currently unproven/fail-open) → image quality
→ TFHub BlazeFace → Perfect file init/upload/task/poll → mapper → Face/Skin
engines → Prisma → response.

## Fashion / FASHN + OpenAI

Flutter `/ai/vision/outfit/analyze` → Firebase guard → Fashion orchestrator →
FASHN run/poll/mask geometry → OpenAI semantic JSON schema → quality/conflict
gates → Garment Intelligence → canonical garment DTO → local deterministic
Flutter scoring.

## Advisor / LLM

Flutter `/advisor/chat` → Firebase guard → owner entitlement → evidence
assembly → Mode A registry or Mode B OpenAI draft → schema/safety → Claim Lock
→ Beauty Advisor envelope. Current Mode B masters/flags are OFF/unproven.

## Firebase identity

Phone OTP → Firebase Auth user → ID token → Flutter Dio Bearer → Firebase
Admin verification → UID → Prisma user → subscription/rate/entitlement
authorization.

## Redis

Protected action → `RateLimitService`/MCE cost guard → `RedisService` →
increment/cache. No `REDIS_URL` means `0`/cache miss and request continues.

## Database

Render `DATABASE_URL` → startup `prisma migrate deploy` → Nest
`PrismaService.$connect()` → users/analyses/subscriptions/MCE/partners/leads.
