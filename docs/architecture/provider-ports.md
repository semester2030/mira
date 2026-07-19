# Provider Ports (Phase 1 + Phase 5A)

## Canonical production paths

### Skin
`Flutter → POST /api/v1/ai/skin-analysis → SkinAnalysisService → SkinAnalysisOrchestrator → SkinAnalysisPort (PerfectCorpSkinAdapter) → PerfectCorpSkinProvider → Intelligence → Prisma`

### Fashion
`Flutter → POST /api/v1/ai/vision/outfit/analyze → FashionAnalysisOrchestrator → FashionAnalysisPort (VisionFashionAdapter) → VisionOrchestratorService (FASHN + OpenAI) → Flutter`

### Beauty Experience (Phase 5A Foundation — no real VTO)
`Capability → Policy Engine → Provider Manager → BeautyExperiencePort (FoundationBeautyExperienceAdapter) → Canonical DTO → Session`

## Ports

| Port | Production adapter | Notes |
|------|-------------------|--------|
| `SkinAnalysisPort` | `PerfectCorpSkinAdapter` | Mock adapter blocked in production |
| `FashionAnalysisPort` | `VisionFashionAdapter` | Strips raw FASHN/OpenAI keys |
| `ImageQualityPort` | `CaptureImageQualityAdapter` | Phase 2: real blur/brightness/exposure; unmeasured = `unavailable` |
| `BeautyTryOnPort` | `DisabledBeautyTryOnAdapter` | **Deprecated** — kept for Phase 1 compat |
| `BeautyExperiencePort` | `FoundationBeautyExperienceAdapter` | Canonical; capability negotiation; no SDK in 5A |
| `AnalysisTelemetryPort` | `NoopAnalysisTelemetryAdapter` | Not a claim of production monitoring |

## Legacy paths

- `OUTFIT_PROVIDER=mock` / `POST /ai/outfit-analysis` — **legacy**, blocked in production (Phase 0). Not canonical.
- Do not set `FASHION_PROVIDER=legacy_outfit_mock` in production.

## Provider selection

| Env | Rule |
|-----|------|
| `SKIN_PROVIDER` | `perfect_corp` (prod) or `mock` (dev only) |
| `FASHION_PROVIDER` | `vision_platform` only in prod |
| `MOCK_PROVIDER_ACCESS` | must be false in production |
| `PERFECT_CORP_FALLBACK_MOCK` | must be false in production (Phase 0) |
| `BEAUTY_TRYON_ENABLED` | false unless registered legacy adapter |
| `BEAUTY_EXPERIENCE_ENABLED` | foundation on (default true) |
| `BEAUTY_REAL_TRYON_ENABLED` | **false** until Phase 5B licensed adapter |

## Error taxonomy

See `mira-api/src/ports/shared/provider-error.ts`. Client responses never include `internalDetails`.

## Extension points

- Phase 2: **done** — real pixel signals + gate before Perfect (`iq-v2.0+qc-v1`)
- Phase 5A: **done** — Beauty Experience Foundation ([beauty_experience_foundation.md](./beauty_experience_foundation.md))
- Phase 5B: first real capability (explicit approval required)
