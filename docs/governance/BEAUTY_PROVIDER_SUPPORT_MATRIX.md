# Beauty Provider Support Matrix

**Version:** `beauty-provider-support-v1`

Providers are **not** capabilities. Capability IDs never equal provider ids.

Source: `mira-api/src/beauty-experience/provider-manager/provider-matrix.ts`

## Shape

Capability → Supported Providers → Priority → Modes → Platforms → Health → Version

## Examples

| Capability | Provider | Priority | Modes |
|------------|----------|----------|-------|
| lip | perfect_beauty | 100 | image, realtime |
| lip | banuba_beauty | 80 | realtime |
| hair_color | banuba_beauty | 100 | realtime, offline |
| hair_color | perfect_beauty | 90 | image |
| glasses | banuba_beauty | 100 | realtime |
| glasses | perfect_beauty | 70 | image |

Foundation stubs remain unlicensed / no SDK until Phase 5B.
