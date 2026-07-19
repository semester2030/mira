# Beauty Capability Catalog v1.0.0

**Status:** Frozen · Production Catalog  
**Frozen at:** 2026-07-19  
**SSOT:** `mira-api/src/beauty-experience/capability/BEAUTY_CAPABILITY_CATALOG.json`

## Engineering Laws

- **#13** Capability IDs are permanent — never rename.  
- **#14** Capability Metadata is the single source of truth.  
- **#15** Dependencies must be explicit.  
- **#16** Runtime must be explainable (reason, stage, policy, version; provider audit server-only).

## Frozen Capability IDs

| ID | Display (EN) | Category | Cost | Status |
|----|--------------|----------|------|--------|
| `lip` | Lip | makeup | MEDIUM | active |
| `foundation` | Foundation | makeup | MEDIUM | active |
| `blush` | Blush | makeup | LOW | active |
| `eyeshadow` | Eyeshadow | makeup | MEDIUM | active |
| `contour` | Contour | makeup | MEDIUM | active |
| `hair_color` | Hair Color | hair | HIGH | active |
| `hair_style` | Hair Style | hair | VERY_HIGH | active |
| `glasses` | Eyewear | accessories | MEDIUM | active |
| `look` | Full Look | look | VERY_HIGH | active |
| `makeup_vto` | Legacy Makeup VTO | legacy | MEDIUM | deprecated |

**Note:** Display name for `glasses` is “Eyewear”. The ID is permanently `glasses` (not `eyewear`).

## Fields per capability

ID · Display Name · Category · Group · Version · Status · Description · Modes · Platforms · Realtime · Offline · Quality Requirements · Required Assets · Dependencies · Runtime States · Provider Support (matrix separate) · Cost Class · Future Status · Deprecation Policy.

Provider names never appear inside capability metadata.
