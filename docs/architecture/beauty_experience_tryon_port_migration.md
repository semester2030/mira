# BeautyTryOnPort → BeautyExperiencePort Migration

## Status

`BeautyTryOnPort` is **deprecated** but still bound in `PortsModule` for Phase 1 compatibility.

Canonical port: **`BeautyExperiencePort`** (`BEAUTY_EXPERIENCE_PORT`).

## Mapping

| Old | New |
|-----|-----|
| `listCapabilities()` → `{ id: makeup_vto }` | `listCapabilities()` → Mira capability DTOs |
| `tryOn(image)` | `executeCapability({ capabilityId, sessionId, policy })` |
| Disabled adapter only | FoundationBeautyExperienceAdapter + disabled try-on kept |

## Rules

1. New code must inject `BEAUTY_EXPERIENCE_PORT`.  
2. Flutter must never select providers.  
3. Do not remove `BEAUTY_TRYON_PORT` until a follow-up CR after all callers migrate.  
4. Try-On is a **capability**, not a platform.
