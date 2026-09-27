# Phase 3 — Perfect Corp Production Audit

## Call graph

Flutter skin action → authenticated MIRA API → subscription/rate/image gates →
server BlazeFace → Skin orchestrator → Perfect adapter → YouCam file init →
signed upload → task create → poll → mapper → Face/Skin intelligence → Prisma
→ Flutter result.

## Proof ladder

| Rung | Status | Evidence |
|---|---|---|
| Adapter exists | PASS | committed service/provider |
| Runtime wired | PASS | canonical Flutter/API/orchestrator path |
| Production route | PASS | `/ai/skin-analysis` |
| Credential presence | PRESENT | live health boolean only |
| Provider endpoint reachable | NETWORK TARGET REACHABLE, API root returned 404 | no authenticated provider operation |
| Account/license | UNKNOWN | console access required |
| Credits/quota/billing | UNKNOWN | console access required |
| Real provider response | NOT_PROVEN | no committed/live task artifact |
| User E2E | NOT_PROVEN | no safe real image/provider run |

Canonical production mock fallback is blocked by startup, port, provider and
service gates. Live health proves `SKIN_PROVIDER=perfect_corp`, key present and
fallback false.

## New truth defect

`PerfectCorpService.mapYouCamResults()` supplies fixed fallback scores when a
successful provider payload omits concerns (including an empty concerns list).
Thus a partial/malformed “success” can produce synthetic metrics instead of an
explicit incomplete/failure result. This is not the mock provider, but it is
synthetic AI success risk and blocks Phase 3 provider readiness.

HTTP/provider failures otherwise surface as 4xx/5xx/timeout; no production mock
fallback. 429/quota has no provider-specific classification.

## Owner verification

In Perfect Corp console, without pasting secrets into chat: verify active
account, Skin Analysis product/SKU, production permission, available credits,
billing, rate limits, expiry, retention, region/DPA, and one approved
non-private test task.

## Verdict

`BLOCKED — EXTERNAL_ACCOUNT_VERIFICATION + MAPPER REMEDIATION REQUIRED`
