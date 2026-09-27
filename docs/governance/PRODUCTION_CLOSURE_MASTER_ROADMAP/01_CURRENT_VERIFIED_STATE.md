# Current Verified Technical State

## Proven

- official source identity and Phase 3B reproducibility: PASS;
- production-critical uncommitted source after Phase 3B Final: 0;
- Phase 3C changed no production source;
- current Render API is reachable and live Prisma-backed reads succeed;
- provider failure cannot become a successful-looking AI result;
- Firebase missing/invalid token rejection is live-proven;
- Avatar owner/path/type/size contract is emulator-proven;
- Redis bounded read/write/TTL/delete is local-proven;
- Flutter analyzer has 0 errors and no new Phase 3B warning regression.

## Not proven

- live production equals candidate `4b2c78a`;
- `/entitlements/runtime` is deployed (last observed HTTP 404);
- real Perfect Corp, FASHN or LLM response;
- valid controlled Firebase identity through the live backend;
- controlled production Storage acceptance;
- production Redis/Valkey;
- production BlazeFace preload/inference;
- complete Skin/Face/Fashion/Advisor production E2E;
- signed reproducible iOS and Android release artifacts;
- complete security-advisory disposition, observability and operations;
- final GO-LIVE approval.

The live `dca812d` stats marker is hardcoded source content, not reliable deploy
identity. Historical npm advisories and analyzer warnings/info remain open for
Phase 6 disposition.
