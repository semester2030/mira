# Beauty Experience Foundation (Phase 5A)

**Release:** `0.1.0-foundation`  
**Status:** Foundation · No Real Try-On  
**Architecture:** `beauty-experience-arch-v1`

Beauty Experience is an independent Mira subsystem. It is **not** Skin Intelligence, Face Intelligence, Fashion Intelligence, Perfect Corp, or Banuba.

## What shipped

- `BeautyExperiencePort` (canonical)
- Capability Registry / Engine
- Capability Policy Engine (before providers)
- Provider Manager + extended matrix (stubs only)
- Mira-owned Beauty Session (analysis sources, attempts, looks, favorites, collections, share)
- Comparison + History models
- Canonical DTOs (no provider fields on Flutter wire)
- Health block: `intelligence.beautyExperience`
- Tests: `npm run test:phase5a` · `npm run audit:beauty-eng-laws`

## What did NOT ship

- Perfect Makeup SDK / Banuba SDK
- Real virtual try-on
- Product UI / commerce
- Changes to Face or Skin Intelligence

## Package

`mira-api/src/beauty-experience/`

## Engineering Laws

See [beauty_experience_engineering_laws.md](./beauty_experience_engineering_laws.md).

## Migration from BeautyTryOnPort

See [beauty_experience_tryon_port_migration.md](./beauty_experience_tryon_port_migration.md).
