# Pre-Deployment Production Snapshot

## CONFIG / RUNTIME / PRODUCTION evidence

- Snapshot window: 2026-08-31T03:50Z–03:52Z
- Service: `srv-d85ngcfavr4c73d3rk6g`
- Current deploy: `dep-da5pb995efls73c3gl2g`
- Current SHA: `dca189cdd42f73d63ac3a4ac3ee00471151c6e98`
- Canonical health: `GET /api/v1/health` → 200
- Runtime entitlement: `GET /api/v1/entitlements/runtime` → 404
- Website features: 200
- Website stats: 200
- PostgreSQL `SELECT 1`: `PASS`
- Redis runtime `PING`: `PASS` (`job-daafkgp42hec73ac688g`)
- Perfect provider selected and key presence: `PASS`
- Production integrity fatal issues: `0`

Master entitlement variables were absent and therefore resolved to their
source-defined fail-closed defaults: masters OFF and allowlist empty. No
environment value or secret was recorded.
