# PROD-RC-1 — Kill Switch Report

| Layer | Rollback mechanism | Verdict |
|---|---|---|
| Fashion server flags | Env flip to false → fail closed / no Mode B | **AVAILABLE** |
| Fashion client `MIRA_FASHION_ADVISOR_V1` | Reinstall binary with define false | **COMPILE-TIME ONLY** |
| Face client three flags | Reinstall binary with defines false | **COMPILE-TIME ONLY** |
| Results V2 FlagStore | Runtime apply | Exists but **not** Face/Fashion master |
| Backend deploy rollback | Previous Render deploy | Requires healthy Render account |
| App Store binary rollback | Remote flags first preferred | Face/Fashion remote master **MISSING** |

## Policy application

- TestFlight / internal QA with dart-defines: **may proceed** after QA backend exists.
- **Public production activation: BLOCKED** until practical Face/Fashion runtime master kill switch (reuse FlagStore / Remote Config — do not invent second platform).

## Recommended kill order (when live)

1. Server Fashion flags OFF
2. Remote Face/Fashion master OFF (once implemented)
3. Stop serving new binary only if required
4. Backend previous known-good deploy
