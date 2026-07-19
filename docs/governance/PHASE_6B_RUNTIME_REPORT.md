# Runtime Report — Phase 6B

**Runtime version:** `fashion-runtime-v1`

## Supported statuses

`NOT_REQUESTED` · `AVAILABLE` · `PARTIAL` · `DEGRADED` · `UNAVAILABLE` · `BLOCKED` · `FAILED`

Each emitted runtime includes: `reason*` · `stage` · `retryable` · `trustLevel`.

`providerId` is server-audit only and stripped via `toPublicFashionRuntime`.

## 6B behavior

| Capability | Runtime outcome |
|------------|-----------------|
| `wardrobe` / `wardrobe_insights` / `history` / `progress` | `AVAILABLE` when flags on |
| Provider-backed caps (`analyze_*`, `recolor_*`, …) | `BLOCKED` with `foundation_gate` |
