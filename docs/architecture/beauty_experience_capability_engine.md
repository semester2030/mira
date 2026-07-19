# Capability Engine

**Version:** `beauty-cap-registry-v1`

## Components

| Component | Role |
|-----------|------|
| Registry | Canonical capability metadata (id, version, category, modes, cost, assets) |
| Engine | Resolve availability + runtime (foundation: UNAVAILABLE for execution) |
| Runtime | AVAILABLE / UNAVAILABLE / FAILED / SKIPPED / NOT_REQUESTED / BLOCKED_BY_POLICY |

## Required assets (examples)

| Capability | Assets |
|------------|--------|
| lip | lip_mask, portrait_image |
| foundation | face_mask, portrait_image |
| hair_color | hair_mask, portrait_image |
| glasses | face_mesh, portrait_image |

No provider logic lives in the Capability Engine.
