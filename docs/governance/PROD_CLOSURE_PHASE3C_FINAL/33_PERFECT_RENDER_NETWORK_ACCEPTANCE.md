# 33 — Perfect Render Network Acceptance

Task: `MIRA-P3C-FINAL-ACCEPTANCE-2026-08-31`

## Environment

- mechanism: Render one-off job on existing `mira-api`;
- network: Render Oregon;
- deployed image commit: `dca189cdd42f73d63ac3a4ac3ee00471151c6e98`;
- candidate deployment: NO;
- source/config/database mutation: NO;
- media: tracked synthetic, non-customer face fixture;
- `NODE_ENV=production`;
- `PERFECT_CORP_FALLBACK_MOCK=false`.

The deployed commit contains `PerfectCorpSkinAdapter`,
`PerfectCorpSkinProvider`, and `PerfectCorpService`.

`PERFECT TEST ENVIRONMENT = RENDER`

## Stage evidence

The adapter's existing quality retry behavior processed three image variants
inside one controlled acceptance job:

| Variant | FILE_INIT | UPLOAD | TASK_CREATE | POLL terminal |
|---:|---|---|---|---|
| 1 | 200 PASS | 200 PASS | 200 PASS | `error` |
| 2 | 200 PASS | 200 PASS | 200 PASS | `error` |
| 3 | 200 PASS | 200 PASS | 200 PASS | `success` |

Safe endpoint contract:

- API host: `yce-api-01.makeupar.com`;
- presigned upload host: `yce-us.s3-accelerate.amazonaws.com`;
- upload method: `PUT`;
- upload header names: `content-length`, `content-type`;
- API header names: `authorization`, `content-type` (values not logged).

Total job acceptance latency: 8,808 ms (`OBSERVED SAMPLE ONLY`).

## Post-return harness error

After `await PerfectCorpSkinAdapter.analyze()` returned, the diagnostic tried
to call `.every()` on `REQUIRED_YOUCAM_CONCERNS`. That constant is not exported
by deployed commit `dca189c`; this produced a harness-only `TypeError`.

This occurred after:

- provider terminal success;
- `PerfectCorpService.mapYouCamResults()` returned;
- `PerfectCorpSkinProvider` returned `isMock: false`;
- `PerfectCorpSkinAdapter` returned a canonical `SkinAnalysisPortResult`.

In production mode the adapter blocks any mock result before return. Therefore
successful return proves no synthetic replacement.

## Decision

- local upload: FAIL;
- Render upload: PASS;
- exact upload root cause: `LOCAL_NETWORK_SPECIFIC_FAILURE`;
- FILE_INIT: PASS;
- UPLOAD: PASS;
- TASK_CREATE: PASS;
- POLL: PASS;
- TERMINAL_STATE: SUCCESS;
- REAL_PROVIDER_RESPONSE: YES;
- MAPPER: PASS;
- CANONICAL_RESULT: PASS;
- SYNTHETIC_REPLACEMENT: NO;
- PERFECT_FAILURE_FAKE_SUCCESS: 0.

`PERFECT_REAL_ACCEPTANCE = PROVEN`

`PERFECT_RENDER_ACCEPTANCE = PROVEN`

No Perfect production code remediation is required.
