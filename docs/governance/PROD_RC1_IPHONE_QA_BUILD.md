# PROD-RC-1 — iPhone QA Build

**Status:** PARTIAL historically · CURRENT ATTACH BLOCKED

## Last known good (QA-1)

- Physical device: fayez’s iPhone
- dart-defines Face three flags true + USE_MIRA_API true
- Build/install/launch SUCCESS on USB
- Later: DEBUG_SESSION_INTERRUPTED (background)
- Relaunch wireless: Error launching / VM Service undiscovered (**QA1-ENV-04**)

## Required for PROD-RC-1 Gate 8–9

1. USB connection
2. Unlock + foreground
3. Point `MIRA_API_BASE_URL` to **QA backend** (not suspended production)
4. Same Face flags + Fashion client flag only when Fashion QA starts
