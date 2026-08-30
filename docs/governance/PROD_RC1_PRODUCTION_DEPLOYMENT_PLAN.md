# PROD-RC-1 — Production Deployment Plan

## Order (unchanged policy — not executed)

1. Deploy backend flags OFF
2. Health-check existing prod
3. Publish iOS with code present, runtime master OFF
4. Verify no regression
5. Enable Face internal/allowlist
6. Audit
7. Expand Face
8. Enable Fashion internal
9. Audit provider usage/cost
10. Expand Fashion
11. Telemetry remains OFF until consent

**Do not** enable Face and Fashion globally simultaneously.

**Current:** plan only — gates not passed.
