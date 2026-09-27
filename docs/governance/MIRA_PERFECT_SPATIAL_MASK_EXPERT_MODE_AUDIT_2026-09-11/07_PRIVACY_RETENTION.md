# 07 — Privacy / Retention Findings

## MIRA side (proven)

| Behavior | Evidence |
|----------|----------|
| Image held in memory for analysis | `PerfectCorpService.analyzeSkin(imageBytes)` |
| Buffer zeroed after analysis path | `skin-analysis.service.ts` → `imageBuffer.fill(0)` |
| Full `rawYouCam` not persisted | `redactYouCamAudit` / Phase 0 notes |
| Persistent user face storage | **FORBIDDEN** by product architecture docs (`RENDER_PERFECT_CORP.md`: no image stored) |

## Perfect side (known vs unknown)

| Topic | State |
|-------|-------|
| Temporary upload via presigned S3 | **KNOWN pattern** (file init → PUT → task) |
| Provider file lifetime | **UNKNOWN** (no retention policy URL in readiness registry) |
| Mask/overlay URL lifetime | **UNKNOWN** (masks not received today) |
| Immediate delete API | **UNKNOWN** / **NOT IMPLEMENTED** in MIRA |
| Can visualize without MIRA persistent face store | **YES preferred** if Perfect returns ephemeral mask URLs and MIRA keeps face ephemeral — architecture compatible; Perfect retention still **UNKNOWN** |

`retentionPolicyUrl: undefined` in `seed-registry.ts` for Perfect Beauty docs block.
