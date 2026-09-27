# Phase 3C Final — Perfect Corp Failure Root Cause

Date: 2026-08-31
Source: `4b2c78ac42fef38dc0012a35ba6879ae4d6a4a74`

## Previous request (insufficiently staged)

- entry: `PerfectCorpService.analyzeSkin()` (adapter wrapper not used)
- media: tracked synthetic `assets/images/premium_face_base_raw.png`
- duration: 11,904 ms
- sanitized class: `OTHER`
- synthetic replacement: NO
- secrets: not logged

That evidence could not locate the failing hop.

## Authorized additional request (stage-instrumented)

Exactly one additional real `PerfectCorpService.analyzeSkin()` call.
`PERFECT_CORP_FALLBACK_MOCK=false`. Fetch was wrapped to record stage, host
class, HTTP class and timing only. No API keys, Authorization headers,
presigned URLs, or provider payloads were printed.

| Stage | Host class | HTTP | Class | ms |
|---|---|---|---|---|
| FILE_INIT | YOUCAM_API | 200 | OK | 1,490 |
| UPLOAD | PRESIGNED_UPLOAD | 0 | NETWORK | 10,048 |
| TASK_CREATE | — | not reached | — | — |
| POLL | — | not reached | — | — |
| MAPPER | — | not reached | — | — |

Terminal: `fetch failed` after FILE_INIT succeeded.

Total latency: 11,545 ms — matches the prior ~11.9 s sample.

## Exact classification

`UPLOAD_FAILURE`

Supporting exclusions:

- `AUTH_REJECTED`: no. File API accepted the request (HTTP 200).
- `ACCOUNT_ENTITLEMENT` / `QUOTA`: no evidence of 402/429/license body.
- `FILE_INIT_FAILURE`: no. FILE_INIT completed.
- `TASK_CREATION_FAILURE` / `TASK_REJECTED` / `POLL_TIMEOUT` / `MAPPER_REJECTION`:
  not reached.
- `PROVIDER_ERROR`: not reached; no YouCam task terminal state.
- `NETWORK_FAILURE`: the upload hop failed as an undici `fetch failed` with
  HTTP 0 from this audit workstation to the provider presigned upload host.

## Closure status

- REAL_PROVIDER_REQUEST = YES
- REAL_PROVIDER_RESPONSE = NOT PROVEN
- CANONICAL_MAPPING = NOT PROVEN
- SYNTHETIC_REPLACEMENT = NO
- NEW_CODE_REMEDIATION_REQUIRED = NO
- OWNER_PROVIDER_ACTION_REQUIRED = NO (auth/file-init accepted; no billing
  signal). Remaining gap is obtaining a completed upload→task→map chain,
  including from a network path that can complete the presigned PUT.

No silent source patch. Adapter variant retries were not used, to keep the
additional attempt to one provider file/upload transaction.
