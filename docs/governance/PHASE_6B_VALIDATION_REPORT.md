# Validation Report — Phase 6B

| Rule | Result |
|------|--------|
| Duplicate item / garment ids | Rejected |
| Orphan collection / favorite / look refs | Rejected |
| Invalid lifecycle writes on archived wardrobe | Rejected |
| Invalid runtime transitions | Rejected |
| Session integrity (duplicate attempt/garment ids) | Rejected |
| Provider payload leakage | Asserted on public DTOs |
| Ownership law violations | Checked in validator |

Automated coverage: `phase6b-wardrobe-foundation.schema-tests.ts`.
